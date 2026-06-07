-- ============================================================================
-- LexAI Perú - Migración 002: pgvector para RAG semántico
-- Reemplaza Pinecone con búsqueda vectorial nativa en PostgreSQL
-- ============================================================================

-- Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- TABLA: documentos_legales
-- Almacena leyes peruanas con embeddings para búsqueda semántica
-- ============================================================================
CREATE TABLE IF NOT EXISTS documentos_legales (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fuente      VARCHAR(255) NOT NULL,           -- "Código del Trabajo Peruano"
    articulo    VARCHAR(255) NOT NULL,           -- "Art. 34"
    contenido   TEXT NOT NULL,                  -- Texto completo del artículo
    categoria   VARCHAR(100),                   -- "despido_nulo", "herencia"
    especialidad VARCHAR(50),                   -- "laboral", "civil", "mercantil"
    embedding   vector(768),                   -- OpenAI text-embedding-3-small
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índice HNSW para búsqueda coseno (más rápido que ivfflat para < 1M vectores)
CREATE INDEX IF NOT EXISTS idx_documentos_embedding
    ON documentos_legales
    USING hnsw (embedding vector_cosine_ops);

-- Índice normal para filtrar por especialidad
CREATE INDEX IF NOT EXISTS idx_documentos_especialidad
    ON documentos_legales (especialidad);

-- ============================================================================
-- TABLA: casos_jurisprudencia (Fase 2 - red de abogados)
-- Casos reales anonimizados publicados por abogados
-- ============================================================================
CREATE TABLE IF NOT EXISTS casos_jurisprudencia (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    abogado_id              UUID,               -- FK a abogados (Fase 2)
    titulo                  VARCHAR(255) NOT NULL,
    descripcion             TEXT NOT NULL,
    especialidad            VARCHAR(50),
    tipo_sentencia          VARCHAR(50),        -- "favorable", "desfavorable", "transaccion"
    tribunal                VARCHAR(255),
    ano_sentencia           INT,
    hechos_json             JSONB,
    resultado_descripcion   TEXT,
    monto_indemnizacion     DECIMAL(10,2),
    embedding               vector(768),       -- Para RAG de jurisprudencia
    validado                BOOLEAN DEFAULT FALSE,
    publicado               BOOLEAN DEFAULT FALSE,
    datos_anonimizados      BOOLEAN DEFAULT TRUE,
    vistas                  INT DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casos_embedding
    ON casos_jurisprudencia
    USING hnsw (embedding vector_cosine_ops)
    WHERE publicado = TRUE AND validado = TRUE;

CREATE INDEX IF NOT EXISTS idx_casos_especialidad
    ON casos_jurisprudencia (especialidad)
    WHERE publicado = TRUE;

-- FIN DE MIGRACIÓN 002
