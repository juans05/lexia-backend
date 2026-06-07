import { Request, Response } from 'express';
import { getPool } from '../config/database.js';
import logger from '../config/logger.js';

export const listarPendientesVerificacion = async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.nombre, u.email,
              json_agg(d.*) FILTER (WHERE d.doc_id IS NOT NULL) AS documentos
       FROM perfiles_abogado p
       JOIN usuarios u ON u.usuario_id = p.usuario_id
       LEFT JOIN documentos_verificacion d ON d.usuario_id = p.usuario_id
       WHERE p.estado_verificacion = 'pendiente'
       GROUP BY p.perfil_id, u.nombre, u.email
       ORDER BY p.created_at ASC`
    );
    res.json({ pendientes: rows });
  } catch (e) {
    logger.error('listarPendientesVerificacion:', e);
    res.status(500).json({ error: 'Error obteniendo pendientes' });
  }
};

export const aprobarAbogado = async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `UPDATE perfiles_abogado
       SET estado_verificacion = 'verificado',
           verificado_por = $1,
           fecha_verificacion = NOW(),
           motivo_rechazo = NULL
       WHERE usuario_id = $2
       RETURNING *`,
      [req.usuario_id, req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: 'Abogado no encontrado' }); return; }
    res.json({ perfil: rows[0] });
  } catch (e) {
    logger.error('aprobarAbogado:', e);
    res.status(500).json({ error: 'Error aprobando abogado' });
  }
};

export const rechazarAbogado = async (req: Request, res: Response): Promise<void> => {
  const { motivo_rechazo } = req.body;
  if (!motivo_rechazo) { res.status(400).json({ error: 'motivo_rechazo es requerido' }); return; }

  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `UPDATE perfiles_abogado
       SET estado_verificacion = 'rechazado',
           motivo_rechazo = $1,
           verificado_por = $2,
           fecha_verificacion = NOW()
       WHERE usuario_id = $3
       RETURNING *`,
      [motivo_rechazo, req.usuario_id, req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: 'Abogado no encontrado' }); return; }
    res.json({ perfil: rows[0] });
  } catch (e) {
    logger.error('rechazarAbogado:', e);
    res.status(500).json({ error: 'Error rechazando abogado' });
  }
};

export const promoverASelecto = async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `UPDATE perfiles_abogado
       SET puede_publicar_casos = TRUE
       WHERE usuario_id = $1 AND estado_verificacion = 'verificado'
       RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: 'Abogado verificado no encontrado' }); return; }
    res.json({ perfil: rows[0] });
  } catch (e) {
    logger.error('promoverASelecto:', e);
    res.status(500).json({ error: 'Error promoviendo abogado' });
  }
};

export const listarCasosEnRevision = async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.nombre AS nombre_abogado
       FROM casos_jurisprudencia c
       JOIN usuarios u ON u.usuario_id = c.abogado_id
       WHERE c.estado_revision = 'en_revision'
       ORDER BY c.created_at ASC`
    );
    res.json({ casos: rows });
  } catch (e) {
    logger.error('listarCasosEnRevision:', e);
    res.status(500).json({ error: 'Error obteniendo casos' });
  }
};

export const aprobarCaso = async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `UPDATE casos_jurisprudencia
       SET estado_revision = 'aprobado',
           publicado = TRUE,
           validado  = TRUE,
           revisado_por = $1,
           fecha_revision = NOW()
       WHERE caso_id = $2
       RETURNING *`,
      [req.usuario_id, req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: 'Caso no encontrado' }); return; }

    // Actualizar contador del abogado
    await pool.query(
      `UPDATE perfiles_abogado SET total_casos_publicados = total_casos_publicados + 1
       WHERE usuario_id = $1`,
      [rows[0].abogado_id]
    );

    res.json({ caso: rows[0] });
  } catch (e) {
    logger.error('aprobarCaso:', e);
    res.status(500).json({ error: 'Error aprobando caso' });
  }
};

export const rechazarCaso = async (req: Request, res: Response): Promise<void> => {
  const { motivo_rechazo } = req.body;
  if (!motivo_rechazo) { res.status(400).json({ error: 'motivo_rechazo es requerido' }); return; }

  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `UPDATE casos_jurisprudencia
       SET estado_revision = 'rechazado',
           motivo_rechazo = $1,
           revisado_por = $2,
           fecha_revision = NOW()
       WHERE caso_id = $3
       RETURNING *`,
      [motivo_rechazo, req.usuario_id, req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: 'Caso no encontrado' }); return; }
    res.json({ caso: rows[0] });
  } catch (e) {
    logger.error('rechazarCaso:', e);
    res.status(500).json({ error: 'Error rechazando caso' });
  }
};
