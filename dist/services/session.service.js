/**
 * LexAI Perú - Session Service
 *
 * Gestión de sesiones de usuario:
 * - Crear sesiones después de login
 * - Validar sesiones activas
 * - Invalidar sesiones (logout)
 * - Limpiar sesiones expiradas
 */
import logger from '../config/logger.js';
import { getPool } from '../config/database.js';
/**
 * Servicio de Sesiones
 */
export class SessionService {
    constructor(pool) {
        this.REFRESH_TOKEN_EXPIRY_DAYS = 7;
        this.pool = pool;
    }
    /**
     * Crear nueva sesión después de login
     *
     * @param dto - Datos para crear la sesión
     * @returns Sesión creada
     */
    async crearSesion(dto) {
        try {
            // Calcular fecha de expiración (7 días desde ahora)
            const fechaExpiracion = new Date();
            fechaExpiracion.setDate(fechaExpiracion.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);
            const query = `
        INSERT INTO sesiones (
          usuario_id,
          refresh_token_hash,
          ip_address,
          user_agent,
          tipo_dispositivo,
          fecha_expiracion
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        ) RETURNING *;
      `;
            const resultado = await this.pool.query(query, [
                dto.usuario_id,
                dto.refresh_token_hash,
                dto.ip_address || null,
                dto.user_agent || null,
                dto.tipo_dispositivo || 'web',
                fechaExpiracion,
            ]);
            const sesion = resultado.rows[0];
            logger.info(`✓ Sesión creada: ${sesion.sesion_id} para usuario ${sesion.usuario_id}`);
            return sesion;
        }
        catch (error) {
            logger.error('Error al crear sesión:', error);
            throw error;
        }
    }
    /**
     * Obtener sesión por ID
     *
     * @param sesionId - UUID de la sesión
     * @returns Sesión o null
     */
    async obtenerPorId(sesionId) {
        try {
            const query = `
        SELECT * FROM sesiones
        WHERE sesion_id = $1 AND es_valida = TRUE;
      `;
            const resultado = await this.pool.query(query, [sesionId]);
            if (resultado.rows.length === 0) {
                return null;
            }
            return resultado.rows[0];
        }
        catch (error) {
            logger.error('Error al obtener sesión:', error);
            throw error;
        }
    }
    /**
     * Obtener todas las sesiones activas de un usuario
     *
     * @param usuarioId - UUID del usuario
     * @returns Array de sesiones
     */
    async obtenerSesionesActivas(usuarioId) {
        try {
            const query = `
        SELECT * FROM sesiones
        WHERE usuario_id = $1 AND es_valida = TRUE AND fecha_expiracion > CURRENT_TIMESTAMP
        ORDER BY fecha_creacion DESC;
      `;
            const resultado = await this.pool.query(query, [usuarioId]);
            return resultado.rows;
        }
        catch (error) {
            logger.error('Error al obtener sesiones activas:', error);
            throw error;
        }
    }
    /**
     * Actualizar último uso de sesión
     *
     * @param sesionId - UUID de la sesión
     */
    async actualizarUltimoUso(sesionId) {
        try {
            const query = `
        UPDATE sesiones
        SET fecha_ultimo_uso = CURRENT_TIMESTAMP
        WHERE sesion_id = $1;
      `;
            await this.pool.query(query, [sesionId]);
        }
        catch (error) {
            logger.error('Error al actualizar último uso de sesión:', error);
            // No lanzar error para no interrumpir flujo
        }
    }
    /**
     * Invalidar sesión (logout)
     *
     * @param sesionId - UUID de la sesión
     */
    async invalidarSesion(sesionId) {
        try {
            const query = `
        UPDATE sesiones
        SET es_valida = FALSE
        WHERE sesion_id = $1;
      `;
            await this.pool.query(query, [sesionId]);
            logger.info(`✓ Sesión invalidada: ${sesionId}`);
        }
        catch (error) {
            logger.error('Error al invalidar sesión:', error);
            throw error;
        }
    }
    /**
     * Invalidar todas las sesiones de un usuario (logout desde todos lados)
     *
     * @param usuarioId - UUID del usuario
     */
    async invalidarTodasLasSesiones(usuarioId) {
        try {
            const query = `
        UPDATE sesiones
        SET es_valida = FALSE
        WHERE usuario_id = $1 AND es_valida = TRUE
        RETURNING sesion_id;
      `;
            const resultado = await this.pool.query(query, [usuarioId]);
            logger.info(`✓ ${resultado.rowCount} sesiones invalidadas para usuario: ${usuarioId}`);
            return resultado.rowCount || 0;
        }
        catch (error) {
            logger.error('Error al invalidar todas las sesiones:', error);
            throw error;
        }
    }
    /**
     * Limpiar sesiones expiradas (mantenimiento)
     * Se ejecuta periódicamente
     */
    async limpiarSesionesExpiradas() {
        try {
            const query = `
        DELETE FROM sesiones
        WHERE fecha_expiracion < CURRENT_TIMESTAMP;
      `;
            const resultado = await this.pool.query(query);
            if (resultado.rowCount && resultado.rowCount > 0) {
                logger.info(`🧹 ${resultado.rowCount} sesiones expiradas eliminadas`);
            }
            return resultado.rowCount || 0;
        }
        catch (error) {
            logger.error('Error al limpiar sesiones expiradas:', error);
            // No lanzar error para no interrumpir el sistema
            return 0;
        }
    }
    /**
     * Validar que sesión exista, sea válida y no esté expirada
     *
     * @param sesionId - UUID de la sesión
     * @returns true si sesión es válida
     */
    async esSesionValida(sesionId) {
        try {
            const sesion = await this.obtenerPorId(sesionId);
            if (!sesion) {
                return false;
            }
            // Verificar que no esté expirada
            const ahora = new Date();
            return sesion.fecha_expiracion > ahora && sesion.es_valida;
        }
        catch (error) {
            logger.error('Error al validar sesión:', error);
            return false;
        }
    }
    /**
     * Obtener estadísticas de sesiones activas (para admin)
     */
    async obtenerEstadisticas() {
        try {
            const query = `
        SELECT
          COUNT(*) as total_sesiones,
          COUNT(DISTINCT usuario_id) as usuarios_unicos,
          COUNT(CASE WHEN es_valida = TRUE THEN 1 END) as sesiones_activas,
          COUNT(CASE WHEN fecha_expiracion < CURRENT_TIMESTAMP THEN 1 END) as sesiones_expiradas,
          COUNT(CASE WHEN tipo_dispositivo = 'web' THEN 1 END) as sesiones_web,
          COUNT(CASE WHEN tipo_dispositivo = 'mobile' THEN 1 END) as sesiones_mobile
        FROM sesiones;
      `;
            const resultado = await this.pool.query(query);
            return resultado.rows[0];
        }
        catch (error) {
            logger.error('Error al obtener estadísticas de sesiones:', error);
            throw error;
        }
    }
}
// Crear instancia global del servicio
const pool = getPool();
export const sessionService = new SessionService(pool);
/**
 * Inicializar limpieza automática de sesiones expiradas
 * Se ejecuta cada hora
 */
export function inicializarLimpiezaAutomaticaSesiones() {
    const INTERVALO_LIMPIEZA = 60 * 60 * 1000; // 1 hora
    setInterval(async () => {
        try {
            await sessionService.limpiarSesionesExpiradas();
        }
        catch (error) {
            logger.error('Error en limpieza automática de sesiones:', error);
        }
    }, INTERVALO_LIMPIEZA);
    logger.info('✓ Limpieza automática de sesiones inicializada (cada 1 hora)');
}
//# sourceMappingURL=session.service.js.map