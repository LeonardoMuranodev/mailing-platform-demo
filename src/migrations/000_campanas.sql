-- ============================================================
-- Migración 000: Tabla de Campañas
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS campanas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asunto TEXT NOT NULL,
    cuerpo_html TEXT NOT NULL,
    link_inscripcion TEXT,
    flyer_url TEXT,
    fecha_limite_envio DATE,
    prioridad VARCHAR(20) DEFAULT 'media',
    para_todos_rubros BOOLEAN DEFAULT true,
    rubros_seleccionados JSONB DEFAULT '[]'::jsonb,
    estado VARCHAR(50) DEFAULT 'borrador',
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    eliminado_en TIMESTAMPTZ
);
