-- Migración 005: Agregar min y max por ejecución a cuentas SMTP

ALTER TABLE cuentas_smtp
ADD COLUMN IF NOT EXISTS minimo_por_ejecucion INT NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS maximo_por_ejecucion INT NOT NULL DEFAULT 25;
