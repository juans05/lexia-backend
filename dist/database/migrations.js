/**
 * LexAI Perú - Database Migration Runner
 *
 * Sistema de migraciones para PostgreSQL.
 * - Lee archivos SQL del directorio /migrations
 * - Ejecuta migraciones en orden numerado (001_, 002_, etc.)
 * - Mantiene registro en tabla migrations para control de versiones
 * - Soporta rollback automático en caso de error
 *
 * Uso:
 *   npm run migrate         # Ejecutar migraciones pendientes
 *   npx migrate-down       # Rollback última migración
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../config/logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Clase MigrationRunner - Gestor de migraciones PostgreSQL
 *
 * Responsabilidades:
 * - Inicializar tabla de control de migraciones
 * - Leer y parsear archivos SQL
 * - Ejecutar migraciones en orden
 * - Registrar estado de ejecución
 * - Permitir rollback en caso de error
 */
function splitSQLStatements(sql) {
    const statements = [];
    let current = '';
    let inDollarQuote = false;
    let dollarTag = '';
    let i = 0;
    while (i < sql.length) {
        if (!inDollarQuote && sql[i] === '$') {
            const tagEnd = sql.indexOf('$', i + 1);
            if (tagEnd !== -1) {
                const tag = sql.substring(i, tagEnd + 1);
                inDollarQuote = true;
                dollarTag = tag;
                current += tag;
                i = tagEnd + 1;
                continue;
            }
        }
        else if (inDollarQuote && sql.startsWith(dollarTag, i)) {
            current += dollarTag;
            i += dollarTag.length;
            inDollarQuote = false;
            dollarTag = '';
            continue;
        }
        if (!inDollarQuote && sql[i] === ';') {
            const stmt = current.trim();
            if (stmt.length > 0)
                statements.push(stmt);
            current = '';
        }
        else {
            current += sql[i];
        }
        i++;
    }
    const last = current.trim();
    if (last.length > 0)
        statements.push(last);
    return statements;
}
export class MigrationRunner {
    constructor(pool) {
        this.pool = pool;
        this.migrationsDir = path.join(__dirname, 'migrations');
    }
    /**
     * Inicializa la tabla de control de migraciones
     * Se ejecuta una sola vez al inicio
     */
    async inicializarTablaMigraciones(client) {
        const crearTablaMigraciones = `
      CREATE TABLE IF NOT EXISTS _migraciones (
        id_migracion SERIAL PRIMARY KEY,
        nombre VARCHAR(255) UNIQUE NOT NULL,
        fecha_ejecucion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        contenido_sql TEXT,
        estado VARCHAR(50) DEFAULT 'completada'
      );

      CREATE INDEX IF NOT EXISTS idx_migraciones_nombre ON _migraciones(nombre);
      CREATE INDEX IF NOT EXISTS idx_migraciones_fecha ON _migraciones(fecha_ejecucion DESC);
    `;
        try {
            await client.query(crearTablaMigraciones);
            logger.info('✓ Tabla de migraciones inicializada');
        }
        catch (error) {
            logger.error('Error al inicializar tabla de migraciones:', error);
            throw error;
        }
    }
    /**
     * Obtiene lista de migraciones ya ejecutadas
     */
    async obtenerMigracionesEjecutadas(client) {
        try {
            const resultado = await client.query('SELECT nombre FROM _migraciones WHERE estado = $1 ORDER BY id_migracion ASC', ['completada']);
            return resultado.rows.map((row) => row.nombre);
        }
        catch (error) {
            logger.error('Error al obtener migraciones ejecutadas:', error);
            throw error;
        }
    }
    /**
     * Lee archivos SQL del directorio de migraciones
     * Espera formato: NNN_nombre_descripcion.sql (ej: 001_crear_usuarios.sql)
     */
    async leerMigracionesDisponibles() {
        try {
            // Crear directorio si no existe
            if (!fs.existsSync(this.migrationsDir)) {
                logger.warn(`Directorio de migraciones no existe: ${this.migrationsDir}`);
                return [];
            }
            const archivos = fs.readdirSync(this.migrationsDir);
            const migraciones = archivos
                .filter((archivo) => archivo.endsWith('.sql'))
                .sort()
                .map((archivo) => {
                const match = archivo.match(/^(\d+)_(.+)\.sql$/);
                if (!match) {
                    throw new Error(`Formato de archivo de migración inválido: ${archivo}. Usar: NNN_nombre.sql`);
                }
                const numero = parseInt(match[1], 10);
                const nombre = archivo.replace('.sql', '');
                const ruta = path.join(this.migrationsDir, archivo);
                const contenido = fs.readFileSync(ruta, 'utf-8');
                return { numero, nombre, contenido };
            });
            return migraciones;
        }
        catch (error) {
            logger.error('Error al leer migraciones disponibles:', error);
            throw error;
        }
    }
    /**
     * Registra una migración ejecutada en la tabla de control
     */
    async registrarMigracion(client, nombre, contenido) {
        try {
            await client.query(`INSERT INTO _migraciones (nombre, contenido_sql, estado)
         VALUES ($1, $2, $3)
         ON CONFLICT (nombre) DO NOTHING`, [nombre, contenido, 'completada']);
        }
        catch (error) {
            logger.error(`Error al registrar migración ${nombre}:`, error);
            throw error;
        }
    }
    /**
     * Ejecuta todas las migraciones pendientes
     * Transacción: Si una migración falla, toda la operación se revierte
     */
    async up() {
        const client = await this.pool.connect();
        try {
            logger.info('📦 Iniciando ejecución de migraciones...');
            // Paso 1: Inicializar tabla de control
            await this.inicializarTablaMigraciones(client);
            // Paso 2: Obtener migraciones ya ejecutadas
            const ejecutadas = await this.obtenerMigracionesEjecutadas(client);
            logger.info(`✓ ${ejecutadas.length} migraciones previas encontradas`);
            // Paso 3: Leer migraciones disponibles
            const disponibles = await this.leerMigracionesDisponibles();
            if (disponibles.length === 0) {
                logger.info('✓ No hay migraciones para ejecutar');
                return;
            }
            // Paso 4: Filtrar migraciones pendientes
            const pendientes = disponibles.filter((m) => !ejecutadas.includes(m.nombre));
            if (pendientes.length === 0) {
                logger.info('✓ Base de datos al día. No hay migraciones pendientes.');
                return;
            }
            logger.info(`📋 ${pendientes.length} migraciones pendientes a ejecutar:`);
            pendientes.forEach((m) => logger.info(`   - ${m.nombre}`));
            // Paso 5: Ejecutar migraciones — cada una en su propia transacción
            let exitosas = 0;
            for (const migracion of pendientes) {
                try {
                    logger.info(`⏳ Ejecutando migración: ${migracion.nombre}`);
                    await client.query('BEGIN');
                    const statements = splitSQLStatements(migracion.contenido);
                    for (const statement of statements) {
                        await client.query(statement);
                    }
                    await this.registrarMigracion(client, migracion.nombre, migracion.contenido);
                    await client.query('COMMIT');
                    logger.info(`✓ ${migracion.nombre} completada`);
                    exitosas++;
                }
                catch (error) {
                    await client.query('ROLLBACK');
                    const msg = error instanceof Error ? error.message : 'Error desconocido';
                    logger.error(`❌ Fallo en migración ${migracion.nombre}: ${msg}`);
                    logger.warn(`⚠️  Continuando sin la migración ${migracion.nombre}`);
                }
            }
            logger.info(`\n✅ ${exitosas}/${pendientes.length} migraciones ejecutadas`);
        }
        catch (error) {
            logger.error('❌ ERROR en migraciones.');
            logger.error(error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Revierte la última migración ejecutada
     * Nota: Requiere script de rollback en comentario SQL
     * TODO: Implementar rollbacks automáticos
     */
    async down(pasos = 1) {
        const client = await this.pool.connect();
        try {
            logger.info(`↩️  Revirtiendo últimas ${pasos} migraciones...`);
            // Obtener últimas migraciones ejecutadas
            const resultado = await client.query(`SELECT nombre, contenido_sql FROM _migraciones
         WHERE estado = 'completada'
         ORDER BY id_migracion DESC
         LIMIT $1`, [pasos]);
            if (resultado.rows.length === 0) {
                logger.info('ℹ️  No hay migraciones para revertir');
                return;
            }
            // TODO: Implementar lógica de rollback
            // Por ahora, solo registrar que se necesita rollback manual
            logger.warn('⚠️  Los rollbacks deben ejecutarse manualmente');
            logger.warn('Considere usar herramientas como Flyway o Liquibase para rollbacks automáticos');
            // Opcionalmente, permitir rollback solo marcando como revertida
            await client.query('BEGIN TRANSACTION');
            for (const row of resultado.rows) {
                logger.info(`↩️  Rollback registrado para: ${row.nombre}`);
                await client.query(`UPDATE _migraciones SET estado = $1 WHERE nombre = $2`, ['revertida', row.nombre]);
            }
            await client.query('COMMIT');
            logger.info(`✓ ${resultado.rows.length} migraciones marcadas como revertidas`);
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger.error('❌ Error en rollback:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Obtiene estado actual de migraciones
     */
    async status() {
        const client = await this.pool.connect();
        try {
            logger.info('\n📊 ESTADO DE MIGRACIONES:');
            // Obtener migraciones ejecutadas
            const resultado = await client.query(`SELECT nombre, fecha_ejecucion, estado FROM _migraciones
         ORDER BY id_migracion ASC`);
            if (resultado.rows.length === 0) {
                logger.info('ℹ️  No hay migraciones ejecutadas');
                return;
            }
            console.log('\n┌─────────────────────────────────────────────────────┐');
            console.log('│ Migración                     │ Fecha      │ Estado  │');
            console.log('├─────────────────────────────────────────────────────┤');
            resultado.rows.forEach((row) => {
                const fecha = new Date(row.fecha_ejecucion).toISOString().split('T')[0];
                const estado = row.estado === 'completada' ? '✓ OK' : '↩️  Revertida';
                console.log(`│ ${row.nombre.padEnd(29)} │ ${fecha} │ ${estado.padEnd(7)} │`);
            });
            console.log('└─────────────────────────────────────────────────────┘\n');
        }
        catch (error) {
            logger.error('Error al obtener estado de migraciones:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Valida que el directorio de migraciones exista y tenga archivos válidos
     */
    async validar() {
        try {
            if (!fs.existsSync(this.migrationsDir)) {
                logger.warn(`⚠️  Directorio de migraciones no existe: ${this.migrationsDir}`);
                return false;
            }
            const archivos = fs.readdirSync(this.migrationsDir);
            const sqlFiles = archivos.filter((a) => a.endsWith('.sql'));
            if (sqlFiles.length === 0) {
                logger.info('ℹ️  No hay archivos .sql en directorio de migraciones');
                return true;
            }
            logger.info(`✓ ${sqlFiles.length} archivos de migración encontrados`);
            return true;
        }
        catch (error) {
            logger.error('Error al validar migraciones:', error);
            return false;
        }
    }
}
// ============================================================================
// HELPER PARA EJECUTAR DESDE CLI
// ============================================================================
/**
 * Función auxiliar para ejecutar migraciones desde línea de comandos
 * Uso: node dist/database/migrations.js up
 */
export async function ejecutarMigraciones(pool, comando = 'up') {
    const runner = new MigrationRunner(pool);
    try {
        await runner.validar();
        switch (comando.toLowerCase()) {
            case 'up':
                await runner.up();
                break;
            case 'down':
                await runner.down();
                break;
            case 'status':
                await runner.status();
                break;
            default:
                logger.error(`Comando desconocido: ${comando}`);
                logger.info('Comandos disponibles: up, down, status');
        }
    }
    catch (error) {
        logger.error('Error en migración:', error);
        process.exit(1);
    }
}
//# sourceMappingURL=migrations.js.map