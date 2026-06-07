/**
 * LexAI Perú - Users Routes
 *
 * Rutas de usuario:
 * GET /api/users/me - Obtener perfil
 * PATCH /api/users/me - Actualizar perfil
 * POST /api/users/me/change-password - Cambiar contraseña
 * DELETE /api/users/me - Eliminar cuenta
 *
 * Todas requieren autenticación
 */
import { Router } from 'express';
import { obtenerPerfil, actualizarPerfil, cambiarContrasena, eliminarCuenta, } from '../controllers/users.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
const router = Router();
// Middleware: Requiere autenticación en todas las rutas
router.use(authMiddleware);
/**
 * GET /api/users/me
 * Obtener perfil del usuario autenticado
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Response:
 * {
 *   "usuario": {
 *     "usuario_id": "uuid",
 *     "email": "usuario@example.com",
 *     "nombre": "Juan",
 *     ...
 *   },
 *   "estadisticas": {
 *     "total_consultas": 5,
 *     ...
 *   }
 * }
 */
router.get('/me', obtenerPerfil);
/**
 * PATCH /api/users/me
 * Actualizar perfil del usuario
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Body (todos opcionales):
 * {
 *   "nombre": "Juan Nuevo",
 *   "apellido": "Pérez",
 *   "telefono": "+51912345678",
 *   "nombre_empresa": "Mi Empresa",
 *   "ruc": "20123456789"
 * }
 */
router.patch('/me', actualizarPerfil);
/**
 * POST /api/users/me/change-password
 * Cambiar contraseña del usuario
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * Body:
 * {
 *   "passwordActual": "MiContraseña123",
 *   "passwordNueva": "MiNuevaContraseña456",
 *   "passwordConfirm": "MiNuevaContraseña456"
 * }
 */
router.post('/me/change-password', cambiarContrasena);
/**
 * DELETE /api/users/me
 * Eliminar cuenta del usuario (irreversible)
 *
 * Headers:
 * Authorization: Bearer <access_token>
 *
 * ADVERTENCIA: Esta acción no se puede deshacer
 */
router.delete('/me', eliminarCuenta);
export default router;
//# sourceMappingURL=users.routes.js.map