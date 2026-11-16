-- ============================================================
-- Migración 023: Separación de contactos base y destinatarios manuales
-- ============================================================

ALTER TABLE contactos 
  ADD COLUMN IF NOT EXISTS es_contacto_base BOOLEAN DEFAULT true;

UPDATE contactos 
SET es_contacto_base = false 
WHERE empresa_nombre = 'Destinatario Manual' OR rubro_id = 'manual';

CREATE INDEX IF NOT EXISTS idx_contactos_base_estado 
ON contactos(es_contacto_base, estado);

DELETE FROM cola_envios ce
USING campanas c, contactos ct
WHERE ce.campana_id = c.id
  AND ce.contacto_id = ct.id
  AND c.tipo_audiencia != 'manual'
  AND ct.es_contacto_base = false
  AND ce.estado = 'pendiente';
