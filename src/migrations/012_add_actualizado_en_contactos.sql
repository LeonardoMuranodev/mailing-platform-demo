-- Migración 012: Agregar actualizado_en a contactos
ALTER TABLE contactos ADD COLUMN IF NOT EXISTS actualizado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
