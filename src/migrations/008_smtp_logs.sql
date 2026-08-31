CREATE TABLE IF NOT EXISTS smtp_logs (
    id SERIAL PRIMARY KEY,
    cuenta_smtp_id UUID REFERENCES cuentas_smtp(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'agotada', 'bloqueada', 'error', 'info'
    mensaje TEXT NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
