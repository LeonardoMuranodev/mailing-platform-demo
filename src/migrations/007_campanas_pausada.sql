-- ============================================================
-- Migración 007: Agregar estado 'pausada' a campañas
-- ============================================================

ALTER TABLE campanas DROP CONSTRAINT IF EXISTS campanas_estado_check;
ALTER TABLE campanas ADD CONSTRAINT campanas_estado_check CHECK (estado IN ('borrador', 'aprobada', 'en_proceso', 'pausada', 'completada', 'cancelada'));
