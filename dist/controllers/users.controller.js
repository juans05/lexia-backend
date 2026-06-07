/**
 * LexAI Perú - Users Controller
 *
 * Endpoints de usuario:
 * - GET /api/users/me - Obtener perfil del usuario autenticado
 * - PATCH /api/users/me - Actualizar perfil
 * - DELETE /api/users/me - Eliminar cuenta (irreversible)
 *
 * Todos requieren autenticación (JWT token válido)
 */
import Joi from 'joi';
import { userService } from '../services/user.service.js';
import { authService } from '../services/auth.service.js';
import { auditService } from '../services/audit.service.js';
import logger from '../config/logger.js';
/**
 * Schemas de validación
 */
const actualizarPerfilSchema = Joi.object({
    nombre: Joi.string().optional().min(3).max(255),
    apellido: Joi.string().optional().max(255).allow(null),
    telefono: Joi.string()
        .optional()
        .pattern(/^\+51[0-9]{9}$/)
        .messages({
        'string.pattern.base': 'Teléfono debe tener formato +51XXXXXXXXX',
    })
        .allow(null),
    nombre_empresa: Joi.string().optional().max(255).allow(null),
    ruc: Joi.string()
        .optional()
        .pattern(/^[0-9]{20}$/)
        .messages({
        'string.pattern.base': 'RUC debe tener 20 dígitos',
    })
        .allow(null),
});
const cambiarContrasenaSchema = Joi.object({
    passwordActual: Joi.string().required(),
    passwordNueva: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .required()
        .messages({
        'string.pattern.base': 'Contraseña debe contener mayúscula, minúscula y número',
    }),
    passwordConfirm: Joi.string().required().valid(Joi.ref('passwordNueva')),
});
/**
 * GET /api/users/me
 *
 * Obtener perfil del usuario autenticado
 * Requiere: Access Token válido
 */
export const obtenerPerfil = async (req, res) => {
    try {
        logger.info('Obteniendo perfil de usuario');
        const usuarioId = req.usuario_id;
        if (!usuarioId) {
            res.status(401).json({
                error: 'No autorizado',
                codigo: 'NOT_AUTHENTICATED',
            });
            return;
        }
        // Obtener usuario de BD
        const usuario = await userService.obtenerPorId(usuarioId);
        if (!usuario) {
            logger.warn(`Usuario no encontrado: ${usuarioId}`);
            res.status(404).json({
                error: 'Usuario no encontrado',
                codigo: 'USER_NOT_FOUND',
            });
            return;
        }
        // Obtener estadísticas
        const estadisticas = await userService.obtenerEstadisticas(usuarioId);
        // Responder (sin contraseña)
        res.status(200).json({
            usuario: {
                usuario_id: usuario.usuario_id,
                email: usuario.email,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                telefono: usuario.telefono,
                es_empresa: usuario.es_empresa,
                nombre_empresa: usuario.nombre_empresa,
                ruc: usuario.ruc,
                email_verificado: usuario.email_verificado,
                telefono_verificado: usuario.telefono_verificado,
                fecha_registro: usuario.fecha_registro,
                fecha_ultima_actividad: usuario.fecha_ultima_actividad,
            },
            estadisticas: estadisticas
                ? {
                    total_consultas: estadisticas.total_consultas,
                    total_gastado_soles: estadisticas.total_gastado_soles,
                    rating_promedio: estadisticas.rating_promedio,
                }
                : null,
        });
    }
    catch (error) {
        logger.error('Error obteniendo perfil:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            codigo: 'GET_PROFILE_ERROR',
        });
    }
};
/**
 * PATCH /api/users/me
 *
 * Actualizar perfil del usuario
 * Requiere: Access Token válido
 */
export const actualizarPerfil = async (req, res) => {
    try {
        logger.info('Actualizando perfil de usuario');
        const usuarioId = req.usuario_id;
        if (!usuarioId) {
            res.status(401).json({
                error: 'No autorizado',
                codigo: 'NOT_AUTHENTICATED',
            });
            return;
        }
        // Validar datos
        const { error, value } = actualizarPerfilSchema.validate(req.body);
        if (error) {
            const mensajes = error.details.map((d) => d.message).join(', ');
            res.status(400).json({
                error: 'Solicitud inválida',
                detalles: error.details,
                codigo: 'VALIDATION_ERROR',
            });
            return;
        }
        // Actualizar usuario
        const usuarioActualizado = await userService.actualizarUsuario(usuarioId, value);
        logger.info(`✓ Perfil actualizado: ${usuarioId}`);
        // Auditar cambio
        await auditService.registrarEvento({
            usuario_id: usuarioId,
            tipo_evento: 'cambio_email', // Reutilizamos como evento general de cambio de perfil
            resultado: 'exitoso',
            detalles: { campos_actualizados: Object.keys(value) },
            endpoint: '/api/users/me',
        });
        res.status(200).json({
            mensaje: 'Perfil actualizado exitosamente',
            usuario: {
                usuario_id: usuarioActualizado.usuario_id,
                email: usuarioActualizado.email,
                nombre: usuarioActualizado.nombre,
                apellido: usuarioActualizado.apellido,
                telefono: usuarioActualizado.telefono,
                es_empresa: usuarioActualizado.es_empresa,
                nombre_empresa: usuarioActualizado.nombre_empresa,
                ruc: usuarioActualizado.ruc,
            },
        });
    }
    catch (error) {
        logger.error('Error actualizando perfil:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            codigo: 'UPDATE_PROFILE_ERROR',
        });
    }
};
/**
 * POST /api/users/me/change-password
 *
 * Cambiar contraseña del usuario
 * Requiere: Access Token válido y contraseña actual correcta
 */
export const cambiarContrasena = async (req, res) => {
    try {
        logger.info('Solicitando cambio de contraseña');
        const usuarioId = req.usuario_id;
        if (!usuarioId) {
            res.status(401).json({
                error: 'No autorizado',
                codigo: 'NOT_AUTHENTICATED',
            });
            return;
        }
        // Validar entrada
        const { error, value } = cambiarContrasenaSchema.validate(req.body);
        if (error) {
            res.status(400).json({
                error: 'Solicitud inválida',
                detalles: error.details,
                codigo: 'VALIDATION_ERROR',
            });
            return;
        }
        // Obtener usuario actual
        const usuario = await userService.obtenerPorId(usuarioId);
        if (!usuario) {
            res.status(404).json({
                error: 'Usuario no encontrado',
                codigo: 'USER_NOT_FOUND',
            });
            return;
        }
        // Verificar contraseña actual
        const esValida = await authService.verifyPassword(value.passwordActual, usuario.password_hash);
        if (!esValida) {
            logger.warn(`Contraseña actual incorrecta: ${usuarioId}`);
            await auditService.registrarEvento({
                usuario_id: usuarioId,
                tipo_evento: 'cambio_contraseña',
                resultado: 'fallido',
                mensaje_error: 'Contraseña actual incorrecta',
                endpoint: '/api/users/me/change-password',
            });
            res.status(401).json({
                error: 'Contraseña actual incorrecta',
                codigo: 'INVALID_PASSWORD',
            });
            return;
        }
        // Hash de nueva contraseña
        const newPasswordHash = await authService.hashPassword(value.passwordNueva);
        // Actualizar contraseña
        await userService.cambiarPassword(usuarioId, newPasswordHash);
        logger.info(`✓ Contraseña cambiada: ${usuarioId}`);
        // Auditar cambio
        await auditService.registrarCambioContrasena(usuarioId);
        res.status(200).json({
            mensaje: 'Contraseña cambiada exitosamente',
        });
    }
    catch (error) {
        logger.error('Error cambiando contraseña:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            codigo: 'CHANGE_PASSWORD_ERROR',
        });
    }
};
/**
 * DELETE /api/users/me
 *
 * Eliminar cuenta de usuario (borrado lógico)
 * ADVERTENCIA: Esta acción es irreversible
 * Requiere: Access Token válido
 */
export const eliminarCuenta = async (req, res) => {
    try {
        logger.warn('Solicitud de eliminación de cuenta');
        const usuarioId = req.usuario_id;
        if (!usuarioId) {
            res.status(401).json({
                error: 'No autorizado',
                codigo: 'NOT_AUTHENTICATED',
            });
            return;
        }
        // Obtener usuario
        const usuario = await userService.obtenerPorId(usuarioId);
        if (!usuario) {
            res.status(404).json({
                error: 'Usuario no encontrado',
                codigo: 'USER_NOT_FOUND',
            });
            return;
        }
        // Eliminar usuario
        await userService.eliminarUsuario(usuarioId);
        logger.warn(`✓ Cuenta eliminada: ${usuarioId} (${usuario.email})`);
        // Auditar eliminación
        await auditService.registrarEliminacionCuenta(usuarioId, usuario.email);
        res.status(200).json({
            mensaje: 'Cuenta eliminada exitosamente',
            advertencia: 'Tu cuenta ha sido eliminada permanentemente. No podremos recuperar tus datos.',
        });
    }
    catch (error) {
        logger.error('Error eliminando cuenta:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            codigo: 'DELETE_ACCOUNT_ERROR',
        });
    }
};
//# sourceMappingURL=users.controller.js.map