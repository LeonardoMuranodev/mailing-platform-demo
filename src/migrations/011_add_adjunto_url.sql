-- ============================================================
-- Migración 011: Añadir adjunto_url a la tabla campanas
-- ============================================================

ALTER TABLE campanas ADD COLUMN IF NOT EXISTS adjunto_url text;
