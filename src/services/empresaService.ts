import { dbPool } from '../config/db.js';

export interface Empresa {
  id: string;
  nombre: string;
  cuit: string | null;
  creado_en: string;
  actualizado_en: string;
}

/**
 * Busca o crea una empresa basándose en CUIT o nombre.
 * Retorna el ID de la empresa encontrada o recién creada.
 */
export async function upsertEmpresa(nombre: string | null | undefined, cuit: string | null | undefined): Promise<string | null> {
  if (!nombre && !cuit) return null;

  const nombreLimpio = nombre?.trim() || null;
  const cuitLimpio = cuit?.trim() || null;

  // 1. Buscar por CUIT primero (más confiable)
  if (cuitLimpio) {
    const existing = await dbPool.query<Empresa>(
      `SELECT id FROM empresas WHERE cuit = $1 LIMIT 1`,
      [cuitLimpio]
    );
    if (existing.rows.length > 0) {
      // Si encontró por CUIT, actualizar nombre si cambió
      if (nombreLimpio) {
        await dbPool.query(
          `UPDATE empresas SET nombre = $1, actualizado_en = CURRENT_TIMESTAMP WHERE cuit = $2`,
          [nombreLimpio, cuitLimpio]
        );
      }
      return existing.rows[0].id;
    }
  }

  // 2. Buscar por nombre exacto (case-insensitive) si no hay CUIT
  if (nombreLimpio && !cuitLimpio) {
    const existing = await dbPool.query<Empresa>(
      `SELECT id FROM empresas WHERE LOWER(nombre) = LOWER($1) AND cuit IS NULL LIMIT 1`,
      [nombreLimpio]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;
  }

  // 3. Crear nueva empresa
  const result = await dbPool.query<Empresa>(
    `INSERT INTO empresas (nombre, cuit) VALUES ($1, $2) RETURNING id`,
    [nombreLimpio ?? 'Sin nombre', cuitLimpio]
  );
  return result.rows[0].id;
}

/**
 * Lista empresas con búsqueda opcional (para autocompletado en frontend).
 */
export async function buscarEmpresas(q?: string): Promise<Empresa[]> {
  if (q) {
    const result = await dbPool.query<Empresa>(
      `SELECT id, nombre, cuit FROM empresas
       WHERE nombre ILIKE $1 OR cuit ILIKE $1
       ORDER BY nombre ASC LIMIT 20`,
      [`%${q}%`]
    );
    return result.rows;
  }
  const result = await dbPool.query<Empresa>(
    `SELECT id, nombre, cuit FROM empresas ORDER BY nombre ASC LIMIT 50`
  );
  return result.rows;
}

/**
 * Actualiza nombre/cuit de una empresa.
 */
export async function actualizarEmpresa(id: string, nombre: string, cuit?: string | null): Promise<Empresa | null> {
  const result = await dbPool.query<Empresa>(
    `UPDATE empresas SET nombre = $1, cuit = $2, actualizado_en = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
    [nombre, cuit ?? null, id]
  );
  return result.rows[0] ?? null;
}
