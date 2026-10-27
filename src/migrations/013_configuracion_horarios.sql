CREATE TABLE IF NOT EXISTS configuracion_horarios (
  id INT PRIMARY KEY DEFAULT 1,
  hora_inicio TIME NOT NULL DEFAULT '08:00:00',
  hora_fin TIME NOT NULL DEFAULT '18:00:00',
  dias_permitidos JSONB NOT NULL DEFAULT '[1, 2, 3, 4, 5]'::jsonb,
  CHECK (id = 1)
);

INSERT INTO configuracion_horarios (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS fechas_excluidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE UNIQUE NOT NULL,
  motivo VARCHAR(255)
);
