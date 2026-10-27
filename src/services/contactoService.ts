import { dbPool } from '../config/db.js';
import { parse } from 'csv-parse/sync';
import { upsertEmpresa } from './empresaService.js';
import type {
  Contacto,
  ContactoConRubro,
  CrearContactoInput,
  ActualizarContactoInput,
  ListarContactosQuery,
  ContactosResponse
} from '../types/contacto.js';

export interface ContactoImportRow {
  email: string;
  empresa_nombre?: string | null;
  cuit?: string | null;
  rubro_id?: string | null;
  tipo?: string | null;
  estado?: string | null;
}

export async function resolverRubroId(rubroInput?: string | null): Promise<string | null> {
  if (!rubroInput || !rubroInput.trim()) return null;
  const limpio = rubroInput.trim();
  const res = await dbPool.query(
    'SELECT id FROM rubros WHERE id::text = $1 OR LOWER(TRIM(nombre)) = LOWER(TRIM($1)) LIMIT 1',
    [limpio]
  );
  if (res.rows.length > 0) {
    return res.rows[0].id;
  }
  return limpio;
}

export async function listarContactos(filtros: ListarContactosQuery): Promise<ContactosResponse> {
  const { page = 1, limit = 10, busqueda, rubro_id, estado } = filtros;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (busqueda) {
    conditions.push(`(c.email ILIKE $${paramCount} OR c.empresa_nombre ILIKE $${paramCount} OR c.cuit ILIKE $${paramCount})`);
    values.push(`%${busqueda}%`);
    paramCount++;
  }

  if (rubro_id) {
    const rubroLower = rubro_id.toLowerCase().trim();
    if (rubro_id === '__sin_rubro__' || rubroLower === 'sin rubro' || rubroLower === 'sin_rubro') {
      conditions.push(`(c.rubro_id IS NULL OR TRIM(c.rubro_id) = '' OR c.rubro_id = 'null')`);
    } else {
      conditions.push(`(c.rubro_id = $${paramCount} OR LOWER(TRIM(r.nombre)) = LOWER(TRIM($${paramCount})) OR r.id::text = $${paramCount})`);
      values.push(rubro_id);
      paramCount++;
    }
  }

  if (estado) {
    conditions.push(`c.estado = $${paramCount}`);
    values.push(estado);
    paramCount++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*) 
    FROM contactos c
    LEFT JOIN rubros r ON (c.rubro_id = r.id::text OR LOWER(TRIM(c.rubro_id)) = LOWER(TRIM(r.nombre)))
    ${whereClause}
  `;
  const countResult = await dbPool.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count, 10);

  const query = `
    SELECT 
      c.*, 
      COALESCE(TRIM(r.nombre), c.rubro_id) AS rubro_nombre
    FROM contactos c
    LEFT JOIN rubros r ON (c.rubro_id = r.id::text OR LOWER(TRIM(c.rubro_id)) = LOWER(TRIM(r.nombre)))
    ${whereClause}
    ORDER BY c.creado_en DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `;
  
  const queryValues = [...values, limit, offset];
  const result = await dbPool.query<ContactoConRubro>(query, queryValues);

  return {
    data: result.rows,
    total,
    page,
    limit,
  };
}

export async function crearContacto(data: CrearContactoInput): Promise<Contacto | null> {
  const { email, empresa_nombre, cuit, rubro_id, tipo = 'empresa', estado = 'funcional' } = data;
  const rubroFinalId = await resolverRubroId(rubro_id);

  // Upsert empresa (crea o reutiliza)
  const empresa_id = await upsertEmpresa(empresa_nombre, cuit, rubroFinalId);

  const query = `
    INSERT INTO contactos (email, empresa_nombre, cuit, rubro_id, tipo, estado, empresa_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (email) DO NOTHING
    RETURNING *
  `;

  const result = await dbPool.query<Contacto>(query, [
    email,
    empresa_nombre ?? null,
    cuit ?? null,
    rubroFinalId ?? null,
    tipo,
    estado,
    empresa_id,
  ]);

  return result.rows[0] ?? null;
}

export async function actualizarContacto(id: string, data: ActualizarContactoInput): Promise<Contacto | null> {
  // First, fetch the existing contact so we can merge its company details
  const existingResult = await dbPool.query<Contacto>('SELECT * FROM contactos WHERE id = $1', [id]);
  const existingContacto = existingResult.rows[0];
  
  if (!existingContacto) return null;

  // Determinar empresa final
  const finalEmpresaNombre = data.empresa_nombre !== undefined ? data.empresa_nombre : existingContacto.empresa_nombre;

  // Determinar CUIT final (si se pasa vacío o null, se limpia explícitamente a null)
  const finalCuit = data.cuit !== undefined ? (data.cuit && data.cuit.trim() ? data.cuit.trim() : null) : existingContacto.cuit;
  if (data.cuit !== undefined) {
    data.cuit = finalCuit;
  }

  // Determinar rubro final
  let finalRubroId = data.rubro_id !== undefined ? data.rubro_id : existingContacto.rubro_id;
  if (data.rubro_id !== undefined) {
    finalRubroId = await resolverRubroId(data.rubro_id);
    data.rubro_id = finalRubroId;
  }

  // Upsert empresa (crea o reutiliza o valida)
  const empresa_id = await upsertEmpresa(finalEmpresaNombre, finalCuit, finalRubroId);

  // Whitelist explícita de campos permitidos para prevenir property injection
  const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
    'email', 'empresa_nombre', 'cuit', 'rubro_id', 'tipo', 'estado',
  ]);

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && ALLOWED_FIELDS.has(key)) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  // Siempre actualizamos el empresa_id si fue resuelto
  fields.push(`empresa_id = $${paramIndex}`);
  values.push(empresa_id);
  paramIndex++;

  if (fields.length === 0) return null; // Nunca será 0 por empresa_id

  fields.push(`actualizado_en = CURRENT_TIMESTAMP`);

  const query = `
    UPDATE contactos
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;
  values.push(id);

  const result = await dbPool.query<Contacto>(query, values);
  return result.rows[0] ?? null;
}

export async function toggleEstadoContacto(id: string, nuevoEstado: string): Promise<Contacto | null> {
  const query = `
    UPDATE contactos
    SET estado = $1, actualizado_en = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const result = await dbPool.query<Contacto>(query, [nuevoEstado, id]);
  return result.rows[0] ?? null;
}

export async function eliminarContacto(id: string): Promise<Contacto | null> {
  const query = `DELETE FROM contactos WHERE id = $1 RETURNING *`;
  const result = await dbPool.query<Contacto>(query, [id]);
  return result.rows[0] ?? null;
}

export async function eliminarContactosBulk(ids: string[]): Promise<number> {
  const query = `DELETE FROM contactos WHERE id = ANY($1) RETURNING *`;
  const result = await dbPool.query(query, [ids]);
  return result.rowCount ?? 0;
}

export async function importarContactosCsv(buffer: Buffer): Promise<{ procesados: number; insertados_o_actualizados: number }> {
  const records: Record<string, string>[] = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  let afectadas = 0;

  for (const record of records) {
    const email = record.email || record.Email || record.EMAIL;
    if (!email) continue;

    const empresa = record.empresa || record.empresa_nombre || record.Empresa || null;
    const cuit = record.cuit || record.CUIT || null;

    const empresa_id = await upsertEmpresa(empresa, cuit);

    const query = `
      INSERT INTO contactos (email, empresa_nombre, cuit, empresa_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE 
      SET 
        empresa_nombre = COALESCE(EXCLUDED.empresa_nombre, contactos.empresa_nombre),
        cuit = COALESCE(EXCLUDED.cuit, contactos.cuit),
        empresa_id = COALESCE(EXCLUDED.empresa_id, contactos.empresa_id),
        actualizado_en = CURRENT_TIMESTAMP
    `;
    
    await dbPool.query(query, [email, empresa, cuit, empresa_id]);
    afectadas++;
  }

  return {
    procesados: records.length,
    insertados_o_actualizados: afectadas
  };
}

/**
 * Importa un array de contactos ya mapeados (desde el importador visual del frontend).
 * Hace upsert por email.
 */
export async function importarContactosJson(
  contactos: ContactoImportRow[]
): Promise<{ procesados: number; insertados_o_actualizados: number; omitidos: number }> {
  let afectadas = 0;
  let omitidos = 0;

  // Pre-cargar mapa de rubros para resolución eficiente O(1)
  const rubrosDb = await dbPool.query('SELECT id, nombre FROM rubros');
  const rubroSlugToId = new Map<string, string>();
  for (const r of rubrosDb.rows) {
    if (r.nombre) rubroSlugToId.set(r.nombre.trim().toLowerCase(), r.id);
    rubroSlugToId.set(r.id, r.id);
  }

  for (const row of contactos) {
    if (!row.email || !row.email.trim()) continue;

    const rubroLimpio = row.rubro_id?.trim().toLowerCase() || null;
    const rubroFinalId = rubroLimpio ? (rubroSlugToId.get(rubroLimpio) || row.rubro_id) : null;

    try {
      // Upsert empresa
      const empresa_id = await upsertEmpresa(row.empresa_nombre, row.cuit, rubroFinalId);

      const query = `
        INSERT INTO contactos (email, empresa_nombre, cuit, rubro_id, tipo, estado, empresa_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO UPDATE
        SET
          empresa_nombre = COALESCE(EXCLUDED.empresa_nombre, contactos.empresa_nombre),
          cuit           = COALESCE(EXCLUDED.cuit, contactos.cuit),
          rubro_id       = COALESCE(EXCLUDED.rubro_id, contactos.rubro_id),
          tipo           = COALESCE(EXCLUDED.tipo, contactos.tipo),
          estado         = COALESCE(EXCLUDED.estado, contactos.estado),
          empresa_id     = COALESCE(EXCLUDED.empresa_id, contactos.empresa_id),
          actualizado_en = CURRENT_TIMESTAMP
      `;

      await dbPool.query(query, [
        row.email.trim().toLowerCase(),
        row.empresa_nombre || null,
        row.cuit || null,
        rubroFinalId || null,
        row.tipo || null,
        row.estado || 'funcional',
        empresa_id,
      ]);
      afectadas++;
    } catch (err: any) {
      console.warn(`Error de empresa para ${row.email}. Guardando contacto sin vincular empresa (fallback):`, err.message);
      
      const fallbackQuery = `
        INSERT INTO contactos (email, empresa_nombre, cuit, rubro_id, tipo, estado, empresa_id)
        VALUES ($1, $2, $3, $4, $5, $6, NULL)
        ON CONFLICT (email) DO UPDATE
        SET
          empresa_nombre = COALESCE(EXCLUDED.empresa_nombre, contactos.empresa_nombre),
          cuit           = COALESCE(EXCLUDED.cuit, contactos.cuit),
          rubro_id       = COALESCE(EXCLUDED.rubro_id, contactos.rubro_id),
          tipo           = COALESCE(EXCLUDED.tipo, contactos.tipo),
          estado         = COALESCE(EXCLUDED.estado, contactos.estado),
          actualizado_en = CURRENT_TIMESTAMP
      `;
      try {
        await dbPool.query(fallbackQuery, [
          row.email.trim().toLowerCase(),
          row.empresa_nombre || null,
          row.cuit || null,
          rubroFinalId || null,
          row.tipo || null,
          row.estado || 'funcional'
        ]);
        afectadas++;
      } catch (fallbackErr: any) {
        console.error(`Fallo total al importar ${row.email}:`, fallbackErr.message);
        omitidos++;
      }
    }
  }

  return { procesados: contactos.length, insertados_o_actualizados: afectadas, omitidos };
}
