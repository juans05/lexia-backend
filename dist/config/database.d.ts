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
/**
 * Inicializar pool de conexiones PostgreSQL
 */
export declare function inicializarPool(): Pool;
/**
 * Obtener instancia del pool
 *
 * Si no está inicializado, lo crea automáticamente
 */
export declare function getPool(): Pool;
/**
 * Verificar conexión a la base de datos
 */
export declare function verificarConexion(): Promise<boolean>;
/**
 * Ejecutar una query simples con parámetros
 *
 * @param query - Comando SQL
 * @param params - Parámetros para la query
 * @returns Resultado de la query
 */
export declare function query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
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
export declare function transaction(queries: Array<{
    sql: string;
    params?: any[];
}>): Promise<QueryResult[]>;
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
export declare function withClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
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
export declare function queryConReintentos<T = any>(sql: string, params?: any[], maxReintentos?: number, delayMs?: number): Promise<QueryResult<T>>;
/**
 * Cerrar pool de conexiones
 *
 * Se ejecuta al shutdown de la aplicación
 */
export declare function cerrarPool(): Promise<void>;
/**
 * Obtener estadísticas del pool
 */
export declare function obtenerEstadisticasPool(): Promise<{
    totalClientes: number;
    clientesInactivos: number;
    colaEspera: number;
}>;
/**
 * Limpiar conexiones inactivas (mantenimiento)
 */
export declare function limpiarConexionesInactivas(): Promise<void>;
/**
 * Inicializar limpieza automática del pool
 */
export declare function inicializarLimpiezaAutomaticaPool(): void;
//# sourceMappingURL=database.d.ts.map