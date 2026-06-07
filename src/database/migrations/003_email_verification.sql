-- ============================================================================
-- LexAI Perú - Migración 003: Campos para verificación de email
-- ============================================================================

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS codigo_verificacion VARCHAR(6),
ADD COLUMN IF NOT EXISTS codigo_verificacion_expira TIMESTAMPTZ;
