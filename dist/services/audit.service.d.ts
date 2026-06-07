/**
 * LexAI Perú - Audit Service
 *
 * Servicio de auditoría para cumplimiento LPDP:
 * - Registrar eventos de autenticación (login, logout)
 * - Registrar cambios en datos sensibles
 * - Auditoría de errores y excepciones
 * - Retención de logs para auditoría (90 días)
 */
import { Pool } from 'pg';
/**
 * Interface para evento de auditoría
 */
export interface EventoAuditoria {
    log_id: string;
    usuario_id?: string;
    tipo_evento: 'login' | 'logout' | 'consulta' | 'pago' | 'cambio_contraseña' | 'cambio_email' | 'reseteo_contraseña' | 'eliminacion_cuenta' | 'error_sistema' | 'registro_intento';
    accion?: string;
    detalles?: any;
    resultado: 'exitoso' | 'fallido';
    mensaje_error?: string;
    ip_address?: string;
    user_agent?: string;
    endpoint?: string;
    fecha_evento: Date;
}
/**
 * Interface para crear evento de auditoría
 */
export interface RegistrarEventoDto {
    usuario_id?: string;
    tipo_evento: 'login' | 'logout' | 'consulta' | 'pago' | 'cambio_contraseña' | 'cambio_email' | 'reseteo_contraseña' | 'eliminacion_cuenta' | 'error_sistema' | 'registro_intento';
    accion?: string;
    detalles?: any;
    resultado?: 'exitoso' | 'fallido';
    mensaje_error?: string;
    ip_address?: string;
    user_agent?: string;
    endpoint?: string;
}
/**
 * Servicio de Auditoría
 */
export declare class AuditService {
    private pool;
    constructor(pool: Pool);
    /**
     * Registrar evento de auditoría
     *
     * @param dto - Datos del evento
     * @returns ID del evento registrado
     */
    registrarEvento(dto: RegistrarEventoDto): Promise<string>;
    /**
     * Registrar intento de login fallido
     *
     * @param email - Email del usuario que intentó login
     * @param razon - Razón del fallo (email no existe, contraseña incorrecta, etc)
     * @param ipAddress - IP del cliente
     * @param userAgent - User agent del cliente
     */
    registrarLoginFallido(email: string, razon: string, ipAddress?: string, userAgent?: string): Promise<void>;
    /**
     * Registrar login exitoso
     *
     * @param usuarioId - ID del usuario
     * @param ipAddress - IP del cliente
     * @param userAgent - User agent del cliente
     */
    registrarLoginExitoso(usuarioId: string, ipAddress?: string, userAgent?: string): Promise<void>;
    /**
     * Registrar logout
     *
     * @param usuarioId - ID del usuario
     * @param ipAddress - IP del cliente
     */
    registrarLogout(usuarioId: string, ipAddress?: string): Promise<void>;
    /**
     * Registrar cambio de contraseña
     *
     * @param usuarioId - ID del usuario
     */
    registrarCambioContrasena(usuarioId: string): Promise<void>;
    /**
     * Registrar cambio de email
     *
     * @param usuarioId - ID del usuario
     * @param emailAnterior - Email anterior
     * @param emailNuevo - Email nuevo
     */
    registrarCambioEmail(usuarioId: string, emailAnterior: string, emailNuevo: string): Promise<void>;
    /**
     * Registrar eliminación de cuenta
     *
     * @param usuarioId - ID del usuario
     * @param email - Email del usuario
     */
    registrarEliminacionCuenta(usuarioId: string, email: string): Promise<void>;
    /**
     * Registrar error del sistema
     *
     * @param error - El error ocurrido
     * @param contexto - Información del contexto (endpoint, usuario, etc)
     */
    registrarError(error: Error, contexto?: {
        usuario_id?: string;
        endpoint?: string;
        ip_address?: string;
        user_agent?: string;
    }): Promise<void>;
    /**
     * Obtener eventos de auditoría de un usuario
     *
     * @param usuarioId - ID del usuario
     * @param limite - Límite de registros
     * @param offset - Offset para paginación
     */
    obtenerEventosDelUsuario(usuarioId: string, limite?: number, offset?: number): Promise<EventoAuditoria[]>;
    /**
     * Obtener eventos de un tipo específico
     *
     * @param tipoEvento - Tipo de evento a buscar
     * @param limite - Límite de registros
     */
    obtenerEventosPorTipo(tipoEvento: string, limite?: number): Promise<EventoAuditoria[]>;
    /**
     * Obtener eventos por rango de fechas
     *
     * @param desde - Fecha inicial
     * @param hasta - Fecha final
     */
    obtenerEventosPorFecha(desde: Date, hasta: Date): Promise<EventoAuditoria[]>;
    /**
     * Limpiar logs de auditoría antiguos (> 90 días)
     * Se ejecuta periódicamente
     */
    limpiarLogsAntiguos(diasRetención?: number): Promise<number>;
    /**
     * Obtener estadísticas de auditoría
     */
    obtenerEstadisticas(): Promise<any>;
}
export declare const auditService: AuditService;
/**
 * Inicializar limpieza automática de logs de auditoría
 * Se ejecuta diariamente
 */
export declare function inicializarLimpiezaAutomaticaAudit(): void;
//# sourceMappingURL=audit.service.d.ts.map