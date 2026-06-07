/**
 * LexAI Perú - Index
 *
 * Re-exports principales para facilitar imports en la aplicación
 *
 * Uso:
 *   import { authService, logger } from './index';
 */
// Config
export { default as config } from './config/env.js';
export { inicializarPool, getPool, verificarConexion } from './config/database.js';
export { getRedisClient, estaRedisDisponible } from './config/redis.js';
export { default as logger } from './config/logger.js';
// Services
export { authService, AuthService } from './services/auth.service.js';
export { userService, UserService } from './services/user.service.js';
export { sessionService, SessionService } from './services/session.service.js';
export { auditService, AuditService } from './services/audit.service.js';
// Middleware
export { authMiddleware, optionalAuthMiddleware, refreshTokenMiddleware, authRateLimitMiddleware, } from './middleware/auth.middleware.js';
// Controllers
export * as authController from './controllers/auth.controller.js';
export * as usersController from './controllers/users.controller.js';
// Utilities
export * from './utilities/validators.js';
//# sourceMappingURL=index.js.map