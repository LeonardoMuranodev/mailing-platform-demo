-- ============================================================
-- Migración 022: Deduplicación e índice único en cola de envíos
-- ============================================================

DELETE FROM cola_envios a
USING cola_envios b
WHERE a.id > b.id
  AND a.campana_id = b.campana_id
  AND a.contacto_id = b.contacto_id
  AND a.estado = 'pendiente';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cola_envios_campana_contacto
ON cola_envios (campana_id, contacto_id);
