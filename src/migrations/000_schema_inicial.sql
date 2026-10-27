-- ============================================================
-- Migración 000: Schema inicial (Tabla campañas que faltaba)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS campanas (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    asunto character varying(255) NOT NULL,
    cuerpo_html text NOT NULL,
    link_inscripcion text,
    flyer_url text,
    fecha_limite_envio date NOT NULL,
    prioridad character varying(20) DEFAULT 'alta'::character varying NOT NULL,
    para_todos_rubros boolean DEFAULT true NOT NULL,
    rubros_seleccionados jsonb DEFAULT '[]'::jsonb,
    estado character varying(50) DEFAULT 'borrador'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    actualizado_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    eliminado_en timestamp with time zone,
    CONSTRAINT campanas_estado_check CHECK (estado::text = ANY (ARRAY['borrador', 'aprobada', 'en_proceso', 'pausada', 'completada', 'cancelada']::text[]))
);

CREATE INDEX IF NOT EXISTS idx_campanas_eliminado ON campanas (eliminado_en) WHERE (eliminado_en IS NULL);
CREATE INDEX IF NOT EXISTS idx_campanas_estado ON campanas (estado);
