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
import { Pool } from 'pg';
export declare class MigrationRunner {
    private pool;
    private migrationsDir;
    constructor(pool: Pool);
    /**
     * Inicializa la tabla de control de migraciones
     * Se ejecuta una sola vez al inicio
     */
    private inicializarTablaMigraciones;
    /**
     * Obtiene lista de migraciones ya ejecutadas
     */
    private obtenerMigracionesEjecutadas;
    /**
     * Lee archivos SQL del directorio de migraciones
     * Espera formato: NNN_nombre_descripcion.sql (ej: 001_crear_usuarios.sql)
     */
    private leerMigracionesDisponibles;
    /**
     * Registra una migración ejecutada en la tabla de control
     */
    private registrarMigracion;
    /**
     * Ejecuta todas las migraciones pendientes
     * Transacción: Si una migración falla, toda la operación se revierte
     */
    up(): Promise<void>;
    /**
     * Revierte la última migración ejecutada
     * Nota: Requiere script de rollback en comentario SQL
     * TODO: Implementar rollbacks automáticos
     */
    down(pasos?: number): Promise<void>;
    /**
     * Obtiene estado actual de migraciones
     */
    status(): Promise<void>;
    /**
     * Valida que el directorio de migraciones exista y tenga archivos válidos
     */
    validar(): Promise<boolean>;
}
/**
 * Función auxiliar para ejecutar migraciones desde línea de comandos
 * Uso: node dist/database/migrations.js up
 */
export declare function ejecutarMigraciones(pool: Pool, comando?: string): Promise<void>;
//# sourceMappingURL=migrations.d.ts.map