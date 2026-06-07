-- ============================================================================
-- LexAI Perú - Migración 004: Módulo de Abogados
-- ============================================================================

-- 1. Rol en usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'usuario'
    CHECK (rol IN ('usuario', 'abogado', 'admin'));

-- 2. Perfiles de abogado
CREATE TABLE IF NOT EXISTS perfiles_abogado (
  perfil_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id            UUID NOT NULL UNIQUE REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
  numero_colegiatura    VARCHAR(50) NOT NULL,
  colegio_abogados      VARCHAR(100) NOT NULL,
  especialidades        TEXT[] NOT NULL DEFAULT '{}',
  anos_experiencia      INT NOT NULL DEFAULT 0,
  bio                   TEXT,
  foto_url              VARCHAR(500),
  tarifa_consulta_soles DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  duracion_consulta_min INT NOT NULL DEFAULT 30,
  estado_verificacion   VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado_verificacion IN ('pendiente','verificado','rechazado','suspendido')),
  puede_publicar_casos  BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_rechazo        TEXT,
  verificado_por        UUID REFERENCES usuarios(usuario_id),
  fecha_verificacion    TIMESTAMPTZ,
  linkedin_url          VARCHAR(500),
  website_url           VARCHAR(500),
  total_consultas       INT NOT NULL DEFAULT 0,
  rating_promedio       DECIMAL(3,2),
  total_casos_publicados INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perfiles_estado ON perfiles_abogado (estado_verificacion);
CREATE INDEX IF NOT EXISTS idx_perfiles_tarifa ON perfiles_abogado (tarifa_consulta_soles);

-- 3. Documentos de verificación
CREATE TABLE IF NOT EXISTS documentos_verificacion (
  doc_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
  tipo_doc    VARCHAR(50) NOT NULL
    CHECK (tipo_doc IN ('carne_colegiatura','titulo_abogado','otro')),
  url_archivo VARCHAR(1000) NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  estado      VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','aprobado','rechazado')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_usuario ON documentos_verificacion (usuario_id);

-- 4. Solicitudes de consulta
CREATE TABLE IF NOT EXISTS solicitudes_consulta (
  solicitud_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
  abogado_id    UUID NOT NULL REFERENCES usuarios(usuario_id),
  origen        VARCHAR(20) NOT NULL DEFAULT 'directorio'
    CHECK (origen IN ('directorio','sugerencia_ia','perfil')),
  chat_id       VARCHAR(255),
  resumen_caso  TEXT,
  especialidad  VARCHAR(50),
  estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','aceptada','rechazada','completada','cancelada')),
  motivo_rechazo   TEXT,
  fecha_propuesta  TIMESTAMPTZ,
  fecha_confirmada TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_abogado ON solicitudes_consulta (abogado_id, estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario ON solicitudes_consulta (usuario_id);

-- 5. Sesiones de consulta
CREATE TABLE IF NOT EXISTS sesiones_consulta (
  sesion_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  solicitud_id UUID NOT NULL UNIQUE REFERENCES solicitudes_consulta(solicitud_id),
  usuario_id   UUID NOT NULL REFERENCES usuarios(usuario_id),
  abogado_id   UUID NOT NULL REFERENCES usuarios(usuario_id),
  mensajes     JSONB NOT NULL DEFAULT '[]',
  estado       VARCHAR(20) NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa','completada','cancelada')),
  rating_usuario       INT CHECK (rating_usuario BETWEEN 1 AND 5),
  comentario_usuario   TEXT,
  inicio_at    TIMESTAMPTZ,
  fin_at       TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Pagos de consulta
CREATE TABLE IF NOT EXISTS pagos_consulta (
  pago_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sesion_id            UUID NOT NULL REFERENCES sesiones_consulta(sesion_id),
  usuario_id           UUID NOT NULL REFERENCES usuarios(usuario_id),
  abogado_id           UUID NOT NULL REFERENCES usuarios(usuario_id),
  monto_total_soles    DECIMAL(10,2) NOT NULL,
  comision_lexai_soles DECIMAL(10,2) NOT NULL,
  monto_abogado_soles  DECIMAL(10,2) NOT NULL,
  metodo_pago          VARCHAR(50) NOT NULL DEFAULT 'yape'
    CHECK (metodo_pago IN ('yape','transferencia','culqi','mercadopago')),
  referencia_pago      VARCHAR(255),
  estado               VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','confirmado','reembolsado','disputa')),
  confirmado_por       UUID REFERENCES usuarios(usuario_id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Columnas extra en casos_jurisprudencia
ALTER TABLE casos_jurisprudencia
  ADD COLUMN IF NOT EXISTS abogado_id UUID REFERENCES usuarios(usuario_id),
  ADD COLUMN IF NOT EXISTS estado_revision VARCHAR(20) NOT NULL DEFAULT 'borrador'
    CHECK (estado_revision IN ('borrador','en_revision','aprobado','rechazado')),
  ADD COLUMN IF NOT EXISTS version_original TEXT,
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT,
  ADD COLUMN IF NOT EXISTS revisado_por UUID REFERENCES usuarios(usuario_id),
  ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMPTZ;

-- 8. RLS
ALTER TABLE perfiles_abogado       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_verificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_consulta    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_consulta       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_consulta          ENABLE ROW LEVEL SECURITY;

-- Perfiles: lectura pública solo si verificado
CREATE POLICY "perfil_publico_verificado" ON perfiles_abogado
  FOR SELECT TO anon, authenticated
  USING (estado_verificacion = 'verificado');

-- Documentos: solo admin (backend postgres bypasea esto)
-- sin política = nadie con anon key puede leer

-- Solicitudes: solo las partes involucradas (backend lo valida)
-- Sesiones: ídem

-- FIN MIGRACIÓN 004
