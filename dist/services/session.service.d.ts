/**
 * LexAI Perú - Session Service
 *
 * Gestión de sesiones de usuario:
 * - Crear sesiones después de login
 * - Validar sesiones activas
 * - Invalidar sesiones (logout)
 * - Limpiar sesiones expiradas
 */
import { Pool } from 'pg';
/**
 * Interface para sesión
 */
export interface Sesion {
    sesion_id: string;
    usuario_id: string;
    refresh_token_hash: string;
    ip_address?: string;
    user_agent?: string;
    tipo_dispositivo?: string;
    fecha_creacion: Date;
    fecha_expiracion: Date;
    fecha_ultimo_uso: Date;
    es_valida: boolean;
}
/**
 * Interface para crear sesión
 */
export interface CrearSesionDto {
    usuario_id: string;
    refresh_token_hash: string;
    ip_address?: string;
    user_agent?: string;
    tipo_dispositivo?: string;
}
/**
 * Servicio de Sesiones
 */
export declare class SessionService {
    private pool;
    private readonly REFRESH_TOKEN_EXPIRY_DAYS;
    constructor(pool: Pool);
    /**
     * Crear nueva sesión después de login
     *
     * @param dto - Datos para crear la sesión
     * @returns Sesión creada
     */
    crearSesion(dto: CrearSesionDto): Promise<Sesion>;
    /**
     * Obtener sesión por ID
     *
     * @param sesionId - UUID de la sesión
     * @returns Sesión o null
     */
    obtenerPorId(sesionId: string): Promise<Sesion | null>;
    /**
     * Obtener todas las sesiones activas de un usuario
     *
     * @param usuarioId - UUID del usuario
     * @returns Array de sesiones
     */
    obtenerSesionesActivas(usuarioId: string): Promise<Sesion[]>;
    /**
     * Actualizar último uso de sesión
     *
     * @param sesionId - UUID de la sesión
     */
    actualizarUltimoUso(sesionId: string): Promise<void>;
    /**
     * Invalidar sesión (logout)
     *
     * @param sesionId - UUID de la sesión
     */
    invalidarSesion(sesionId: string): Promise<void>;
    /**
     * Invalidar todas las sesiones de un usuario (logout desde todos lados)
     *
     * @param usuarioId - UUID del usuario
     */
    invalidarTodasLasSesiones(usuarioId: string): Promise<number>;
    /**
     * Limpiar sesiones expiradas (mantenimiento)
     * Se ejecuta periódicamente
     */
    limpiarSesionesExpiradas(): Promise<number>;
    /**
     * Validar que sesión exista, sea válida y no esté expirada
     *
     * @param sesionId - UUID de la sesión
     * @returns true si sesión es válida
     */
    esSesionValida(sesionId: string): Promise<boolean>;
    /**
     * Obtener estadísticas de sesiones activas (para admin)
     */
    obtenerEstadisticas(): Promise<any>;
}
export declare const sessionService: SessionService;
/**
 * Inicializar limpieza automática de sesiones expiradas
 * Se ejecuta cada hora
 */
export declare function inicializarLimpiezaAutomaticaSesiones(): void;
//# sourceMappingURL=session.service.d.ts.map