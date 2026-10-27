-- ============================================================
-- Migración 018: Soporte para múltiples adjuntos en campañas
-- ============================================================

ALTER TABLE campanas ADD COLUMN IF NOT EXISTS adjuntos JSONB DEFAULT '[]'::jsonb;

-- Migrar campañas existentes con adjunto_url a la nueva estructura JSONB
UPDATE campanas
SET adjuntos = jsonb_build_array(
  jsonb_build_object(
    'url', adjunto_url,
    'nombre_original', COALESCE(adjunto_nombre_original, split_part(adjunto_url, '/', 3))
  )
)
WHERE adjunto_url IS NOT NULL 
  AND (adjuntos IS NULL OR adjuntos = '[]'::jsonb);
