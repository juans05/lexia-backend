// @ts-nocheck
import { Request, Response } from 'express';
import { getPool } from '../config/database.js';
import logger from '../config/logger.js';

const LIMITE_CONSULTAS_GRATIS = 3;

export const validarConsultasGratis = async (req: Request, res: Response, next: any): Promise<void> => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as total FROM consultas
       WHERE usuario_id = $1 AND DATE(fecha_consulta) = CURRENT_DATE`,
      [req.usuario_id]
    );

    const consultasHoy = parseInt(rows[0].total);
    req.consultasHoy = consultasHoy;
    req.puedeConsultar = consultasHoy < LIMITE_CONSULTAS_GRATIS;

    if (!req.puedeConsultar) {
      logger.warn(`Límite alcanzado para usuario: ${req.usuario_id} (${consultasHoy}/${LIMITE_CONSULTAS_GRATIS})`);
    }

    next();
  } catch (e) {
    logger.error('validarConsultasGratis:', e);
    next();
  }
};

export const guardarConsulta = async (req: Request, res: Response): Promise<void> => {
  const { pregunta, respuesta, categoria_legal, tokens_utilizados } = req.body;

  if (!pregunta?.trim() || !respuesta?.trim()) {
    res.status(400).json({ error: 'pregunta y respuesta son requeridas' });
    return;
  }

  if (!req.usuario_id) {
    res.status(401).json({ error: 'Usuario no autenticado' });
    return;
  }

  const pool = getPool();
  try {
    // Verificar límite de consultas gratis
    const { rows: statsRows } = await pool.query(
      `SELECT COUNT(*) as total FROM consultas
       WHERE usuario_id = $1 AND DATE(fecha_consulta) = CURRENT_DATE`,
      [req.usuario_id]
    );

    const consultasHoy = parseInt(statsRows[0].total);

    if (consultasHoy >= LIMITE_CONSULTAS_GRATIS) {
      logger.warn(`Límite de ${LIMITE_CONSULTAS_GRATIS} consultas alcanzado para ${req.usuario_id}`);
      res.status(429).json({
        error: 'Límite de consultas gratuitas alcanzado',
        consultasHoy,
        limiteGratis: LIMITE_CONSULTAS_GRATIS,
        mensaje: `Has usado tus ${LIMITE_CONSULTAS_GRATIS} consultas gratuitas de hoy. Compra créditos para continuar.`
      });
      return;
    }

    // Guardar consulta
    const { rows } = await pool.query(
      `INSERT INTO consultas
        (usuario_id, pregunta, respuesta, categoria_legal, tokens_utilizados, estado, fecha_completada)
       VALUES ($1, $2, $3, $4, $5, 'completada', NOW())
       RETURNING consulta_id, fecha_consulta`,
      [req.usuario_id, pregunta.trim(), respuesta.trim(),
       categoria_legal ?? null, tokens_utilizados ?? null]
    );

    // Actualizar estadísticas
    await pool.query(
      `INSERT INTO estadísticas_usuario (usuario_id, total_consultas)
       VALUES ($1, 1)
       ON CONFLICT (usuario_id) DO UPDATE
         SET total_consultas = estadísticas_usuario.total_consultas + 1,
             fecha_actualizacion = NOW()`,
      [req.usuario_id]
    );

    logger.info(`✓ Consulta guardada: ${rows[0].consulta_id} para usuario ${req.usuario_id} (${consultasHoy + 1}/${LIMITE_CONSULTAS_GRATIS})`);

    res.status(201).json({
      consulta_id: rows[0].consulta_id,
      consultasUsadas: consultasHoy + 1,
      limiteGratis: LIMITE_CONSULTAS_GRATIS,
      mensaje: `${LIMITE_CONSULTAS_GRATIS - (consultasHoy + 1)} consultas gratis restantes`
    });
  } catch (e) {
    logger.error('guardarConsulta error:', e);
    res.status(500).json({ error: 'Error guardando consulta', detalle: (e as Error).message });
  }
};

export const getHistorialConsultas = async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  const limite = Math.min(Number(req.query.limite ?? 20), 50);
  const pagina = Number(req.query.pagina ?? 1);
  const offset = (pagina - 1) * limite;

  try {
    const { rows } = await pool.query(
      `SELECT consulta_id, pregunta, respuesta, categoria_legal,
              fecha_consulta, fecha_completada, tokens_utilizados
       FROM consultas
       WHERE usuario_id = $1 AND estado = 'completada'
       ORDER BY fecha_consulta DESC
       LIMIT $2 OFFSET $3`,
      [req.usuario_id, limite, offset]
    );

    const { rows: total } = await pool.query(
      `SELECT COUNT(*) FROM consultas WHERE usuario_id = $1 AND estado = 'completada'`,
      [req.usuario_id]
    );

    res.json({ consultas: rows, total: Number(total[0].count), pagina });
  } catch (e) {
    logger.error('getHistorialConsultas:', e);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
};
