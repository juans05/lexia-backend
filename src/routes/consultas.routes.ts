import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { guardarConsulta, getHistorialConsultas, validarConsultasGratis } from '../controllers/consultas.controller.js';

const router = Router();

router.use(authMiddleware);

// POST para guardar consulta - valida límite de 3 gratis
router.post('/', guardarConsulta);

// GET historial
router.get('/historial', getHistorialConsultas);

// GET estado de consultas de hoy
router.get('/estado', async (req, res) => {
  const { getPool } = await import('../config/database.js');
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as total FROM consultas
       WHERE usuario_id = $1 AND DATE(fecha_consulta) = CURRENT_DATE`,
      [req.usuario_id]
    );
    res.json({
      consultasHoy: parseInt(rows[0].total),
      limiteGratis: 3,
      puedeConsultar: parseInt(rows[0].total) < 3
    });
  } catch (e) {
    res.status(500).json({ error: 'Error consultando estado' });
  }
});

export default router;
