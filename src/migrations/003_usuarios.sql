-- ============================================================
-- Migración 003: Tabla de Usuarios + Seed Desarrollador
-- Fecha: 2026-08-20
-- Descripción: Sistema de autenticación basado en roles (RBAC)
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'invitado'
        CHECK (rol IN ('desarrollador', 'encargada', 'invitado')),
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
