/**
 * LexAI Perú - User Service
 *
 * Servicio de gestión de usuarios:
 * - CRUD completo de usuarios
 * - Validaciones específicas para Perú
 * - Gestión de perfil (email, teléfono, empresa)
 * - Métodos para verificación de email
 */
import logger from '../config/logger.js';
import { getPool } from '../config/database.js';
/**
 * Servicio de Usuarios
 */
export class UserService {
    constructor(pool) {
        this.pool = pool;
    }
    /**
     * Crear nuevo usuario
     *
     * @param dto - Datos del usuario a crear
     * @returns Usuario creado
     * @throws Error si email ya existe o hay error en BD
     */
    async crearUsuario(dto) {
        const client = await this.pool.connect();
        try {
            // Validaciones básicas
            if (!dto.email || !dto.password_hash || !dto.nombre) {
                throw new Error('Email, password y nombre son requeridos');
            }
            const query = `
        INSERT INTO usuarios (
          email,
          password_hash,
          nombre,
          apellido,
          telefono,
          es_empresa,
          nombre_empresa,
          ruc
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING *;
      `;
            const resultado = await client.query(query, [
                dto.email.toLowerCase(),
                dto.password_hash,
                dto.nombre,
                dto.apellido || null,
                dto.telefono || null,
                dto.es_empresa || false,
                dto.nombre_empresa || null,
                dto.ruc || null,
            ]);
            const usuario = resultado.rows[0];
            // Crear estadísticas iniciales para el usuario
            await this.crearEstadisticasIniciales(client, usuario.usuario_id);
            logger.info(`✓ Usuario creado: ${usuario.usuario_id} (${usuario.email})`);
            return usuario;
        }
        catch (error) {
            if (error instanceof Error &&
                error.message.includes('unique constraint')) {
                throw new Error('Email ya está registrado');
            }
            logger.error('Error al crear usuario:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Obtener usuario por ID
     *
     * @param usuarioId - UUID del usuario
     * @returns Usuario o null si no existe
     */
    async obtenerPorId(usuarioId) {
        try {
            const query = 'SELECT * FROM usuarios WHERE usuario_id = $1';
            const resultado = await this.pool.query(query, [usuarioId]);
            if (resultado.rows.length === 0) {
                return null;
            }
            return resultado.rows[0];
        }
        catch (error) {
            logger.error('Error al obtener usuario por ID:', error);
            throw error;
        }
    }
    /**
     * Obtener usuario por email
     *
     * @param email - Email del usuario
     * @returns Usuario o null si no existe
     */
    async obtenerPorEmail(email) {
        try {
            const query = 'SELECT * FROM usuarios WHERE email = $1';
            const resultado = await this.pool.query(query, [email.toLowerCase()]);
            if (resultado.rows.length === 0) {
                return null;
            }
            return resultado.rows[0];
        }
        catch (error) {
            logger.error('Error al obtener usuario por email:', error);
            throw error;
        }
    }
    /**
     * Actualizar datos del usuario
     *
     * @param usuarioId - UUID del usuario
     * @param dto - Datos a actualizar
     * @returns Usuario actualizado
     */
    async actualizarUsuario(usuarioId, dto) {
        try {
            const campos = [];
            const valores = [];
            let paramCount = 1;
            if (dto.nombre !== undefined) {
                campos.push(`nombre = $${paramCount++}`);
                valores.push(dto.nombre);
            }
            if (dto.apellido !== undefined) {
                campos.push(`apellido = $${paramCount++}`);
                valores.push(dto.apellido || null);
            }
            if (dto.telefono !== undefined) {
                campos.push(`telefono = $${paramCount++}`);
                valores.push(dto.telefono || null);
            }
            if (dto.nombre_empresa !== undefined) {
                campos.push(`nombre_empresa = $${paramCount++}`);
                valores.push(dto.nombre_empresa || null);
            }
            if (dto.ruc !== undefined) {
                campos.push(`ruc = $${paramCount++}`);
                valores.push(dto.ruc || null);
            }
            if (campos.length === 0) {
                // Si no hay cambios, retornar usuario actual
                const usuario = await this.obtenerPorId(usuarioId);
                if (!usuario) {
                    throw new Error('Usuario no encontrado');
                }
                return usuario;
            }
            campos.push(`fecha_actualizacion = $${paramCount++}`);
            valores.push(new Date());
            valores.push(usuarioId);
            const query = `
        UPDATE usuarios
        SET ${campos.join(', ')}
        WHERE usuario_id = $${paramCount}
        RETURNING *;
      `;
            const resultado = await this.pool.query(query, valores);
            if (resultado.rows.length === 0) {
                throw new Error('Usuario no encontrado');
            }
            logger.info(`✓ Usuario actualizado: ${usuarioId}`);
            return resultado.rows[0];
        }
        catch (error) {
            logger.error('Error al actualizar usuario:', error);
            throw error;
        }
    }
    async guardarCodigoVerificacion(usuarioId, codigo, expira) {
        try {
            await this.pool.query(`UPDATE usuarios SET codigo_verificacion = $1, codigo_verificacion_expira = $2 WHERE usuario_id = $3`, [codigo, expira, usuarioId]);
        }
        catch (error) {
            logger.error('Error al guardar código de verificación:', error);
            throw error;
        }
    }
    async validarCodigoVerificacion(email, codigo) {
        try {
            const resultado = await this.pool.query(`SELECT usuario_id, codigo_verificacion, codigo_verificacion_expira
         FROM usuarios WHERE email = $1 AND es_activo = TRUE`, [email.toLowerCase()]);
            if (resultado.rows.length === 0)
                return null;
            const row = resultado.rows[0];
            if (row.codigo_verificacion !== codigo ||
                !row.codigo_verificacion_expira ||
                new Date() > new Date(row.codigo_verificacion_expira)) {
                return null;
            }
            return row.usuario_id;
        }
        catch (error) {
            logger.error('Error al validar código de verificación:', error);
            throw error;
        }
    }
    async limpiarCodigoVerificacion(usuarioId) {
        try {
            await this.pool.query(`UPDATE usuarios SET codigo_verificacion = NULL, codigo_verificacion_expira = NULL WHERE usuario_id = $1`, [usuarioId]);
        }
        catch (error) {
            logger.error('Error al limpiar código de verificación:', error);
        }
    }
    /**
     * Marcar email como verificado
     *
     * @param usuarioId - UUID del usuario
     */
    async marcarEmailVerificado(usuarioId) {
        try {
            const query = `
        UPDATE usuarios
        SET email_verificado = TRUE, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE usuario_id = $1;
      `;
            await this.pool.query(query, [usuarioId]);
            logger.info(`✓ Email verificado: ${usuarioId}`);
        }
        catch (error) {
            logger.error('Error al marcar email verificado:', error);
            throw error;
        }
    }
    /**
     * Marcar teléfono como verificado
     *
     * @param usuarioId - UUID del usuario
     */
    async marcarTelefonoVerificado(usuarioId) {
        try {
            const query = `
        UPDATE usuarios
        SET telefono_verificado = TRUE, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE usuario_id = $1;
      `;
            await this.pool.query(query, [usuarioId]);
            logger.info(`✓ Teléfono verificado: ${usuarioId}`);
        }
        catch (error) {
            logger.error('Error al marcar teléfono verificado:', error);
            throw error;
        }
    }
    /**
     * Cambiar contraseña de usuario
     *
     * @param usuarioId - UUID del usuario
     * @param newPasswordHash - Nueva contraseña hasheada
     */
    async cambiarPassword(usuarioId, newPasswordHash) {
        try {
            const query = `
        UPDATE usuarios
        SET password_hash = $1, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE usuario_id = $2;
      `;
            await this.pool.query(query, [newPasswordHash, usuarioId]);
            logger.info(`✓ Contraseña cambiada: ${usuarioId}`);
        }
        catch (error) {
            logger.error('Error al cambiar contraseña:', error);
            throw error;
        }
    }
    /**
     * Desactivar cuenta de usuario
     *
     * @param usuarioId - UUID del usuario
     */
    async desactivarCuenta(usuarioId) {
        try {
            const query = `
        UPDATE usuarios
        SET es_activo = FALSE, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE usuario_id = $1;
      `;
            await this.pool.query(query, [usuarioId]);
            logger.info(`✓ Cuenta desactivada: ${usuarioId}`);
        }
        catch (error) {
            logger.error('Error al desactivar cuenta:', error);
            throw error;
        }
    }
    /**
     * Eliminar usuario (borrado lógico)
     *
     * @param usuarioId - UUID del usuario
     */
    async eliminarUsuario(usuarioId) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Borrado lógico: desactivar cuenta y limpiar datos sensibles
            const query = `
        UPDATE usuarios
        SET
          es_activo = FALSE,
          email = email || '_deleted_' || usuario_id,
          telefono = NULL,
          apellido = NULL,
          nombre_empresa = NULL,
          ruc = NULL,
          fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE usuario_id = $1;
      `;
            await client.query(query, [usuarioId]);
            // Invalidar todas las sesiones
            const deleteSessionsQuery = `
        UPDATE sesiones
        SET es_valida = FALSE
        WHERE usuario_id = $1;
      `;
            await client.query(deleteSessionsQuery, [usuarioId]);
            await client.query('COMMIT');
            logger.info(`✓ Usuario eliminado (borrado lógico): ${usuarioId}`);
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error al eliminar usuario:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Actualizar fecha de última actividad
     *
     * @param usuarioId - UUID del usuario
     */
    async actualizarUltimaActividad(usuarioId) {
        try {
            const query = `
        UPDATE usuarios
        SET fecha_ultima_actividad = CURRENT_TIMESTAMP
        WHERE usuario_id = $1;
      `;
            await this.pool.query(query, [usuarioId]);
        }
        catch (error) {
            // No lanzar error para no interrumpir flujo principal
            logger.debug('Error al actualizar última actividad:', error);
        }
    }
    /**
     * Obtener estadísticas del usuario
     *
     * @param usuarioId - UUID del usuario
     */
    async obtenerEstadisticas(usuarioId) {
        try {
            const query = `
        SELECT * FROM estadísticas_usuario
        WHERE usuario_id = $1;
      `;
            const resultado = await this.pool.query(query, [usuarioId]);
            if (resultado.rows.length === 0) {
                return null;
            }
            return resultado.rows[0];
        }
        catch (error) {
            logger.error('Error al obtener estadísticas:', error);
            throw error;
        }
    }
    /**
     * Crear estadísticas iniciales para nuevo usuario (privado)
     */
    async crearEstadisticasIniciales(client, usuarioId) {
        try {
            const query = `
        INSERT INTO estadísticas_usuario (usuario_id)
        VALUES ($1)
        ON CONFLICT (usuario_id) DO NOTHING;
      `;
            await client.query(query, [usuarioId]);
        }
        catch (error) {
            logger.error('Error al crear estadísticas iniciales:', error);
            // No lanzar error para no interrumpir el flujo de creación de usuario
        }
    }
    /**
     * Obtener usuarios activos (para admin)
     *
     * @param limit - Límite de registros
     * @param offset - Offset para paginación
     */
    async obtenerUsuariosActivos(limit = 50, offset = 0) {
        try {
            const query = `
        SELECT * FROM usuarios
        WHERE es_activo = TRUE
        ORDER BY fecha_registro DESC
        LIMIT $1 OFFSET $2;
      `;
            const resultado = await this.pool.query(query, [limit, offset]);
            return resultado.rows;
        }
        catch (error) {
            logger.error('Error al obtener usuarios activos:', error);
            throw error;
        }
    }
    /**
     * Contar total de usuarios activos
     */
    async contarUsuariosActivos() {
        try {
            const query = 'SELECT COUNT(*) as total FROM usuarios WHERE es_activo = TRUE';
            const resultado = await this.pool.query(query);
            return parseInt(resultado.rows[0].total, 10);
        }
        catch (error) {
            logger.error('Error al contar usuarios activos:', error);
            throw error;
        }
    }
}
// Crear instancia global del servicio
const pool = getPool();
export const userService = new UserService(pool);
//# sourceMappingURL=user.service.js.map