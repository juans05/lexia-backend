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
import { Request, Response } from 'express';
/**
 * GET /api/users/me
 *
 * Obtener perfil del usuario autenticado
 * Requiere: Access Token válido
 */
export declare const obtenerPerfil: (req: Request, res: Response) => Promise<void>;
/**
 * PATCH /api/users/me
 *
 * Actualizar perfil del usuario
 * Requiere: Access Token válido
 */
export declare const actualizarPerfil: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/users/me/change-password
 *
 * Cambiar contraseña del usuario
 * Requiere: Access Token válido y contraseña actual correcta
 */
export declare const cambiarContrasena: (req: Request, res: Response) => Promise<void>;
/**
 * DELETE /api/users/me
 *
 * Eliminar cuenta de usuario (borrado lógico)
 * ADVERTENCIA: Esta acción es irreversible
 * Requiere: Access Token válido
 */
export declare const eliminarCuenta: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=users.controller.d.ts.map