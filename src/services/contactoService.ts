import { dbPool } from '../config/db.js';
import { parse } from 'csv-parse/sync';
import { upsertEmpresa } from './empresaService.js';
import { normalizarEmail } from '../utils/campanaParsers.js';
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
  es_contacto_base?: boolean;
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
  const { page = 1, limit = 10, busqueda, rubro_id, estado, es_contacto_base } = filtros;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (busqueda && busqueda.trim()) {
    conditions.push(`(
      c.email ILIKE $${paramCount} 
      OR c.empresa_nombre ILIKE $${paramCount} 
      OR c.cuit ILIKE $${paramCount}
      OR r.nombre ILIKE $${paramCount}
    )`);
    values.push(`%${busqueda.trim()}%`);
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

  if (es_contacto_base !== undefined) {
    conditions.push(`c.es_contacto_base = $${paramCount}`);
    values.push(es_contacto_base);
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
    totalPages: Math.ceil(total / limit),
  };
}

export async function crearContacto(data: CrearContactoInput): Promise<Contacto | null> {
  const { email, empresa_nombre, cuit, rubro_id, tipo = 'empresa', estado = 'funcional', es_contacto_base = true } = data;
  const emailLimpio = normalizarEmail(email);
  const rubroFinalId = await resolverRubroId(rubro_id);

  // Upsert empresa (crea o reutiliza)
  const empresa_id = await upsertEmpresa(empresa_nombre, cuit, rubroFinalId);

  const query = `
    INSERT INTO contactos (email, empresa_nombre, cuit, rubro_id, tipo, estado, empresa_id, es_contacto_base)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (email) DO NOTHING
    RETURNING *
  `;

  const result = await dbPool.query<Contacto>(query, [
    emailLimpio,
    empresa_nombre ?? null,
    cuit ?? null,
    rubroFinalId ?? null,
    tipo,
    estado,
    empresa_id,
    es_contacto_base,
  ]);

  return result.rows[0] ?? null;
}

export async function actualizarContacto(id: string, data: ActualizarContactoInput): Promise<Contacto | null> {
  // First, fetch the existing contact so we can merge its company details
  const existingResult = await dbPool.query<Contacto>('SELECT * FROM contactos WHERE id = $1', [id]);
  const existingContacto = existingResult.rows[0];
  
  if (!existingContacto) {
    return null;
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (data.email !== undefined) {
    updates.push(`email = $${paramCount}`);
    values.push(normalizarEmail(data.email));
    paramCount++;
  }

  if (data.empresa_nombre !== undefined) {
    updates.push(`empresa_nombre = $${paramCount}`);
    values.push(data.empresa_nombre);
    paramCount++;
  }

  if (data.cuit !== undefined) {
    updates.push(`cuit = $${paramCount}`);
    values.push(data.cuit);
    paramCount++;
  }

  let resolvedRubroId: string | null | undefined = undefined;
  if (data.rubro_id !== undefined) {
    resolvedRubroId = await resolverRubroId(data.rubro_id);
    updates.push(`rubro_id = $${paramCount}`);
    values.push(resolvedRubroId);
    paramCount++;
  }

  if (data.tipo !== undefined) {
    updates.push(`tipo = $${paramCount}`);
    values.push(data.tipo);
    paramCount++;
  }

  if (data.estado !== undefined) {
    updates.push(`estado = $${paramCount}`);
    values.push(data.estado);
    paramCount++;
  }

  if (data.es_contacto_base !== undefined) {
    updates.push(`es_contacto_base = $${paramCount}`);
    values.push(data.es_contacto_base);
    paramCount++;
  }

  // Si se actualiza empresa_nombre o cuit, actualizar/crear la empresa vinculada
  const nuevaEmpresaNombre = data.empresa_nombre !== undefined ? data.empresa_nombre : existingContacto.empresa_nombre;
  const nuevoCuit = data.cuit !== undefined ? data.cuit : existingContacto.cuit;
  const nuevoRubroId = resolvedRubroId !== undefined ? resolvedRubroId : existingContacto.rubro_id;

  if (data.empresa_nombre !== undefined || data.cuit !== undefined || data.rubro_id !== undefined) {
    if (existingContacto.empresa_id) {
      // Actualizar empresa existente
      await dbPool.query(
        `UPDATE empresas 
         SET nombre = COALESCE($1, nombre),
             cuit = COALESCE($2, cuit),
             rubro_id = COALESCE($3, rubro_id),
             actualizado_en = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [nuevaEmpresaNombre, nuevoCuit, nuevoRubroId, existingContacto.empresa_id]
      );
    } else if (nuevaEmpresaNombre || nuevoCuit) {
      // Crear nueva empresa si no existía antes
      const empresa_id = await upsertEmpresa(nuevaEmpresaNombre, nuevoCuit, nuevoRubroId);
      updates.push(`empresa_id = $${paramCount}`);
      values.push(empresa_id);
      paramCount++;
    }
  }

  if (updates.length === 0) {
    return existingContacto;
  }

  updates.push(`actualizado_en = CURRENT_TIMESTAMP`);

  const query = `
    UPDATE contactos 
    SET ${updates.join(', ')} 
    WHERE id = $${paramCount} 
    RETURNING *
  `;
  values.push(id);

  const result = await dbPool.query<Contacto>(query, values);
  const contacto = result.rows[0] ?? null;

  if (contacto && data.estado) {
    import('./googleSheetsService.js').then(({ sincronizarEstadosHaciaSheets }) => {
      sincronizarEstadosHaciaSheets([{ email: contacto.email, estado: data.estado! }])
        .catch(err => console.error('[Sheets Sync] Error al sincronizar actualización hacia Sheet:', err?.message));
    }).catch(() => {});
  }

  return contacto;
}

export async function toggleEstadoContacto(id: string, nuevoEstado: string): Promise<Contacto | null> {
  const query = `
    UPDATE contactos
    SET estado = $1, actualizado_en = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const result = await dbPool.query<Contacto>(query, [nuevoEstado, id]);
  const contacto = result.rows[0] ?? null;

  if (contacto) {
    import('./googleSheetsService.js').then(({ sincronizarEstadosHaciaSheets }) => {
      sincronizarEstadosHaciaSheets([{ email: contacto.email, estado: nuevoEstado }])
        .catch(err => console.error('[Sheets Sync] Error al sincronizar cambio manual hacia Sheet:', err?.message));
    }).catch(() => {});
  }

  return contacto;
}

export async function eliminarContacto(id: string): Promise<Contacto | null> {
  const query = `DELETE FROM contactos WHERE id = $1 RETURNING *`;
  const result = await dbPool.query<Contacto>(query, [id]);
  return result.rows[0] ?? null;
}

export async function eliminarContactosBulk(ids: string[]): Promise<number> {
  const query = `DELETE FROM contactos WHERE id = ANY($1) RETURNING *`;
  const result = await dbPool.query<Contacto>(query, [ids]);
  return result.rowCount ?? 0;
}

export async function importarContactosCsv(
  buffer: Buffer
): Promise<{ procesados: number; insertados_o_actualizados: number }> {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  let afectadas = 0;

  for (const record of records) {
    const email = record.email || record.Email || record.EMAIL;
    if (!email) continue;
    const emailLimpio = normalizarEmail(email);
    if (!emailLimpio) continue;

    const empresa = record.empresa || record.empresa_nombre || record.Empresa || null;
    const cuit = record.cuit || record.CUIT || null;

    const empresa_id = await upsertEmpresa(empresa, cuit);

    const query = `
      INSERT INTO contactos (email, empresa_nombre, cuit, empresa_id, es_contacto_base)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (email) DO UPDATE 
      SET 
        empresa_nombre = COALESCE(EXCLUDED.empresa_nombre, contactos.empresa_nombre),
        cuit = COALESCE(EXCLUDED.cuit, contactos.cuit),
        empresa_id = COALESCE(EXCLUDED.empresa_id, contactos.empresa_id),
        es_contacto_base = true,
        actualizado_en = CURRENT_TIMESTAMP
    `;
    
    await dbPool.query(query, [emailLimpio, empresa, cuit, empresa_id]);
    afectadas++;
  }

  return {
    procesados: records.length,
    insertados_o_actualizados: afectadas
  };
}

/**
 * Importa un array de contactos ya mapeados (desde el importador visual del frontend o Sheets).
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
    const esContactoBase = row.es_contacto_base !== undefined ? row.es_contacto_base : true;

    try {
      // Upsert empresa
      const empresa_id = await upsertEmpresa(row.empresa_nombre, row.cuit, rubroFinalId);

      const query = `
        INSERT INTO contactos (email, empresa_nombre, cuit, rubro_id, tipo, estado, empresa_id, es_contacto_base)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (email) DO UPDATE
        SET
          empresa_nombre = COALESCE(EXCLUDED.empresa_nombre, contactos.empresa_nombre),
          cuit           = COALESCE(EXCLUDED.cuit, contactos.cuit),
          rubro_id       = COALESCE(EXCLUDED.rubro_id, contactos.rubro_id),
          tipo           = COALESCE(EXCLUDED.tipo, contactos.tipo),
          estado         = CASE
            WHEN (contactos.estado LIKE 'rebotado%' OR contactos.estado IN ('inactivo', 'mal_escrito'))
                 AND EXCLUDED.estado = 'funcional'
            THEN contactos.estado
            ELSE COALESCE(EXCLUDED.estado, contactos.estado)
          END,
          empresa_id     = COALESCE(EXCLUDED.empresa_id, contactos.empresa_id),
          es_contacto_base = COALESCE(EXCLUDED.es_contacto_base, contactos.es_contacto_base),
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
        esContactoBase,
      ]);
      afectadas++;
    } catch (err: any) {
      console.warn(`Error de empresa para ${row.email}. Guardando contacto sin vincular empresa (fallback):`, err.message);
      
      const fallbackQuery = `
        INSERT INTO contactos (email, empresa_nombre, cuit, rubro_id, tipo, estado, empresa_id, es_contacto_base)
        VALUES ($1, $2, $3, $4, $5, $6, NULL, $7)
        ON CONFLICT (email) DO UPDATE
        SET
          empresa_nombre = COALESCE(EXCLUDED.empresa_nombre, contactos.empresa_nombre),
          cuit           = COALESCE(EXCLUDED.cuit, contactos.cuit),
          rubro_id       = COALESCE(EXCLUDED.rubro_id, contactos.rubro_id),
          tipo           = COALESCE(EXCLUDED.tipo, contactos.tipo),
          estado         = CASE
            WHEN (contactos.estado LIKE 'rebotado%' OR contactos.estado IN ('inactivo', 'mal_escrito'))
                 AND EXCLUDED.estado = 'funcional'
            THEN contactos.estado
            ELSE COALESCE(EXCLUDED.estado, contactos.estado)
          END,
          es_contacto_base = COALESCE(EXCLUDED.es_contacto_base, contactos.es_contacto_base),
          actualizado_en = CURRENT_TIMESTAMP
      `;
      try {
        await dbPool.query(fallbackQuery, [
          row.email.trim().toLowerCase(),
          row.empresa_nombre || null,
          row.cuit || null,
          rubroFinalId || null,
          row.tipo || null,
          row.estado || 'funcional',
          esContactoBase,
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
