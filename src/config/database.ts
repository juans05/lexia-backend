/**
 * LexAI Perú - Database Configuration
 *
 * Pool de conexiones PostgreSQL con:
 * - Connection pooling eficiente
 * - Reintentos automáticos
 * - Manejo de errores robusto
 * - Métodos helper para queries y transacciones
 *
 * Uso:
 *   const pool = getPool();
 *   const resultado = await pool.query('SELECT ...', [params]);
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import logger from './logger.js';
import config from './env.js';

let pool: Pool | null = null;

/**
 * Inicializar pool de conexiones PostgreSQL
 */
export function inicializarPool(): Pool {
  if (pool) {
    return pool;
  }

  try {
    pool = new Pool({
      connectionString: config.database.url,
      ssl: { rejectUnauthorized: config.database.sslRejectUnauthorized },
      max: config.database.poolMax,
      idleTimeoutMillis: config.database.poolIdleTimeout,
      connectionTimeoutMillis: 5000,
      application_name: 'lexai-peru-backend',
    });

    // Event listeners para debugging
    pool.on('connect', () => {
      logger.debug('Conexión PostgreSQL establecida');
    });

    pool.on('error', (err) => {
      logger.error('Error inesperado en pool de PostgreSQL:', err);
    });

    pool.on('remove', () => {
      logger.debug('Cliente removido del pool');
    });

    logger.info(`✓ Pool de PostgreSQL inicializado (max: ${config.database.poolMax})`);

    return pool;
  } catch (error) {
    logger.error('Error al inicializar pool de PostgreSQL:', error);
    throw error;
  }
}

/**
 * Obtener instancia del pool
 *
 * Si no está inicializado, lo crea automáticamente
 */
export function getPool(): Pool {
  if (!pool) {
    return inicializarPool();
  }
  return pool;
}

/**
 * Verificar conexión a la base de datos con timeout
 */
export async function verificarConexion(): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      logger.warn('⚠️  Timeout verificando conexión a PostgreSQL (30s)');
      logger.warn('Continuando sin verificación - la BD podría no estar disponible');
      resolve(false);
    }, 30000); // 30 segundos de timeout

    (async () => {
      try {
        logger.info('🔍 Intentando conectar a PostgreSQL...');
        const poolInstance = getPool();
        const resultado = await poolInstance.query('SELECT NOW()');

        clearTimeout(timeout);
        logger.info(
          `✓ Conexión a PostgreSQL verificada: ${resultado.rows[0].now}`
        );
        resolve(true);
      } catch (error) {
        clearTimeout(timeout);
        logger.error('❌ Error verificando conexión a PostgreSQL:', error);
        resolve(false);
      }
    })();
  });
}

/**
 * Ejecutar una query simples con parámetros
 *
 * @param query - Comando SQL
 * @param params - Parámetros para la query
 * @returns Resultado de la query
 */
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const poolInstance = getPool();

  try {
    logger.debug(`SQL: ${sql.substring(0, 100)}...`);
    return await poolInstance.query(sql, params);
  } catch (error) {
    logger.error('Error en query:', error);
    throw error;
  }
}

/**
 * Ejecutar múltiples queries en una transacción
 *
 * @param queries - Array de queries a ejecutar
 * @returns Array de resultados
 *
 * Ejemplo:
 *   await transaction([
 *     { sql: 'INSERT INTO usuarios ...', params: [...] },
 *     { sql: 'UPDATE estadisticas ...', params: [...] }
 *   ])
 */
export async function transaction(
  queries: Array<{ sql: string; params?: any[] }>
): Promise<QueryResult[]> {
  const poolInstance = getPool();
  const client = await poolInstance.connect();

  try {
    await client.query('BEGIN TRANSACTION');

    const resultados: QueryResult[] = [];

    for (const q of queries) {
      logger.debug(`Ejecutando en transacción: ${q.sql.substring(0, 50)}...`);
      const resultado = await client.query(q.sql, q.params);
      resultados.push(resultado);
    }

    await client.query('COMMIT');

    logger.debug(`✓ Transacción completada (${queries.length} queries)`);

    return resultados;
  } catch (error) {
    await client.query('ROLLBACK');

    logger.error('Error en transacción. Rollback ejecutado:', error);

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ejecutar función con cliente de conexión directa
 *
 * Útil para operaciones complejas que necesitan múltiples queries
 *
 * @param callback - Función que recibe el cliente
 *
 * Ejemplo:
 *   await withClient(async (client) => {
 *     await client.query('BEGIN');
 *     const res = await client.query('INSERT ...');
 *     // ... más queries
 *     await client.query('COMMIT');
 *   })
 */
export async function withClient<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const poolInstance = getPool();
  const client = await poolInstance.connect();

  try {
    return await callback(client);
  } catch (error) {
    logger.error('Error en withClient:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ejecutar query con reintentos automáticos
 *
 * Útil para queries que pueden fallar temporalmente
 *
 * @param sql - Comando SQL
 * @param params - Parámetros
 * @param maxReintentos - Máximo de reintentos (default: 3)
 * @param delayMs - Delay entre reintentos (default: 1000ms)
 */
export async function queryConReintentos<T = any>(
  sql: string,
  params?: any[],
  maxReintentos: number = 3,
  delayMs: number = 1000
): Promise<QueryResult<T>> {
  let ultimoError: Error | null = null;

  for (let intento = 1; intento <= maxReintentos; intento++) {
    try {
      logger.debug(`Query intento ${intento}/${maxReintentos}`);
      return await query<T>(sql, params);
    } catch (error) {
      ultimoError = error as Error;

      if (intento < maxReintentos) {
        logger.warn(
          `Query falló en intento ${intento}. Reintentando en ${delayMs}ms...`
        );

        // Esperar antes de reintentar
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  logger.error(`Query falló después de ${maxReintentos} intentos`);

  throw ultimoError;
}

/**
 * Cerrar pool de conexiones
 *
 * Se ejecuta al shutdown de la aplicación
 */
export async function cerrarPool(): Promise<void> {
  if (!pool) {
    return;
  }

  try {
    await pool.end();
    logger.info('✓ Pool de PostgreSQL cerrado');
    pool = null;
  } catch (error) {
    logger.error('Error al cerrar pool:', error);
    throw error;
  }
}

/**
 * Obtener estadísticas del pool
 */
export async function obtenerEstadisticasPool(): Promise<{
  totalClientes: number;
  clientesInactivos: number;
  colaEspera: number;
}> {
  const poolInstance = getPool();

  return {
    totalClientes: poolInstance.totalCount,
    clientesInactivos: poolInstance.idleCount,
    colaEspera: poolInstance.waitingCount,
  };
}

/**
 * Limpiar conexiones inactivas (mantenimiento)
 */
export async function limpiarConexionesInactivas(): Promise<void> {
  try {
    const poolInstance = getPool();

    logger.debug(`Limpiando conexiones inactivas del pool...`);

    // El pool de 'pg' no tiene método directo para esto
    // Pero podemos monitorear las estadísticas
    const stats = await obtenerEstadisticasPool();

    logger.debug(
      `Pool stats: Total=${stats.totalClientes}, Inactivos=${stats.clientesInactivos}, Cola=${stats.colaEspera}`
    );
  } catch (error) {
    logger.error('Error limpiando conexiones inactivas:', error);
  }
}

/**
 * Inicializar limpieza automática del pool
 */
export function inicializarLimpiezaAutomaticaPool(): void {
  const INTERVALO = 30 * 60 * 1000; // 30 minutos

  setInterval(async () => {
    try {
      await limpiarConexionesInactivas();
    } catch (error) {
      logger.error('Error en limpieza automática del pool:', error);
    }
  }, INTERVALO);

  logger.info('✓ Limpieza automática del pool inicializada');
}
