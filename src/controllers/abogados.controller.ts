import { Request, Response } from 'express';
import { getPool } from '../config/database.js';
import logger from '../config/logger.js';

// ─── REGISTRO Y PERFIL ───────────────────────────────────────────────────────

export const registrarAbogado = async (req: Request, res: Response): Promise<void> => {
  const usuario_id = req.usuario_id!;
  const {
    numero_colegiatura, colegio_abogados, especialidades,
    anos_experiencia, bio, tarifa_consulta_soles,
    duracion_consulta_min, linkedin_url, website_url,
  } = req.body;

  if (!numero_colegiatura || !colegio_abogados || !especialidades?.length) {
    res.status(400).json({ error: 'Campos requeridos: numero_colegiatura, colegio_abogados, especialidades' });
    return;
  }

  const pool = getPool();
  try {
    // Cambiar rol del usuario a abogado
    await pool.query(
      `UPDATE usuarios SET rol = 'abogado' WHERE usuario_id = $1`,
      [usuario_id]
    );

    const { rows } = await pool.query(
      `INSERT INTO perfiles_abogado
        (usuario_id, numero_colegiatura, colegio_abogados, especialidades,
         anos_experiencia, bio, tarifa_consulta_soles, duracion_consulta_min,
         linkedin_url, website_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (usuario_id) DO UPDATE SET
         numero_colegiatura = EXCLUDED.numero_colegiatura,
         colegio_abogados   = EXCLUDED.colegio_abogados,
         especialidades     = EXCLUDED.especialidades,
         anos_experiencia   = EXCLUDED.anos_experiencia,
         bio                = EXCLUDED.bio,
         tarifa_consulta_soles = EXCLUDED.tarifa_consulta_soles,
         duracion_consulta_min = EXCLUDED.duracion_consulta_min,
         linkedin_url       = EXCLUDED.linkedin_url,
         website_url        = EXCLUDED.website_url,
         updated_at         = NOW()
       RETURNING *`,
      [usuario_id, numero_colegiatura, colegio_abogados, especialidades,
       anos_experiencia ?? 0, bio ?? null, tarifa_consulta_soles ?? 50,
       duracion_consulta_min ?? 30, linkedin_url ?? null, website_url ?? null]
    );

    res.status(201).json({ perfil: rows[0] });
  } catch (e) {
    logger.error('registrarAbogado:', e);
    res.status(500).json({ error: 'Error creando perfil de abogado' });
  }
};

export const getMiPerfil = async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.nombre, u.email
       FROM perfiles_abogado p
       JOIN usuarios u ON u.usuario_id = p.usuario_id
       WHERE p.usuario_id = $1`,
      [req.usuario_id]
    );
    if (!rows.length) { res.status(404).json({ error: 'Perfil no encontrado' }); return; }
    res.json({ perfil: rows[0] });
  } catch (e) {
    logger.error('getMiPerfil:', e);
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
};

export const actualizarMiPerfil = async (req: Request, res: Response): Promise<void> => {
  const campos = ['bio','tarifa_consulta_soles','duracion_consulta_min',
                  'linkedin_url','website_url','especialidades','anos_experiencia','foto_url'];
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const campo of campos) {
    if (req.body[campo] !== undefined) {
      updates.push(`${campo} = $${idx++}`);
      values.push(req.body[campo]);
    }
  }

  if (!updates.length) { res.status(400).json({ error: 'Nada que actualizar' }); return; }

  values.push(req.usuario_id);
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `UPDATE perfiles_abogado SET ${updates.join(', ')}, updated_at = NOW()
       WHERE usuario_id = $${idx} RETURNING *`,
      values
    );
    res.json({ perfil: rows[0] });
  } catch (e) {
    logger.error('actualizarMiPerfil:', e);
    res.status(500).json({ error: 'Error actualizando perfil' });
  }
};

// ─── DIRECTORIO PÚBLICO ───────────────────────────────────────────────────────

export const listarAbogados = async (req: Request, res: Response): Promise<void> => {
  const { especialidad, precio_max, orden = 'rating', pagina = '1', limite = '12' } = req.query;
  const pool = getPool();

  const conditions = [`p.estado_verificacion = 'verificado'`];
  const values: any[] = [];
  let idx = 1;

  if (especialidad) {
    conditions.push(`$${idx++} = ANY(p.especialidades)`);
    values.push(especialidad);
  }
  if (precio_max) {
    conditions.push(`p.tarifa_consulta_soles <= $${idx++}`);
    values.push(Number(precio_max));
  }

  const orderMap: Record<string, string> = {
    rating: 'p.rating_promedio DESC NULLS LAST',
    precio: 'p.tarifa_consulta_soles ASC',
    consultas: 'p.total_consultas DESC',
  };
  const orderBy = orderMap[orden as string] ?? orderMap.rating;

  const offset = (Number(pagina) - 1) * Number(limite);
  values.push(Number(limite), offset);

  try {
    const { rows } = await pool.query(
      `SELECT p.perfil_id, p.usuario_id, u.nombre, p.especialidades, p.bio,
              p.tarifa_consulta_soles, p.duracion_consulta_min, p.foto_url,
              p.anos_experiencia, p.rating_promedio, p.total_consultas,
              p.linkedin_url, p.colegio_abogados
       FROM perfiles_abogado p
       JOIN usuarios u ON u.usuario_id = p.usuario_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${idx++} OFFSET $${idx}`,
      values
    );

    const { rows: total } = await pool.query(
      `SELECT COUNT(*) FROM perfiles_abogado p
       WHERE ${conditions.join(' AND ')}`,
      values.slice(0, -2)
    );

    res.json({ abogados: rows, total: Number(total[0].count), pagina: Number(pagina) });
  } catch (e) {
    logger.error('listarAbogados:', e);
    res.status(500).json({ error: 'Error listando abogados' });
  }
};

export const getPerfilPublico = async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.nombre
       FROM perfiles_abogado p
       JOIN usuarios u ON u.usuario_id = p.usuario_id
       WHERE p.usuario_id = $1 AND p.estado_verificacion = 'verificado'`,
      [req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: 'Abogado no encontrado' }); return; }

    // Casos publicados
    const { rows: casos } = await pool.query(
      `SELECT caso_id, titulo, descripcion, especialidad, tipo_sentencia, ano_sentencia, resultado_descripcion
       FROM casos_jurisprudencia
       WHERE abogado_id = $1 AND publicado = true AND validado = true
       ORDER BY created_at DESC LIMIT 10`,
      [req.params.id]
    );

    res.json({ perfil: rows[0], casos });
  } catch (e) {
    logger.error('getPerfilPublico:', e);
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
};

// ─── SOLICITUDES ─────────────────────────────────────────────────────────────

export const crearSolicitud = async (req: Request, res: Response): Promise<void> => {
  const { abogado_id, resumen_caso, especialidad, origen = 'directorio', chat_id } = req.body;
  if (!abogado_id || !resumen_caso) {
    res.status(400).json({ error: 'abogado_id y resumen_caso son requeridos' });
    return;
  }

  const pool = getPool();
  try {
    // Verificar que el abogado existe y está verificado
    const { rows: abogado } = await pool.query(
      `SELECT perfil_id FROM perfiles_abogado WHERE usuario_id = $1 AND estado_verificacion = 'verificado'`,
      [abogado_id]
    );
    if (!abogado.length) { res.status(404).json({ error: 'Abogado no disponible' }); return; }

    const { rows } = await pool.query(
      `INSERT INTO solicitudes_consulta (usuario_id, abogado_id, resumen_caso, especialidad, origen, chat_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.usuario_id, abogado_id, resumen_caso, especialidad ?? null, origen, chat_id ?? null]
    );
    res.status(201).json({ solicitud: rows[0] });
  } catch (e) {
    logger.error('crearSolicitud:', e);
    res.status(500).json({ error: 'Error creando solicitud' });
  }
};

export const getMisSolicitudesUsuario = async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.nombre AS nombre_abogado, p.foto_url, p.especialidades
       FROM solicitudes_consulta s
       JOIN usuarios u ON u.usuario_id = s.abogado_id
       JOIN perfiles_abogado p ON p.usuario_id = s.abogado_id
       WHERE s.usuario_id = $1
       ORDER BY s.created_at DESC`,
      [req.usuario_id]
    );
    res.json({ solicitudes: rows });
  } catch (e) {
    logger.error('getMisSolicitudesUsuario:', e);
    res.status(500).json({ error: 'Error obteniendo solicitudes' });
  }
};

export const getMisSolicitudesAbogado = async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.nombre AS nombre_usuario, u.email AS email_usuario
       FROM solicitudes_consulta s
       JOIN usuarios u ON u.usuario_id = s.usuario_id
       WHERE s.abogado_id = $1
       ORDER BY s.created_at DESC`,
      [req.usuario_id]
    );
    res.json({ solicitudes: rows });
  } catch (e) {
    logger.error('getMisSolicitudesAbogado:', e);
    res.status(500).json({ error: 'Error obteniendo solicitudes' });
  }
};

export const responderSolicitud = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { accion, motivo_rechazo, fecha_propuesta } = req.body;

  if (!['aceptar', 'rechazar'].includes(accion)) {
    res.status(400).json({ error: 'accion debe ser aceptar o rechazar' });
    return;
  }

  const pool = getPool();
  try {
    const nuevoEstado = accion === 'aceptar' ? 'aceptada' : 'rechazada';
    const { rows } = await pool.query(
      `UPDATE solicitudes_consulta
       SET estado = $1, motivo_rechazo = $2, fecha_propuesta = $3, updated_at = NOW()
       WHERE solicitud_id = $4 AND abogado_id = $5
       RETURNING *`,
      [nuevoEstado, motivo_rechazo ?? null, fecha_propuesta ?? null, id, req.usuario_id]
    );
    if (!rows.length) { res.status(404).json({ error: 'Solicitud no encontrada' }); return; }

    // Si se acepta, crear sesión de consulta
    if (accion === 'aceptar') {
      await pool.query(
        `INSERT INTO sesiones_consulta (solicitud_id, usuario_id, abogado_id, inicio_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (solicitud_id) DO NOTHING`,
        [id, rows[0].usuario_id, req.usuario_id]
      );
    }

    res.json({ solicitud: rows[0] });
  } catch (e) {
    logger.error('responderSolicitud:', e);
    res.status(500).json({ error: 'Error respondiendo solicitud' });
  }
};

// ─── SESIÓN (CHAT USUARIO-ABOGADO) ───────────────────────────────────────────

export const getSesion = async (req: Request, res: Response): Promise<void> => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT s.*, ua.nombre AS nombre_abogado, uu.nombre AS nombre_usuario
       FROM sesiones_consulta s
       JOIN usuarios ua ON ua.usuario_id = s.abogado_id
       JOIN usuarios uu ON uu.usuario_id = s.usuario_id
       WHERE s.sesion_id = $1
         AND (s.usuario_id = $2 OR s.abogado_id = $2)`,
      [req.params.id, req.usuario_id]
    );
    if (!rows.length) { res.status(404).json({ error: 'Sesión no encontrada' }); return; }
    res.json({ sesion: rows[0] });
  } catch (e) {
    logger.error('getSesion:', e);
    res.status(500).json({ error: 'Error obteniendo sesión' });
  }
};

export const enviarMensajeSesion = async (req: Request, res: Response): Promise<void> => {
  const { contenido } = req.body;
  if (!contenido?.trim()) { res.status(400).json({ error: 'Mensaje vacío' }); return; }

  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `UPDATE sesiones_consulta
       SET mensajes = mensajes || $1::jsonb
       WHERE sesion_id = $2 AND estado = 'activa'
         AND (usuario_id = $3 OR abogado_id = $3)
       RETURNING *`,
      [
        JSON.stringify([{ rol: req.rol, autor_id: req.usuario_id, contenido, timestamp: new Date().toISOString() }]),
        req.params.id, req.usuario_id
      ]
    );
    if (!rows.length) { res.status(404).json({ error: 'Sesión no encontrada o cerrada' }); return; }
    res.json({ sesion: rows[0] });
  } catch (e) {
    logger.error('enviarMensajeSesion:', e);
    res.status(500).json({ error: 'Error enviando mensaje' });
  }
};

export const completarSesion = async (req: Request, res: Response): Promise<void> => {
  const { rating, comentario } = req.body;
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `UPDATE sesiones_consulta
       SET estado = 'completada', fin_at = NOW(),
           rating_usuario = $1, comentario_usuario = $2
       WHERE sesion_id = $3 AND usuario_id = $4 AND estado = 'activa'
       RETURNING *`,
      [rating ?? null, comentario ?? null, req.params.id, req.usuario_id]
    );
    if (!rows.length) { res.status(404).json({ error: 'Sesión no encontrada' }); return; }

    // Actualizar rating promedio del abogado
    await pool.query(
      `UPDATE perfiles_abogado SET
         rating_promedio = (SELECT AVG(rating_usuario) FROM sesiones_consulta
                            WHERE abogado_id = $1 AND rating_usuario IS NOT NULL),
         total_consultas = total_consultas + 1
       WHERE usuario_id = $1`,
      [rows[0].abogado_id]
    );

    res.json({ sesion: rows[0] });
  } catch (e) {
    logger.error('completarSesion:', e);
    res.status(500).json({ error: 'Error completando sesión' });
  }
};
