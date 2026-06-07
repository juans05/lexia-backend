/**
 * LexAI Perú - Authentication Middleware
 *
 * Middleware Express que valida tokens JWT en requests.
 * Protege endpoints que requieren autenticación.
 *
 * Uso:
 *   app.get('/api/protected', authMiddleware, controllerFunction)
 *
 * Flujo:
 * 1. Obtiene token del header Authorization
 * 2. Valida estructura y firma del token
 * 3. Adjunta usuario_id a req.usuario_id para usar en handlers
 * 4. Devuelve 401 si token es inválido o expirado
 */
import { authService, extractBearerToken, isValidJWTStructure } from '../services/auth.service.js';
import logger from '../config/logger.js';
/**
 * Middleware principal de autenticación
 *
 * Protege endpoints que requieren usuario autenticado.
 * Valida JWT y adjunta usuario_id al request.
 */
export const authMiddleware = (req, res, next) => {
    try {
        // Paso 1: Obtener header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            logger.warn('❌ Request sin Authorization header');
            res.status(401).json({
                error: 'No autorizado',
                mensaje: 'Token de acceso requerido',
                codigo: 'AUTH_MISSING',
            });
            return;
        }
        // Paso 2: Extraer token del header "Bearer <token>"
        let token;
        try {
            token = extractBearerToken(authHeader);
        }
        catch (error) {
            logger.warn(`❌ Authorization header inválido: ${error}`);
            res.status(401).json({
                error: 'No autorizado',
                mensaje: 'Formato de token inválido',
                codigo: 'INVALID_TOKEN_FORMAT',
            });
            return;
        }
        // Paso 3: Validar estructura básica
        if (!isValidJWTStructure(token)) {
            logger.warn('❌ Estructura de JWT inválida');
            res.status(401).json({
                error: 'No autorizado',
                mensaje: 'Token inválido',
                codigo: 'INVALID_TOKEN',
            });
            return;
        }
        // Paso 4: Verificar y decodificar token
        let decoded;
        try {
            decoded = authService.verifyToken(token, false);
        }
        catch (error) {
            const mensaje = error instanceof Error && error.message === 'Token expirado'
                ? 'Token expirado. Use el refresh token para obtener uno nuevo.'
                : 'Token inválido o expirado';
            logger.warn(`❌ Token verification failed: ${error}`);
            res.status(401).json({
                error: 'No autorizado',
                mensaje,
                codigo: 'TOKEN_VERIFICATION_FAILED',
            });
            return;
        }
        // Paso 5: Adjuntar usuario_id al request
        req.usuario_id = decoded.usuario_id;
        req.email = decoded.email;
        req.token = token;
        logger.debug(`✓ Auth successful for user: ${decoded.usuario_id}`);
        // Pasar al siguiente middleware
        next();
    }
    catch (error) {
        logger.error('Error inesperado en authMiddleware:', error);
        res.status(500).json({
            error: 'Error interno',
            mensaje: 'Error durante validación de autenticación',
            codigo: 'AUTH_ERROR',
        });
    }
};
/**
 * Middleware opcional: Intenta autenticar pero no requiere token
 *
 * Útil para endpoints que funcionan tanto para usuarios autenticados
 * como no autenticados (ej: para personalizar respuesta)
 */
export const optionalAuthMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            // Sin token es permitido, continuar
            next();
            return;
        }
        try {
            const token = extractBearerToken(authHeader);
            if (!isValidJWTStructure(token)) {
                // Token inválido pero no es requerido, continuar sin autenticación
                next();
                return;
            }
            const decoded = authService.verifyToken(token, false);
            req.usuario_id = decoded.usuario_id;
            req.email = decoded.email;
            logger.debug(`✓ Optional auth for user: ${decoded.usuario_id}`);
        }
        catch (error) {
            // Token inválido pero no es requerido, continuar
            logger.debug('Optional auth skipped due to invalid token');
        }
        next();
    }
    catch (error) {
        logger.error('Error en optionalAuthMiddleware:', error);
        next(); // Continuar incluso con error
    }
};
/**
 * Middleware: Validar refresh token
 *
 * Similar a authMiddleware pero para refresh tokens que tienen otra secret key
 * Usado en endpoint POST /api/auth/refresh-token
 */
export const refreshTokenMiddleware = (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken || typeof refreshToken !== 'string') {
            logger.warn('❌ Refresh token missing or invalid format');
            res.status(400).json({
                error: 'Solicitud inválida',
                mensaje: 'Refresh token requerido en body',
                codigo: 'REFRESH_TOKEN_MISSING',
            });
            return;
        }
        // Validar estructura
        if (!isValidJWTStructure(refreshToken)) {
            res.status(401).json({
                error: 'No autorizado',
                mensaje: 'Refresh token inválido',
                codigo: 'INVALID_REFRESH_TOKEN',
            });
            return;
        }
        // Verificar refresh token (usa diferente secret key)
        let decoded;
        try {
            decoded = authService.verifyToken(refreshToken, true);
        }
        catch (error) {
            res.status(401).json({
                error: 'No autorizado',
                mensaje: 'Refresh token inválido o expirado',
                codigo: 'REFRESH_TOKEN_VERIFICATION_FAILED',
            });
            return;
        }
        // Adjuntar información al request
        req.usuario_id = decoded.usuario_id;
        req.email = decoded.email;
        req.token = refreshToken;
        logger.debug(`✓ Refresh token validated for user: ${decoded.usuario_id}`);
        next();
    }
    catch (error) {
        logger.error('Error en refreshTokenMiddleware:', error);
        res.status(500).json({
            error: 'Error interno',
            mensaje: 'Error durante validación de refresh token',
            codigo: 'REFRESH_TOKEN_ERROR',
        });
    }
};
/**
 * Middleware de rate limiting para endpoints de autenticación
 *
 * Prevenir brute force attacks en login y register
 * Usa Map simple (en producción usar Redis)
 */
const loginAttempts = new Map();
const ATTEMPT_LIMIT = 5; // Máximo 5 intentos
const ATTEMPT_WINDOW = 15 * 60 * 1000; // Ventana de 15 minutos
export const authRateLimitMiddleware = (req, res, next) => {
    try {
        const identificador = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const ahora = Date.now();
        let intentos = loginAttempts.get(identificador);
        // Si no hay intentos previos o la ventana expiró, crear nuevo contador
        if (!intentos || ahora - intentos.lastAttempt > ATTEMPT_WINDOW) {
            loginAttempts.set(identificador, { count: 1, lastAttempt: ahora });
            next();
            return;
        }
        // Incrementar contador
        intentos.count++;
        intentos.lastAttempt = ahora;
        // Si excede límite
        if (intentos.count > ATTEMPT_LIMIT) {
            logger.warn(`🚫 Too many auth attempts from IP: ${identificador}. Count: ${intentos.count}`);
            res.status(429).json({
                error: 'Demasiados intentos',
                mensaje: 'Ha excedido el límite de intentos. Intente más tarde.',
                codigo: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil((ATTEMPT_WINDOW - (ahora - intentos.lastAttempt)) / 1000),
            });
            return;
        }
        next();
    }
    catch (error) {
        logger.error('Error en authRateLimitMiddleware:', error);
        next(); // Permitir pasar aunque falle el rate limit
    }
};
/**
 * Limpiar intentos antiguos periódicamente
 * Evitar que el Map crezca infinitamente
 */
export function inicializarLimpiezaLoginAttempts() {
    setInterval(() => {
        const ahora = Date.now();
        let limpiados = 0;
        for (const [key, valor] of loginAttempts.entries()) {
            if (ahora - valor.lastAttempt > ATTEMPT_WINDOW) {
                loginAttempts.delete(key);
                limpiados++;
            }
        }
        if (limpiados > 0) {
            logger.debug(`🧹 Cleaned up ${limpiados} old login attempt records`);
        }
    }, 5 * 60 * 1000); // Cada 5 minutos
}
//# sourceMappingURL=auth.middleware.js.map