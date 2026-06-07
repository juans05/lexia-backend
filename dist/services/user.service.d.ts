/**
 * LexAI Perú - User Service
 *
 * Servicio de gestión de usuarios:
 * - CRUD completo de usuarios
 * - Validaciones específicas para Perú
 * - Gestión de perfil (email, teléfono, empresa)
 * - Métodos para verificación de email
 */
import { Pool } from 'pg';
/**
 * Interface para datos de usuario
 */
export interface Usuario {
    usuario_id: string;
    email: string;
    password_hash: string;
    nombre: string;
    apellido?: string | null;
    telefono?: string | null;
    es_empresa: boolean;
    nombre_empresa?: string | null;
    ruc?: string | null;
    es_activo: boolean;
    email_verificado: boolean;
    telefono_verificado: boolean;
    fecha_registro: Date;
    fecha_ultima_actividad: Date;
    fecha_actualizacion: Date;
}
/**
 * Interface para crear usuario
 */
export interface CrearUsuarioDto {
    email: string;
    password_hash: string;
    nombre: string;
    apellido?: string;
    telefono?: string;
    es_empresa?: boolean;
    nombre_empresa?: string;
    ruc?: string;
}
/**
 * Interface para actualizar usuario
 */
export interface ActualizarUsuarioDto {
    nombre?: string;
    apellido?: string;
    telefono?: string;
    nombre_empresa?: string;
    ruc?: string;
}
/**
 * Servicio de Usuarios
 */
export declare class UserService {
    private pool;
    constructor(pool: Pool);
    /**
     * Crear nuevo usuario
     *
     * @param dto - Datos del usuario a crear
     * @returns Usuario creado
     * @throws Error si email ya existe o hay error en BD
     */
    crearUsuario(dto: CrearUsuarioDto): Promise<Usuario>;
    /**
     * Obtener usuario por ID
     *
     * @param usuarioId - UUID del usuario
     * @returns Usuario o null si no existe
     */
    obtenerPorId(usuarioId: string): Promise<Usuario | null>;
    /**
     * Obtener usuario por email
     *
     * @param email - Email del usuario
     * @returns Usuario o null si no existe
     */
    obtenerPorEmail(email: string): Promise<Usuario | null>;
    /**
     * Actualizar datos del usuario
     *
     * @param usuarioId - UUID del usuario
     * @param dto - Datos a actualizar
     * @returns Usuario actualizado
     */
    actualizarUsuario(usuarioId: string, dto: ActualizarUsuarioDto): Promise<Usuario>;
    guardarCodigoVerificacion(usuarioId: string, codigo: string, expira: Date): Promise<void>;
    validarCodigoVerificacion(email: string, codigo: string): Promise<string | null>;
    limpiarCodigoVerificacion(usuarioId: string): Promise<void>;
    /**
     * Marcar email como verificado
     *
     * @param usuarioId - UUID del usuario
     */
    marcarEmailVerificado(usuarioId: string): Promise<void>;
    /**
     * Marcar teléfono como verificado
     *
     * @param usuarioId - UUID del usuario
     */
    marcarTelefonoVerificado(usuarioId: string): Promise<void>;
    /**
     * Cambiar contraseña de usuario
     *
     * @param usuarioId - UUID del usuario
     * @param newPasswordHash - Nueva contraseña hasheada
     */
    cambiarPassword(usuarioId: string, newPasswordHash: string): Promise<void>;
    /**
     * Desactivar cuenta de usuario
     *
     * @param usuarioId - UUID del usuario
     */
    desactivarCuenta(usuarioId: string): Promise<void>;
    /**
     * Eliminar usuario (borrado lógico)
     *
     * @param usuarioId - UUID del usuario
     */
    eliminarUsuario(usuarioId: string): Promise<void>;
    /**
     * Actualizar fecha de última actividad
     *
     * @param usuarioId - UUID del usuario
     */
    actualizarUltimaActividad(usuarioId: string): Promise<void>;
    /**
     * Obtener estadísticas del usuario
     *
     * @param usuarioId - UUID del usuario
     */
    obtenerEstadisticas(usuarioId: string): Promise<any>;
    /**
     * Crear estadísticas iniciales para nuevo usuario (privado)
     */
    private crearEstadisticasIniciales;
    /**
     * Obtener usuarios activos (para admin)
     *
     * @param limit - Límite de registros
     * @param offset - Offset para paginación
     */
    obtenerUsuariosActivos(limit?: number, offset?: number): Promise<Usuario[]>;
    /**
     * Contar total de usuarios activos
     */
    contarUsuariosActivos(): Promise<number>;
}
export declare const userService: UserService;
//# sourceMappingURL=user.service.d.ts.map