-- Migración 024: Umbral de Errores y Bloqueo Temporal (Reactivación a las 00:00 hs)
-- Añade columna bloqueada_hasta para auto-desbloqueo a medianoche y limpia bloqueos antiguos

ALTER TABLE cuentas_smtp
ADD COLUMN IF NOT EXISTS bloqueada_hasta TIMESTAMPTZ;

-- Crear índice para consultas rápidas de estado y desbloqueo
CREATE INDEX IF NOT EXISTS idx_cuentas_smtp_estado_bloqueada_hasta 
ON cuentas_smtp(estado, bloqueada_hasta);

-- Limpieza inmediata: si hay cuentas que ya estaban bloqueadas, las desbloqueamos
UPDATE cuentas_smtp
SET estado = 'activo', 
    bloqueada_hasta = NULL, 
    actualizado_en = CURRENT_TIMESTAMP
WHERE estado = 'bloqueado';
