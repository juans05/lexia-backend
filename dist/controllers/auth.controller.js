/**
 * LexAI Perú - Authentication Controller
 *
 * Endpoints de autenticación:
 * - POST /api/auth/register - Registrar nuevo usuario
 * - POST /api/auth/login - Login con credenciales
 * - POST /api/auth/refresh-token - Renovar access token
 * - POST /api/auth/logout - Cerrar sesión
 * - POST /api/auth/request-password-reset - Solicitar reseteo de contraseña
 * - POST /api/auth/verify-email - Verificar email con token
 *
 * Validaciones:
 * - Email: Formato válido, no duplicado
 * - Contraseña: Mínimo 8 caracteres, complejidad básica
 * - Teléfono: Formato peruano +51XXXXXXXXX
 */
import Joi from 'joi';
import { randomInt } from 'crypto';
import { authService, extractBearerToken } from '../services/auth.service.js';
import { userService } from '../services/user.service.js';
import { sessionService } from '../services/session.service.js';
import { auditService } from '../services/audit.service.js';
import { enviarCodigoVerificacion } from '../services/email.service.js';
import logger from '../config/logger.js';
/**
 * Schemas de validación con Joi
 */
const registerSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Email inválido',
        'any.required': 'Email es requerido',
    }),
    password: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .required()
        .messages({
        'string.min': 'Contraseña debe tener al menos 8 caracteres',
        'string.pattern.base': 'Contraseña debe contener mayúscula, minúscula y número',
        'any.required': 'Contraseña es requerida',
    }),
    nombre: Joi.string().required().min(3).max(255).messages({
        'string.min': 'Nombre debe tener al menos 3 caracteres',
        'any.required': 'Nombre es requerido',
    }),
    apellido: Joi.string().optional().max(255),
    telefono: Joi.string()
        .optional()
        .pattern(/^\+51[0-9]{9}$/)
        .messages({
        'string.pattern.base': 'Teléfono debe tener formato +51XXXXXXXXX (Perú)',
    }),
    es_empresa: Joi.boolean().optional(),
    nombre_empresa: Joi.string().optional().max(255),
    ruc: Joi.string()
        .optional()
        .pattern(/^[0-9]{20}$/)
        .messages({
        'string.pattern.base': 'RUC debe tener 20 dígitos',
    }),
});
const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});
const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required(),
});
const passwordResetSchema = Joi.object({
    email: Joi.string().email().required(),
});
const verifyEmailSchema = Joi.object({
    token: Joi.string().required(),
});
/**
 * POST /api/auth/register
 *
 * Registrar nuevo usuario en la plataforma.
 * Valida datos, crea usuario, genera tokens y sesión.
 */
export const register = async (req, res) => {
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    try {
        logger.info('📝 Intento de registro');
        // Validar entrada
        const { error, value } = registerSchema.validate(req.body, {
            abortEarly: false,
        });
        if (error) {
            const mensajes = error.details.map((d) => d.message).join(', ');
            logger.warn(`Validación fallida: ${mensajes}`);
            res.status(400).json({
                error: 'Solicitud inválida',
                detalles: error.details,
                codigo: 'VALIDATION_ERROR',
            });
            // Auditar intento fallido
            await auditService.registrarEvento({
                tipo_evento: 'registro_intento',
                resultado: 'fallido',
                mensaje_error: mensajes,
                ip_address: ipAddress,
                user_agent: userAgent,
                endpoint: '/api/auth/register',
            });
            return;
        }
        // Verificar que email no exista
        const usuarioExistente = await userService.obtenerPorEmail(value.email);
        if (usuarioExistente) {
            logger.warn(`Email ya registrado: ${value.email}`);
            res.status(409).json({
                error: 'Email ya registrado',
                mensaje: 'Este email ya está en uso. Intente login o use otro email.',
                codigo: 'EMAIL_ALREADY_EXISTS',
            });
            await auditService.registrarEvento({
                tipo_evento: 'registro_intento',
                resultado: 'fallido',
                mensaje_error: 'Email duplicado',
                ip_address: ipAddress,
                user_agent: userAgent,
                endpoint: '/api/auth/register',
            });
            return;
        }
        // Hash de contraseña
        const passwordHash = await authService.hashPassword(value.password);
        // Crear usuario
        const nuevoUsuario = await userService.crearUsuario({
            email: value.email,
            password_hash: passwordHash,
            nombre: value.nombre,
            apellido: value.apellido,
            telefono: value.telefono,
            es_empresa: value.es_empresa || false,
            nombre_empresa: value.nombre_empresa,
            ruc: value.ruc,
        });
        logger.info(`✓ Usuario creado: ${nuevoUsuario.usuario_id}`);
        // Generar código de 6 dígitos y guardarlo en BD (expira en 15 min)
        const codigo = String(randomInt(100000, 999999));
        const expira = new Date(Date.now() + 15 * 60 * 1000);
        await userService.guardarCodigoVerificacion(nuevoUsuario.usuario_id, codigo, expira);
        // Enviar correo de verificación
        await enviarCodigoVerificacion(nuevoUsuario.email, nuevoUsuario.nombre, codigo);
        // Auditar registro exitoso
        await auditService.registrarEvento({
            usuario_id: nuevoUsuario.usuario_id,
            tipo_evento: 'registro_exitoso',
            resultado: 'exitoso',
            ip_address: ipAddress,
            user_agent: userAgent,
            endpoint: '/api/auth/register',
        });
        // Responder sin tokens — el usuario debe verificar su email primero
        res.status(201).json({
            mensaje: 'Registro exitoso. Te hemos enviado un código de verificación a tu correo.',
            usuario: {
                usuario_id: nuevoUsuario.usuario_id,
                email: nuevoUsuario.email,
                nombre: nuevoUsuario.nombre,
            },
        });
    }
    catch (error) {
        logger.error('Error en register:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            mensaje: 'Error durante el registro',
            codigo: 'REGISTRATION_ERROR',
        });
    }
};
/**
 * POST /api/auth/login
 *
 * Autenticar usuario con email y contraseña.
 * Valida credenciales, genera tokens y crea sesión.
 */
export const login = async (req, res) => {
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    try {
        logger.info('🔓 Intento de login');
        // Validar entrada
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            logger.warn(`Validación fallida: ${error.message}`);
            res.status(400).json({
                error: 'Solicitud inválida',
                mensaje: 'Email y contraseña son requeridos',
                codigo: 'VALIDATION_ERROR',
            });
            return;
        }
        // Buscar usuario por email
        const usuario = await userService.obtenerPorEmail(value.email);
        if (!usuario) {
            logger.warn(`Usuario no encontrado: ${value.email}`);
            // Auditar intento fallido
            await auditService.registrarEvento({
                tipo_evento: 'login',
                resultado: 'fallido',
                mensaje_error: 'Usuario no encontrado',
                ip_address: ipAddress,
                user_agent: userAgent,
                endpoint: '/api/auth/login',
            });
            // No revelar si existe o no el usuario (por seguridad)
            res.status(401).json({
                error: 'Credenciales inválidas',
                mensaje: 'Email o contraseña incorrectos',
                codigo: 'INVALID_CREDENTIALS',
            });
            return;
        }
        // Verificar contraseña
        const esValida = await authService.verifyPassword(value.password, usuario.password_hash);
        if (!esValida) {
            logger.warn(`Contraseña inválida para: ${value.email}`);
            await auditService.registrarEvento({
                usuario_id: usuario.usuario_id,
                tipo_evento: 'login',
                resultado: 'fallido',
                mensaje_error: 'Contraseña incorrecta',
                ip_address: ipAddress,
                user_agent: userAgent,
                endpoint: '/api/auth/login',
            });
            res.status(401).json({
                error: 'Credenciales inválidas',
                mensaje: 'Email o contraseña incorrectos',
                codigo: 'INVALID_CREDENTIALS',
            });
            return;
        }
        // Validar que usuario esté activo
        if (!usuario.es_activo) {
            logger.warn(`Usuario inactivo: ${usuario.usuario_id}`);
            res.status(403).json({
                error: 'Cuenta inactiva',
                mensaje: 'Tu cuenta ha sido desactivada. Contacta a soporte.',
                codigo: 'ACCOUNT_INACTIVE',
            });
            return;
        }
        // Generar tokens
        const { accessToken, refreshToken, expiresIn } = await authService.generateTokens(usuario.usuario_id, usuario.email);
        // Crear sesión
        const refreshTokenHash = await authService.hashRefreshToken(refreshToken);
        const sesion = await sessionService.crearSesion({
            usuario_id: usuario.usuario_id,
            refresh_token_hash: refreshTokenHash,
            ip_address: ipAddress,
            user_agent: userAgent,
            tipo_dispositivo: 'web',
        });
        // Auditar login exitoso
        await auditService.registrarEvento({
            usuario_id: usuario.usuario_id,
            tipo_evento: 'login',
            resultado: 'exitoso',
            ip_address: ipAddress,
            user_agent: userAgent,
            endpoint: '/api/auth/login',
            detalles: { sesion_id: sesion.sesion_id },
        });
        // Actualizar fecha de última actividad
        await userService.actualizarUltimaActividad(usuario.usuario_id);
        logger.info(`✓ Login exitoso: ${usuario.usuario_id}`);
        res.status(200).json({
            accessToken,
            refreshToken,
            expiresIn,
            usuario: {
                id: usuario.usuario_id,
                email: usuario.email,
                nombre: usuario.nombre,
                emailVerificado: usuario.email_verificado,
                fechaCreacion: usuario.fecha_registro,
            },
        });
    }
    catch (error) {
        logger.error('Error en login:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            mensaje: 'Error durante el login',
            codigo: 'LOGIN_ERROR',
        });
    }
};
/**
 * POST /api/auth/refresh-token
 *
 * Renovar access token usando refresh token.
 * El cliente envía el refresh token y recibe un nuevo access token.
 */
export const refreshToken = async (req, res) => {
    try {
        logger.info('🔄 Refresh token request');
        // El middleware de validación ya verificó el refresh token
        const usuarioId = req.usuario_id;
        const email = req.email;
        const oldRefreshToken = req.token;
        // Generar nuevo access token
        const newAccessToken = await authService.refreshAccessToken(oldRefreshToken);
        logger.info(`✓ Access token renovado: ${usuarioId}`);
        res.status(200).json({
            mensaje: 'Token renovado',
            tokens: {
                accessToken: newAccessToken,
                expiresIn: 24 * 60 * 60, // 24 horas
            },
        });
    }
    catch (error) {
        logger.error('Error en refreshToken:', error);
        res.status(401).json({
            error: 'Token inválido',
            mensaje: 'No se pudo renovar el token',
            codigo: 'REFRESH_FAILED',
        });
    }
};
/**
 * POST /api/auth/logout
 *
 * Cerrar sesión invalidando el refresh token.
 * Requiere autenticación (access token válido).
 */
export const logout = async (req, res) => {
    try {
        logger.info('🔐 Logout request');
        const usuarioId = req.usuario_id;
        if (!usuarioId) {
            res.status(401).json({
                error: 'No autorizado',
                codigo: 'NOT_AUTHENTICATED',
            });
            return;
        }
        // Invalidar todas las sesiones del usuario (logout desde todos lados)
        // O solo la sesión actual si tenemos el token
        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const token = extractBearerToken(authHeader);
                // En producción, invalidar la sesión específica
                // await sessionService.invalidarSesion(token);
            }
            catch (error) {
                // Continuar incluso si falla la extracción
            }
        }
        // Auditar logout
        await auditService.registrarEvento({
            usuario_id: usuarioId,
            tipo_evento: 'logout',
            resultado: 'exitoso',
            ip_address: req.ip || 'unknown',
            user_agent: req.headers['user-agent'] || 'unknown',
            endpoint: '/api/auth/logout',
        });
        res.status(200).json({
            mensaje: 'Sesión cerrada exitosamente',
        });
    }
    catch (error) {
        logger.error('Error en logout:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            mensaje: 'Error al cerrar sesión',
            codigo: 'LOGOUT_ERROR',
        });
    }
};
/**
 * POST /api/auth/request-password-reset
 *
 * Solicitar reseteo de contraseña.
 * Envía email con token de verificación.
 */
export const requestPasswordReset = async (req, res) => {
    try {
        logger.info('🔑 Password reset request');
        const { error, value } = passwordResetSchema.validate(req.body);
        if (error) {
            res.status(400).json({
                error: 'Solicitud inválida',
                codigo: 'VALIDATION_ERROR',
            });
            return;
        }
        // Buscar usuario
        const usuario = await userService.obtenerPorEmail(value.email);
        if (!usuario) {
            // No revelar si existe o no (por seguridad)
            logger.info(`Password reset request para email no registrado: ${value.email}`);
        }
        else {
            // Generar token de reseteo
            const token = authService.generateVerificationToken('reseteo_contraseña');
            const tokenHash = await authService.hashVerificationToken(token);
            // Guardar token en BD (3 horas de expiración)
            // TODO: Implementar en userService
            // Enviar email
            // TODO: Implementar sendPasswordResetEmail
            logger.info(`✓ Password reset token generado para: ${usuario.usuario_id}`);
        }
        // Respuesta genérica (no revelar si existe o no)
        res.status(200).json({
            mensaje: 'Si la cuenta existe, recibirás un email con instrucciones para resetear tu contraseña.',
        });
    }
    catch (error) {
        logger.error('Error en requestPasswordReset:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            codigo: 'PASSWORD_RESET_ERROR',
        });
    }
};
/**
 * POST /api/auth/verify-email
 *
 * Verificar email con código de 6 dígitos.
 * Body: { token: "123456", email: "user@example.com" }
 */
export const verifyEmail = async (req, res) => {
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    try {
        logger.info('✉️  Email verification request');
        const schema = Joi.object({
            token: Joi.string().length(6).required(),
            email: Joi.string().email().required(),
        });
        const { error, value } = schema.validate(req.body);
        if (error) {
            res.status(400).json({
                error: 'Solicitud inválida',
                mensaje: 'Se requiere email y código de 6 dígitos',
                codigo: 'VALIDATION_ERROR',
            });
            return;
        }
        // Validar código contra la BD
        const usuarioId = await userService.validarCodigoVerificacion(value.email, value.token);
        if (!usuarioId) {
            res.status(400).json({
                error: 'Código inválido',
                mensaje: 'El código es incorrecto o ha expirado.',
                codigo: 'INVALID_CODE',
            });
            return;
        }
        // Marcar email como verificado y limpiar código
        await userService.marcarEmailVerificado(usuarioId);
        await userService.limpiarCodigoVerificacion(usuarioId);
        // Generar tokens y crear sesión
        const usuario = await userService.obtenerPorId(usuarioId);
        if (!usuario)
            throw new Error('Usuario no encontrado tras verificación');
        const { accessToken, refreshToken, expiresIn } = await authService.generateTokens(usuario.usuario_id, usuario.email);
        const refreshTokenHash = await authService.hashRefreshToken(refreshToken);
        await sessionService.crearSesion({
            usuario_id: usuario.usuario_id,
            refresh_token_hash: refreshTokenHash,
            ip_address: ipAddress,
            user_agent: userAgent,
            tipo_dispositivo: 'web',
        });
        await auditService.registrarEvento({
            usuario_id: usuario.usuario_id,
            tipo_evento: 'email_verificado',
            resultado: 'exitoso',
            ip_address: ipAddress,
            user_agent: userAgent,
            endpoint: '/api/auth/verify-email',
        });
        logger.info(`✓ Email verificado: ${usuario.usuario_id}`);
        res.status(200).json({
            mensaje: 'Email verificado correctamente',
            accessToken,
            refreshToken,
            expiresIn,
            usuario: {
                id: usuario.usuario_id,
                email: usuario.email,
                nombre: usuario.nombre,
                emailVerificado: true,
                fechaCreacion: usuario.fecha_registro,
            },
        });
    }
    catch (error) {
        logger.error('Error en verifyEmail:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            codigo: 'EMAIL_VERIFICATION_ERROR',
        });
    }
};
/**
 * POST /api/auth/resend-verification
 *
 * Reenviar código de verificación por email.
 */
export const resendVerification = async (req, res) => {
    try {
        const { error, value } = Joi.object({
            email: Joi.string().email().required(),
        }).validate(req.body);
        if (error) {
            res.status(400).json({ error: 'Email inválido', codigo: 'VALIDATION_ERROR' });
            return;
        }
        const usuario = await userService.obtenerPorEmail(value.email);
        if (usuario && !usuario.email_verificado && usuario.es_activo) {
            const codigo = String(randomInt(100000, 999999));
            const expira = new Date(Date.now() + 15 * 60 * 1000);
            await userService.guardarCodigoVerificacion(usuario.usuario_id, codigo, expira);
            await enviarCodigoVerificacion(usuario.email, usuario.nombre, codigo);
        }
        // Respuesta genérica por seguridad
        res.status(200).json({
            mensaje: 'Si el correo existe y no está verificado, recibirás un nuevo código.',
        });
    }
    catch (error) {
        logger.error('Error en resendVerification:', error);
        res.status(500).json({ error: 'Error interno del servidor', codigo: 'RESEND_ERROR' });
    }
};
//# sourceMappingURL=auth.controller.js.map