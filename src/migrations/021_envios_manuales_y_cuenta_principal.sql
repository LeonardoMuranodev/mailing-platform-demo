-- ============================================================
-- Migración 021: Envíos manuales y cuenta emisora principal
-- ============================================================

-- 1. Columnas es_principal y es_exclusiva en cuentas_smtp
ALTER TABLE cuentas_smtp 
  ADD COLUMN IF NOT EXISTS es_principal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_exclusiva BOOLEAN DEFAULT false;

-- 2. Asegurar que al menos una cuenta activa esté marcada como principal si existen cuentas
UPDATE cuentas_smtp 
SET es_principal = true 
WHERE id = (
  SELECT id FROM cuentas_smtp 
  WHERE estado = 'activo' 
  ORDER BY creado_en ASC 
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM cuentas_smtp WHERE es_principal = true);

-- 3. Columnas en campanas para soporte de audiencias manuales y fijación de emisor
ALTER TABLE campanas 
  ADD COLUMN IF NOT EXISTS tipo_audiencia VARCHAR(20) DEFAULT 'rubros',
  ADD COLUMN IF NOT EXISTS destinatarios_manuales JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cuenta_emisor_id UUID REFERENCES cuentas_smtp(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campanas_tipo_audiencia ON campanas(tipo_audiencia);
CREATE INDEX IF NOT EXISTS idx_campanas_cuenta_emisor_id ON campanas(cuenta_emisor_id);
