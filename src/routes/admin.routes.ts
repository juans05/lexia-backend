import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { esAdmin } from '../middleware/rol.middleware.js';
import {
  listarPendientesVerificacion, aprobarAbogado, rechazarAbogado, promoverASelecto,
  listarCasosEnRevision, aprobarCaso, rechazarCaso,
} from '../controllers/admin.controller.js';

const router = Router();

router.use(authMiddleware, esAdmin);

router.get('/verificaciones', listarPendientesVerificacion);
router.put('/verificaciones/:id/aprobar', aprobarAbogado);
router.put('/verificaciones/:id/rechazar', rechazarAbogado);
router.put('/abogados/:id/selecto', promoverASelecto);

router.get('/casos', listarCasosEnRevision);
router.put('/casos/:id/aprobar', aprobarCaso);
router.put('/casos/:id/rechazar', rechazarCaso);

export default router;
