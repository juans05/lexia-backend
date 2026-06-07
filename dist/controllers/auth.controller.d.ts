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
import { Request, Response } from 'express';
/**
 * POST /api/auth/register
 *
 * Registrar nuevo usuario en la plataforma.
 * Valida datos, crea usuario, genera tokens y sesión.
 */
export declare const register: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/auth/login
 *
 * Autenticar usuario con email y contraseña.
 * Valida credenciales, genera tokens y crea sesión.
 */
export declare const login: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/auth/refresh-token
 *
 * Renovar access token usando refresh token.
 * El cliente envía el refresh token y recibe un nuevo access token.
 */
export declare const refreshToken: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/auth/logout
 *
 * Cerrar sesión invalidando el refresh token.
 * Requiere autenticación (access token válido).
 */
export declare const logout: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/auth/request-password-reset
 *
 * Solicitar reseteo de contraseña.
 * Envía email con token de verificación.
 */
export declare const requestPasswordReset: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/auth/verify-email
 *
 * Verificar email con código de 6 dígitos.
 * Body: { token: "123456", email: "user@example.com" }
 */
export declare const verifyEmail: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/auth/resend-verification
 *
 * Reenviar código de verificación por email.
 */
export declare const resendVerification: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map