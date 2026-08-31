-- ============================================================
-- Migración 006: Analíticas y Tracking (Open y Click)
-- ============================================================

ALTER TABLE cola_envios ADD COLUMN IF NOT EXISTS fecha_apertura TIMESTAMPTZ;
ALTER TABLE cola_envios ADD COLUMN IF NOT EXISTS fecha_click TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cola_envios_apertura ON cola_envios(fecha_apertura);
CREATE INDEX IF NOT EXISTS idx_cola_envios_click ON cola_envios(fecha_click);
