import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { esAbogado } from '../middleware/rol.middleware.js';
import {
  registrarAbogado, getMiPerfil, actualizarMiPerfil,
  listarAbogados, getPerfilPublico,
  crearSolicitud, getMisSolicitudesUsuario, getMisSolicitudesAbogado, responderSolicitud,
  getSesion, enviarMensajeSesion, completarSesion,
} from '../controllers/abogados.controller.js';

const router = Router();

// Directorio público (sin auth)
router.get('/', listarAbogados);
router.get('/:id', getPerfilPublico);

// Registro y perfil propio (requiere auth)
router.post('/registro', authMiddleware, registrarAbogado);
router.get('/mi-perfil', authMiddleware, getMiPerfil);
router.put('/mi-perfil', authMiddleware, actualizarMiPerfil);

// Solicitudes desde el lado del usuario
router.post('/solicitudes', authMiddleware, crearSolicitud);
router.get('/mis-solicitudes', authMiddleware, getMisSolicitudesUsuario);

// Solicitudes desde el lado del abogado
router.get('/abogado/solicitudes', authMiddleware, esAbogado, getMisSolicitudesAbogado);
router.put('/abogado/solicitudes/:id', authMiddleware, esAbogado, responderSolicitud);

// Sesiones de consulta
router.get('/sesiones/:id', authMiddleware, getSesion);
router.post('/sesiones/:id/mensaje', authMiddleware, enviarMensajeSesion);
router.put('/sesiones/:id/completar', authMiddleware, completarSesion);

export default router;
