-- ============================================================
-- Migración 016: Permitir campos nulos para borradores
-- ============================================================

ALTER TABLE campanas ALTER COLUMN cuerpo_html DROP NOT NULL;
ALTER TABLE campanas ALTER COLUMN fecha_limite_envio DROP NOT NULL;
