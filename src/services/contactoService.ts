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

/**
 * Helper para resolver un rubro_id enviado desde el cliente (que suele ser un slug/nombre)
 * a un UUID válido en la base de datos.
 */
async function resolveRubroId(rubro: string | null | undefined): Promise<string | null> {
  if (!rubro) return null;
  // Si ya es un UUID válido, retornarlo
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (uuidRegex.test(rubro)) return rubro;

  // Si es un nombre (slug), insertarlo si no existe (ON CONFLICT no aplica fácil porque nombre no era UNIQUE en algunas versiones, pero sí lo hicimos UNIQUE).
  // Haremos un SELECT primero.
  let res = await dbPool.query('SELECT id FROM rubros WHERE nombre ILIKE $1', [rubro]);
  if (res.rows.length > 0) return res.rows[0].id;

  // Si no existe, lo creamos
  res = await dbPool.query('INSERT INTO rubros (nombre) VALUES ($1) ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id', [rubro]);
  return res.rows[0].id;
}

export interface ContactoImportRow {
  email: string;
  empresa_nombre?: string | null;
  cuit?: string | null;
  rubro_id?: string | null;
  tipo?: string | null;
  estado?: string | null;
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
    conditions.push(`c.rubro_id = $${paramCount}`);
    values.push(rubro_id);
    paramCount++;
  }

  if (estado) {
    conditions.push(`c.estado = $${paramCount}`);
    values.push(estado);
    paramCount++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) FROM contactos c ${whereClause}`;
  const countResult = await dbPool.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count, 10);

  const query = `
    SELECT c.*, r.nombre AS rubro_nombre
    FROM contactos c
    LEFT JOIN rubros r ON c.rubro_id = r.id
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

  // Upsert empresa (crea o reutiliza)
  const empresa_id = await upsertEmpresa(empresa_nombre, cuit);

  // Resolver el ID del rubro a partir del string enviado
  const resolvedRubroId = await resolveRubroId(rubro_id);

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
    resolvedRubroId,
    tipo,
    estado,
    empresa_id,
  ]);

  return result.rows[0] ?? null;
}

export async function actualizarContacto(id: string, data: ActualizarContactoInput): Promise<Contacto | null> {
  // Whitelist explícita de campos permitidos para prevenir property injection
  const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
    'email', 'empresa_nombre', 'cuit', 'rubro_id', 'tipo', 'estado',
  ]);

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && ALLOWED_FIELDS.has(key)) {
      if (key === 'rubro_id') {
        const resolvedRubroId = await resolveRubroId(value as string | null | undefined);
        fields.push(`rubro_id = $${paramIndex}`);
        values.push(resolvedRubroId);
      } else {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    }
  }

  if (fields.length === 0) return null;

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

    const query = `
      INSERT INTO contactos (email, empresa_nombre, cuit)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE 
      SET 
        empresa_nombre = COALESCE(EXCLUDED.empresa_nombre, contactos.empresa_nombre),
        cuit = COALESCE(EXCLUDED.cuit, contactos.cuit),
        actualizado_en = CURRENT_TIMESTAMP
    `;
    
    await dbPool.query(query, [email, empresa, cuit]);
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
): Promise<{ procesados: number; insertados_o_actualizados: number }> {
  let afectadas = 0;

  for (const row of contactos) {
    if (!row.email || !row.email.trim()) continue;

    // Upsert empresa
    const empresa_id = await upsertEmpresa(row.empresa_nombre, row.cuit);

    // Resolver rubro_id
    const resolvedRubroId = await resolveRubroId(row.rubro_id);

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
      row.rubro_id || null,
      row.tipo || null,
      row.estado || 'funcional',
      empresa_id,
    ]);
    afectadas++;
  }

  return { procesados: contactos.length, insertados_o_actualizados: afectadas };
}
