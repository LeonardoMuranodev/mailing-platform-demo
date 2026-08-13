-- ============================================================
-- Migración 001: Cuentas SMTP (Circuit Breaker) + Cola de Envíos
-- Fecha: 2026-08-13
-- Descripción: Modelo de datos para la Anti-SPAM Engine
-- ============================================================

-- Asegurar extensión para uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tabla de Rubros ─────────────────────────────────────────
-- Catálogo de rubros industriales/comerciales.
-- Referenciada por contactos.rubro_id y campanas.rubros_seleccionados.
CREATE TABLE IF NOT EXISTS rubros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Tabla de Contactos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS contactos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_nombre TEXT,
    email TEXT UNIQUE NOT NULL,
    tipo TEXT,
    estado VARCHAR(50) DEFAULT 'funcional',
    rubro_id UUID REFERENCES rubros(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    cuit TEXT
);

-- ── Tabla de Cuentas SMTP (Circuit Breaker & Pool de Envíos) ─
CREATE TABLE IF NOT EXISTS cuentas_smtp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    host VARCHAR(255) NOT NULL DEFAULT 'smtp.gmail.com',
    puerto INT NOT NULL DEFAULT 587,
    usuario VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'activo',       -- 'activo', 'agotado', 'bloqueado'
    enviados_hoy INT NOT NULL DEFAULT 0,
    limite_diario INT NOT NULL DEFAULT 400,
    ultimo_uso TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Tabla de Cola de Envíos (Batch Processing Queue) ────────
CREATE TABLE IF NOT EXISTS cola_envios (
    id BIGSERIAL PRIMARY KEY,
    campana_id UUID NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
    contacto_id UUID NOT NULL REFERENCES contactos(id) ON DELETE CASCADE,
    cuenta_smtp_id UUID REFERENCES cuentas_smtp(id) ON DELETE SET NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',    -- 'pendiente', 'procesando', 'enviado', 'fallido'
    respuesta_smtp TEXT,
    intentos INT NOT NULL DEFAULT 0,
    fecha_programada TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_envio TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Índices de alto rendimiento ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cola_envios_estado_fecha
    ON cola_envios(estado, fecha_programada);

CREATE INDEX IF NOT EXISTS idx_cuentas_smtp_pool
    ON cuentas_smtp(estado, enviados_hoy, limite_diario);

CREATE INDEX IF NOT EXISTS idx_contactos_rubro_estado
    ON contactos(rubro_id, estado);
