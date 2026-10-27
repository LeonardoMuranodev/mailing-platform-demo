-- ============================================================
-- Migración 010: Cambiar rubro_id a TEXT en contactos
-- ============================================================

-- Eliminar la Foreign Key a la tabla rubros
ALTER TABLE contactos DROP CONSTRAINT IF EXISTS contactos_rubro_id_fkey;

-- Cambiar el tipo de dato de UUID a TEXT (como está en producción)
ALTER TABLE contactos ALTER COLUMN rubro_id TYPE TEXT USING rubro_id::text;
