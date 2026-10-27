-- 019_limite_prudente_oauth.sql
-- Actualiza las cuentas OAuth 2.0 a limites prudentes (maximo 40-50 diarios)

UPDATE cuentas_smtp
SET limite_diario = 50,
    minimo_por_ejecucion = 3,
    maximo_por_ejecucion = 6,
    estado = 'activo',
    actualizado_en = CURRENT_TIMESTAMP
WHERE email LIKE '%oauth%' OR limite_diario > 300;
