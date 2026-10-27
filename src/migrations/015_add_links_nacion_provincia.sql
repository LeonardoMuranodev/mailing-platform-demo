-- ============================================================
-- Migración 015: Añadir links_nacion y links_provincia a campañas
-- ============================================================

ALTER TABLE campanas 
ADD COLUMN IF NOT EXISTS link_nacion text,
ADD COLUMN IF NOT EXISTS link_provincia text;
