-- Migración 025: Umbral de Errores Configurable por Cuenta de Envío
-- Añade columna umbral_errores para que cada cuenta configure cuántos errores/rebotes
-- tolerará en 24 horas antes del bloqueo temporal preventivo.

ALTER TABLE cuentas_smtp
ADD COLUMN IF NOT EXISTS umbral_errores INTEGER DEFAULT 30;

UPDATE cuentas_smtp
SET umbral_errores = 30
WHERE umbral_errores IS NULL;
