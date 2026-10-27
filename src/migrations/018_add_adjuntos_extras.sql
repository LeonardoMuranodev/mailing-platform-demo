-- Migración: Añadir columna adjuntos_extras en tabla campanas
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS adjuntos_extras JSONB DEFAULT '[]'::jsonb;
