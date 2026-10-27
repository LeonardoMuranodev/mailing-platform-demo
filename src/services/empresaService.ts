import { dbPool } from '../config/db.js';

export interface Empresa {
  id: string;
  nombre: string;
  cuit: string | null;
  creado_en: string;
  actualizado_en: string;
}

/**
 * Busca o crea una empresa basÃ¡ndose en CUIT o nombre.
 * Retorna el ID de la empresa encontrada o reciÃ©n creada.
 */
export async function upsertEmpresa(nombre: string | null | undefined, cuit: string | null | undefined, rubro_id?: string | null): Promise<string | null> {
  if (!nombre && !cuit) return null;

  const nombreLimpio = nombre?.trim() || null;
  const cuitLimpio = cuit?.trim() || null;

  let empresaEncontrada: Empresa | null = null;

    // Determinamos si el CUIT es un placeholder (no debe disparar reglas de unicidad)
  const isGenericCuit = cuitLimpio ? ['sin cuit', 'averiguar', '0', '-'].includes(cuitLimpio.toLowerCase()) : false;

  // 1. Buscar por CUIT primero (más confiable)
  if (cuitLimpio && !isGenericCuit) {
    const existing = await dbPool.query<Empresa>(
      `SELECT id, nombre, cuit FROM empresas WHERE cuit = $1 LIMIT 1`,
      [cuitLimpio]
    );
    if (existing.rows.length > 0) {
      empresaEncontrada = existing.rows[0];
      // Si el CUIT ya existe y el nombre ingresado difiere, no lo actualizamos silenciosamente.
      // Arrojamos un error para advertir al usuario.
      if (nombreLimpio && empresaEncontrada.nombre.toLowerCase().trim() !== nombreLimpio.toLowerCase().trim()) {
        throw new Error(`El CUIT ${cuitLimpio} ya está asignado a la empresa "${empresaEncontrada.nombre}". Modifica el CUIT o usa el mismo nombre.`);
      }
    }
  }

  // 2. Si no se encontró por CUIT, buscar por nombre exacto (case-insensitive)
  if (!empresaEncontrada && nombreLimpio) {
    const existing = await dbPool.query<Empresa>(
      `SELECT id, nombre, cuit FROM empresas WHERE LOWER(nombre) = LOWER($1) LIMIT 1`,
      [nombreLimpio]
    );
    if (existing.rows.length > 0) {
      empresaEncontrada = existing.rows[0];
      const empresaCuitGenerico = empresaEncontrada.cuit ? ['sin cuit', 'averiguar', '0', '-'].includes(empresaEncontrada.cuit.toLowerCase()) : false;
      
      // Si se encontró la empresa por nombre, pero se intenta poner un CUIT distinto al que ya tiene
      // Ignoramos la validación si el CUIT que ingresamos es genérico, o si el que tiene la empresa es genérico
      if (cuitLimpio && !isGenericCuit && empresaEncontrada.cuit && !empresaCuitGenerico && empresaEncontrada.cuit !== cuitLimpio) {
        throw new Error(`La empresa "${empresaEncontrada.nombre}" ya tiene asignado el CUIT ${empresaEncontrada.cuit}. No puedes asignarle otro CUIT distinto.`);
      }
      
      // Si la empresa NO tenía CUIT o tenía uno genérico, y ahora le pasamos uno REAL, lo actualizamos.
      if (cuitLimpio && (!empresaEncontrada.cuit || (empresaCuitGenerico && !isGenericCuit))) {
        await dbPool.query(`UPDATE empresas SET cuit = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2`, [cuitLimpio, empresaEncontrada.id]);
        empresaEncontrada.cuit = cuitLimpio;
      }
    }
  }

  // 3. Validar rubro y retornar si se encontrÃ³
  if (empresaEncontrada) {
    if (rubro_id !== undefined) {
      const rubroRes = await dbPool.query(
        `SELECT rubro_id FROM contactos WHERE empresa_id = $1 AND rubro_id IS NOT NULL LIMIT 1`,
        [empresaEncontrada.id]
      );
      if (rubroRes.rows.length > 0) {
        const rubroActual = rubroRes.rows[0].rubro_id;
        if (rubroActual !== rubro_id) {
          throw new Error(`La empresa "${empresaEncontrada.nombre}" ya tiene otro rubro asignado. No puedes cambiar o quitar el rubro a una empresa existente.`);
        }
      }
    }
    return empresaEncontrada.id;
  }

  // 4. Crear nueva empresa si no se encontrÃ³ ni por nombre ni por CUIT
  const result = await dbPool.query<Empresa>(
    `INSERT INTO empresas (nombre, cuit) VALUES ($1, $2) RETURNING id`,
    [nombreLimpio ?? 'Sin nombre', cuitLimpio]
  );
  return result.rows[0].id;
}

/**
 * Lista empresas con bÃºsqueda opcional (para autocompletado en frontend).
 */
export async function buscarEmpresas(q?: string): Promise<Array<Empresa & { rubro_id?: string | null }>> {
  if (q) {
    const result = await dbPool.query<Empresa & { rubro_id: string | null }>(
      `SELECT e.id, e.nombre, e.cuit, 
              (
                SELECT COALESCE(TRIM(r.nombre), c.rubro_id)
                FROM contactos c
                LEFT JOIN rubros r ON (c.rubro_id = r.id::text OR LOWER(TRIM(c.rubro_id)) = LOWER(TRIM(r.nombre)))
                WHERE c.empresa_id = e.id AND c.rubro_id IS NOT NULL
                LIMIT 1
              ) as rubro_id
       FROM empresas e
       WHERE e.nombre ILIKE $1 OR e.cuit ILIKE $1
       ORDER BY e.nombre ASC LIMIT 20`,
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

