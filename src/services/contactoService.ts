import { dbPool } from '../config/db.js';
import { parse } from 'csv-parse/sync';
import type {
  Contacto,
  ContactoConRubro,
  CrearContactoInput,
  ActualizarContactoInput,
  ListarContactosQuery,
  ContactosResponse
} from '../types/contacto.js';

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
    SELECT c.*, c.rubro_id AS rubro_nombre
    FROM contactos c
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

  const query = `
    INSERT INTO contactos (email, empresa_nombre, cuit, rubro_id, tipo, estado)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (email) DO NOTHING
    RETURNING *
  `;

  const result = await dbPool.query<Contacto>(query, [
    email,
    empresa_nombre ?? null,
    cuit ?? null,
    rubro_id ?? null,
    tipo,
    estado,
  ]);

  return result.rows[0] ?? null; // Returns null if conflict
}

export async function actualizarContacto(id: string, data: ActualizarContactoInput): Promise<Contacto | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
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
