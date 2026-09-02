-- ============================================================
-- Migración 009: Tabla empresas + Soft Delete en campañas
-- Fecha: 2026-09-02
-- ============================================================

-- 1. Tabla de Empresas
CREATE TABLE IF NOT EXISTS empresas (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre         TEXT NOT NULL,
  cuit           TEXT UNIQUE,
  creado_en      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. FK empresa_id en contactos
ALTER TABLE contactos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

-- 3. Migrar datos existentes
DO $$
DECLARE
  r RECORD;
  emp_id UUID;
BEGIN
  FOR r IN SELECT id, empresa_nombre, cuit FROM contactos WHERE empresa_id IS NULL LOOP
    IF r.cuit IS NOT NULL AND r.cuit != '' THEN
      SELECT id INTO emp_id FROM empresas WHERE cuit = r.cuit LIMIT 1;
      IF NOT FOUND THEN
        INSERT INTO empresas (nombre, cuit)
        VALUES (COALESCE(r.empresa_nombre, 'Sin nombre'), r.cuit)
        RETURNING id INTO emp_id;
      END IF;
    ELSIF r.empresa_nombre IS NOT NULL AND r.empresa_nombre != '' THEN
      SELECT id INTO emp_id FROM empresas WHERE LOWER(nombre) = LOWER(r.empresa_nombre) AND cuit IS NULL LIMIT 1;
      IF NOT FOUND THEN
        INSERT INTO empresas (nombre)
        VALUES (r.empresa_nombre)
        RETURNING id INTO emp_id;
      END IF;
    END IF;
    IF emp_id IS NOT NULL THEN
      UPDATE contactos SET empresa_id = emp_id WHERE id = r.id;
    END IF;
    emp_id := NULL;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_empresas_cuit ON empresas(cuit);
CREATE INDEX IF NOT EXISTS idx_contactos_empresa ON contactos(empresa_id);

-- 4. Soft Delete en campanas
ALTER TABLE campanas
  ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_campanas_eliminado ON campanas(eliminado_en)
  WHERE eliminado_en IS NULL;

