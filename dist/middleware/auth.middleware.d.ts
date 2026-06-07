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
import { Request, Response, NextFunction } from 'express';
/**
 * Extiender interfaz Request de Express para incluir usuario_id
 */
declare global {
    namespace Express {
        interface Request {
            usuario_id?: string;
            email?: string;
            token?: string;
        }
    }
}
/**
 * Middleware principal de autenticación
 *
 * Protege endpoints que requieren usuario autenticado.
 * Valida JWT y adjunta usuario_id al request.
 */
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware opcional: Intenta autenticar pero no requiere token
 *
 * Útil para endpoints que funcionan tanto para usuarios autenticados
 * como no autenticados (ej: para personalizar respuesta)
 */
export declare const optionalAuthMiddleware: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware: Validar refresh token
 *
 * Similar a authMiddleware pero para refresh tokens que tienen otra secret key
 * Usado en endpoint POST /api/auth/refresh-token
 */
export declare const refreshTokenMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const authRateLimitMiddleware: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Limpiar intentos antiguos periódicamente
 * Evitar que el Map crezca infinitamente
 */
export declare function inicializarLimpiezaLoginAttempts(): void;
//# sourceMappingURL=auth.middleware.d.ts.map