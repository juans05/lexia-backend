/**
 * LexAI Perú - Authentication Routes
 *
 * Rutas de autenticación:
 * POST /api/auth/register - Registrar nuevo usuario
 * POST /api/auth/login - Login
 * POST /api/auth/refresh-token - Renovar token
 * POST /api/auth/logout - Logout
 */
import { Router } from 'express';
import { register, login, refreshToken, logout, requestPasswordReset, verifyEmail, resendVerification, } from '../controllers/auth.controller.js';
import { authRateLimitMiddleware, refreshTokenMiddleware, authMiddleware, } from '../middleware/auth.middleware.js';
const router = Router();
/**
 * POST /api/auth/register
 * Registrar nuevo usuario
 *
 * Body:
 * {
 *   "email": "usuario@example.com",
 *   "password": "MiContraseña123",
 *   "nombre": "Juan",
 *   "apellido": "Pérez",
 *   "telefono": "+51912345678"
 * }
 */
router.post('/register', authRateLimitMiddleware, register);
/**
 * POST /api/auth/login
 * Autenticarse con email y contraseña
 *
 * Body:
 * {
 *   "email": "usuario@example.com",
 *   "password": "MiContraseña123"
 * }
 */
router.post('/login', authRateLimitMiddleware, login);
/**
 * POST /api/auth/refresh-token
 * Renovar access token usando refresh token
 *
 * Body:
 * {
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
 * }
 */
router.post('/refresh-token', refreshTokenMiddleware, refreshToken);
/**
 * POST /api/auth/logout
 * Cerrar sesión
 *
 * Headers:
 * Authorization: Bearer <access_token>
 */
router.post('/logout', authMiddleware, logout);
/**
 * POST /api/auth/request-password-reset
 * Solicitar reseteo de contraseña
 *
 * Body:
 * {
 *   "email": "usuario@example.com"
 * }
 */
router.post('/request-password-reset', authRateLimitMiddleware, requestPasswordReset);
/**
 * POST /api/auth/verify-email
 * Verificar email con token
 *
 * Body:
 * {
 *   "token": "abc123xyz..."
 * }
 */
router.post('/verify-email', authRateLimitMiddleware, verifyEmail);
router.post('/resend-verification', authRateLimitMiddleware, resendVerification);
export default router;
//# sourceMappingURL=auth.routes.js.map