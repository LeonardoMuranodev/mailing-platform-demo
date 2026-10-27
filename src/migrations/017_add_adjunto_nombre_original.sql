-- ============================================================
-- Migración 017: Agregar columna adjunto_nombre_original a campanas
-- ============================================================

ALTER TABLE campanas ADD COLUMN IF NOT EXISTS adjunto_nombre_original text;
