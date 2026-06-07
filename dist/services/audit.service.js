/**
 * LexAI Perú - Audit Service
 *
 * Servicio de auditoría para cumplimiento LPDP:
 * - Registrar eventos de autenticación (login, logout)
 * - Registrar cambios en datos sensibles
 * - Auditoría de errores y excepciones
 * - Retención de logs para auditoría (90 días)
 */
import logger from '../config/logger.js';
import { getPool } from '../config/database.js';
/**
 * Servicio de Auditoría
 */
export class AuditService {
    constructor(pool) {
        this.pool = pool;
    }
    /**
     * Registrar evento de auditoría
     *
     * @param dto - Datos del evento
     * @returns ID del evento registrado
     */
    async registrarEvento(dto) {
        try {
            const query = `
        INSERT INTO auditoría_logs (
          usuario_id,
          tipo_evento,
          accion,
          detalles,
          resultado,
          mensaje_error,
          ip_address,
          user_agent,
          endpoint
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        ) RETURNING log_id;
      `;
            const resultado = await this.pool.query(query, [
                dto.usuario_id || null,
                dto.tipo_evento,
                dto.accion || null,
                dto.detalles ? JSON.stringify(dto.detalles) : null,
                dto.resultado || 'exitoso',
                dto.mensaje_error || null,
                dto.ip_address || null,
                dto.user_agent || null,
                dto.endpoint || null,
            ]);
            const logId = resultado.rows[0].log_id;
            logger.debug(`✓ Evento auditado: ${dto.tipo_evento} (${dto.resultado || 'exitoso'})`);
            return logId;
        }
        catch (error) {
            logger.error('Error al registrar evento de auditoría:', error);
            // No lanzar error para no interrumpir el flujo principal
            return '';
        }
    }
    /**
     * Registrar intento de login fallido
     *
     * @param email - Email del usuario que intentó login
     * @param razon - Razón del fallo (email no existe, contraseña incorrecta, etc)
     * @param ipAddress - IP del cliente
     * @param userAgent - User agent del cliente
     */
    async registrarLoginFallido(email, razon, ipAddress, userAgent) {
        try {
            await this.registrarEvento({
                tipo_evento: 'login',
                accion: email,
                resultado: 'fallido',
                mensaje_error: razon,
                ip_address: ipAddress,
                user_agent: userAgent,
                endpoint: '/api/auth/login',
            });
        }
        catch (error) {
            logger.error('Error registrando login fallido:', error);
        }
    }
    /**
     * Registrar login exitoso
     *
     * @param usuarioId - ID del usuario
     * @param ipAddress - IP del cliente
     * @param userAgent - User agent del cliente
     */
    async registrarLoginExitoso(usuarioId, ipAddress, userAgent) {
        try {
            await this.registrarEvento({
                usuario_id: usuarioId,
                tipo_evento: 'login',
                resultado: 'exitoso',
                ip_address: ipAddress,
                user_agent: userAgent,
                endpoint: '/api/auth/login',
            });
        }
        catch (error) {
            logger.error('Error registrando login exitoso:', error);
        }
    }
    /**
     * Registrar logout
     *
     * @param usuarioId - ID del usuario
     * @param ipAddress - IP del cliente
     */
    async registrarLogout(usuarioId, ipAddress) {
        try {
            await this.registrarEvento({
                usuario_id: usuarioId,
                tipo_evento: 'logout',
                resultado: 'exitoso',
                ip_address: ipAddress,
                endpoint: '/api/auth/logout',
            });
        }
        catch (error) {
            logger.error('Error registrando logout:', error);
        }
    }
    /**
     * Registrar cambio de contraseña
     *
     * @param usuarioId - ID del usuario
     */
    async registrarCambioContrasena(usuarioId) {
        try {
            await this.registrarEvento({
                usuario_id: usuarioId,
                tipo_evento: 'cambio_contraseña',
                resultado: 'exitoso',
                endpoint: '/api/auth/change-password',
            });
        }
        catch (error) {
            logger.error('Error registrando cambio de contraseña:', error);
        }
    }
    /**
     * Registrar cambio de email
     *
     * @param usuarioId - ID del usuario
     * @param emailAnterior - Email anterior
     * @param emailNuevo - Email nuevo
     */
    async registrarCambioEmail(usuarioId, emailAnterior, emailNuevo) {
        try {
            await this.registrarEvento({
                usuario_id: usuarioId,
                tipo_evento: 'cambio_email',
                resultado: 'exitoso',
                detalles: { email_anterior: emailAnterior, email_nuevo: emailNuevo },
                endpoint: '/api/users/me',
            });
        }
        catch (error) {
            logger.error('Error registrando cambio de email:', error);
        }
    }
    /**
     * Registrar eliminación de cuenta
     *
     * @param usuarioId - ID del usuario
     * @param email - Email del usuario
     */
    async registrarEliminacionCuenta(usuarioId, email) {
        try {
            await this.registrarEvento({
                usuario_id: usuarioId,
                tipo_evento: 'eliminacion_cuenta',
                resultado: 'exitoso',
                detalles: { email },
                endpoint: '/api/users/me',
            });
        }
        catch (error) {
            logger.error('Error registrando eliminación de cuenta:', error);
        }
    }
    /**
     * Registrar error del sistema
     *
     * @param error - El error ocurrido
     * @param contexto - Información del contexto (endpoint, usuario, etc)
     */
    async registrarError(error, contexto) {
        try {
            await this.registrarEvento({
                usuario_id: contexto?.usuario_id,
                tipo_evento: 'error_sistema',
                resultado: 'fallido',
                mensaje_error: error.message,
                detalles: { stack: error.stack },
                endpoint: contexto?.endpoint,
                ip_address: contexto?.ip_address,
                user_agent: contexto?.user_agent,
            });
        }
        catch (err) {
            logger.error('Error registrando error del sistema:', err);
        }
    }
    /**
     * Obtener eventos de auditoría de un usuario
     *
     * @param usuarioId - ID del usuario
     * @param limite - Límite de registros
     * @param offset - Offset para paginación
     */
    async obtenerEventosDelUsuario(usuarioId, limite = 50, offset = 0) {
        try {
            const query = `
        SELECT * FROM auditoría_logs
        WHERE usuario_id = $1
        ORDER BY fecha_evento DESC
        LIMIT $2 OFFSET $3;
      `;
            const resultado = await this.pool.query(query, [usuarioId, limite, offset]);
            return resultado.rows;
        }
        catch (error) {
            logger.error('Error al obtener eventos del usuario:', error);
            throw error;
        }
    }
    /**
     * Obtener eventos de un tipo específico
     *
     * @param tipoEvento - Tipo de evento a buscar
     * @param limite - Límite de registros
     */
    async obtenerEventosPorTipo(tipoEvento, limite = 50) {
        try {
            const query = `
        SELECT * FROM auditoría_logs
        WHERE tipo_evento = $1
        ORDER BY fecha_evento DESC
        LIMIT $2;
      `;
            const resultado = await this.pool.query(query, [tipoEvento, limite]);
            return resultado.rows;
        }
        catch (error) {
            logger.error('Error al obtener eventos por tipo:', error);
            throw error;
        }
    }
    /**
     * Obtener eventos por rango de fechas
     *
     * @param desde - Fecha inicial
     * @param hasta - Fecha final
     */
    async obtenerEventosPorFecha(desde, hasta) {
        try {
            const query = `
        SELECT * FROM auditoría_logs
        WHERE fecha_evento BETWEEN $1 AND $2
        ORDER BY fecha_evento DESC;
      `;
            const resultado = await this.pool.query(query, [desde, hasta]);
            return resultado.rows;
        }
        catch (error) {
            logger.error('Error al obtener eventos por fecha:', error);
            throw error;
        }
    }
    /**
     * Limpiar logs de auditoría antiguos (> 90 días)
     * Se ejecuta periódicamente
     */
    async limpiarLogsAntiguos(diasRetención = 90) {
        try {
            const query = `
        DELETE FROM auditoría_logs
        WHERE fecha_evento < CURRENT_TIMESTAMP - INTERVAL '${diasRetención} days';
      `;
            const resultado = await this.pool.query(query);
            if (resultado.rowCount && resultado.rowCount > 0) {
                logger.info(`🧹 ${resultado.rowCount} registros de auditoría antiguos eliminados`);
            }
            return resultado.rowCount || 0;
        }
        catch (error) {
            logger.error('Error al limpiar logs antiguos:', error);
            return 0;
        }
    }
    /**
     * Obtener estadísticas de auditoría
     */
    async obtenerEstadisticas() {
        try {
            const query = `
        SELECT
          COUNT(*) as total_eventos,
          COUNT(DISTINCT usuario_id) as usuarios_unicos,
          COUNT(CASE WHEN tipo_evento = 'login' THEN 1 END) as logins,
          COUNT(CASE WHEN tipo_evento = 'logout' THEN 1 END) as logouts,
          COUNT(CASE WHEN resultado = 'fallido' THEN 1 END) as eventos_fallidos,
          COUNT(CASE WHEN tipo_evento = 'error_sistema' THEN 1 END) as errores_sistema,
          MAX(fecha_evento) as ultimo_evento
        FROM auditoría_logs;
      `;
            const resultado = await this.pool.query(query);
            return resultado.rows[0];
        }
        catch (error) {
            logger.error('Error al obtener estadísticas de auditoría:', error);
            throw error;
        }
    }
}
// Crear instancia global del servicio
const pool = getPool();
export const auditService = new AuditService(pool);
/**
 * Inicializar limpieza automática de logs de auditoría
 * Se ejecuta diariamente
 */
export function inicializarLimpiezaAutomaticaAudit() {
    const INTERVALO_LIMPIEZA = 24 * 60 * 60 * 1000; // 24 horas
    setInterval(async () => {
        try {
            await auditService.limpiarLogsAntiguos(90); // Retener 90 días
        }
        catch (error) {
            logger.error('Error en limpieza automática de auditoría:', error);
        }
    }, INTERVALO_LIMPIEZA);
    logger.info('✓ Limpieza automática de auditoría inicializada (cada 24 horas)');
}
//# sourceMappingURL=audit.service.js.map