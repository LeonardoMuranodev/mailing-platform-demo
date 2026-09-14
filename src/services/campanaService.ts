import { dbPool } from '../config/db.js';
import type {
  Campana,
  CrearCampanaInput,
  EstadoCampana,
} from '../types/campana.js';

const ESTADOS_VALIDOS: ReadonlySet<EstadoCampana> = new Set([
  'borrador',
  'aprobada',
  'en_proceso',
  'completada',
  'cancelada',
]);

/**
 * Inserta una nueva campaña con estado 'borrador'.
 */
export async function crearCampana(data: CrearCampanaInput): Promise<Campana> {
  const {
    asunto,
    cuerpo_html,
    link_inscripcion = null,
    flyer_url = null,
    fecha_limite_envio,
    prioridad = 'alta',
    para_todos_rubros = true,
    rubros_seleccionados = [],
  } = data;

  const query = `
    INSERT INTO campanas
      (asunto, cuerpo_html, link_inscripcion, flyer_url,
       fecha_limite_envio, prioridad, para_todos_rubros, rubros_seleccionados)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;

  const values = [
    asunto,
    cuerpo_html,
    link_inscripcion,
    flyer_url,
    fecha_limite_envio,
    prioridad,
    para_todos_rubros,
    JSON.stringify(rubros_seleccionados),
  ];

  const result = await dbPool.query<Campana>(query, values);
  return result.rows[0];
}

/**
 * Actualiza una campaña existente.
 * Solo debe permitirse si la campaña está en estado 'borrador'.
 */
export async function actualizarCampana(id: string, data: Partial<CrearCampanaInput>): Promise<Campana | null> {
  // Construimos el query dinámicamente según los campos que vengan
  const updates: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (data.asunto !== undefined) {
    updates.push(`asunto = $${paramIdx++}`);
    values.push(data.asunto);
  }
  if (data.cuerpo_html !== undefined) {
    updates.push(`cuerpo_html = $${paramIdx++}`);
    values.push(data.cuerpo_html);
  }
  if (data.link_inscripcion !== undefined) {
    updates.push(`link_inscripcion = $${paramIdx++}`);
    values.push(data.link_inscripcion);
  }
  if (data.flyer_url !== undefined) {
    updates.push(`flyer_url = $${paramIdx++}`);
    values.push(data.flyer_url);
  }
  if (data.fecha_limite_envio !== undefined) {
    updates.push(`fecha_limite_envio = $${paramIdx++}`);
    values.push(data.fecha_limite_envio);
  }
  if (data.prioridad !== undefined) {
    updates.push(`prioridad = $${paramIdx++}`);
    values.push(data.prioridad);
  }
  if (data.para_todos_rubros !== undefined) {
    updates.push(`para_todos_rubros = $${paramIdx++}`);
    values.push(data.para_todos_rubros);
  }
  if (data.rubros_seleccionados !== undefined) {
    updates.push(`rubros_seleccionados = $${paramIdx++}`);
    values.push(JSON.stringify(data.rubros_seleccionados));
  }

  if (updates.length === 0) {
    return obtenerCampanaPorId(id);
  }

  updates.push(`actualizado_en = CURRENT_TIMESTAMP`);

  values.push(id);
  const query = `
    UPDATE campanas
    SET ${updates.join(', ')}
    WHERE id = $${paramIdx} AND estado = 'borrador'
    RETURNING *;
  `;

  const result = await dbPool.query<Campana>(query, values);
  return result.rows[0] ?? null;
}

/**
 * Cambia el estado de una campaña existente.
 * Actualiza el estado de una campaña
 */
export async function cambiarEstadoCampana(
  id: string,
  nuevoEstado: string,
): Promise<Campana | null> {
  const query = `
    UPDATE campanas
    SET estado = $1, actualizado_en = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const result = await dbPool.query<Campana>(query, [nuevoEstado, id]);
  let campana = result.rows[0] ?? null;

  // Si el nuevo estado es "aprobada", automáticamente generamos la cola
  // La campaña quedará en estado "aprobada" hasta que el worker envíe el primer correo.
  if (campana && nuevoEstado === 'aprobada') {
    const { poblarColaEnvios } = await import('./queueService.js');
    try {
      await poblarColaEnvios(id);
    } catch (error) {
      console.error(`Error poblando cola para campaña ${id}:`, error);
      // Si falla por falta de contactos u otra cosa, podemos decidir si dejarla aprobada o volverla a borrador.
      // Actualmente poblarColaEnvios no tira error si hay 0, solo retorna 0.
    }
  }

  return campana;
}

/**
 * Archiva (soft delete) una campaña marcando eliminado_en.
 * Los datos de tracking y estadísticas se preservan en los Dashboards.
 */
export async function archivarCampana(id: string): Promise<boolean> {
  const query = `UPDATE campanas SET eliminado_en = CURRENT_TIMESTAMP WHERE id = $1 AND eliminado_en IS NULL RETURNING id`;
  const result = await dbPool.query(query, [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Elimina una campaña y su cola de envíos asociada (Hard Delete).
 * Usar cuando se crea una campaña por error y no se quiere contabilizar.
 */
export async function eliminarCampana(id: string): Promise<boolean> {
  const query = `DELETE FROM campanas WHERE id = $1 RETURNING id`;
  const result = await dbPool.query(query, [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Obtiene una campaña completa por su UUID.
 */
export async function obtenerCampanaPorId(
  id: string,
): Promise<Campana | null> {
  const query = `SELECT * FROM campanas WHERE id = $1;`;
  const result = await dbPool.query<Campana>(query, [id]);
  return result.rows[0] ?? null;
}

/** Filtros opcionales para listar campañas */
export interface ListarCampanasFiltros {
  asunto?: string;
  estado?: EstadoCampana;
  fecha_desde?: string;
  fecha_hasta?: string;
  page?: number;
  limit?: number;
}

export interface CampanasResponse {
  data: Campana[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Lista campañas con filtros opcionales.
 */
export async function listarCampanas(
  filtros: ListarCampanasFiltros = {},
): Promise<CampanasResponse> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (filtros.asunto) {
    conditions.push(`asunto ILIKE $${paramIdx}`);
    values.push(`%${filtros.asunto}%`);
    paramIdx++;
  }

  if (filtros.estado) {
    conditions.push(`estado = $${paramIdx}`);
    values.push(filtros.estado);
    paramIdx++;
  }

  if (filtros.fecha_desde) {
    conditions.push(`fecha_limite_envio >= $${paramIdx}`);
    values.push(filtros.fecha_desde);
    paramIdx++;
  }

  if (filtros.fecha_hasta) {
    conditions.push(`fecha_limite_envio <= $${paramIdx}`);
    values.push(filtros.fecha_hasta);
    paramIdx++;
  }

  // Siempre excluir campañas borradas (soft delete)
  conditions.push('eliminado_en IS NULL');

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const countQuery = `SELECT COUNT(*) FROM campanas ${whereClause}`;
  const countResult = await dbPool.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count, 10);

  const page = filtros.page || 1;
  const limit = filtros.limit || 15;
  const offset = (page - 1) * limit;

  const query = `
    SELECT * FROM campanas 
    ${whereClause} 
    ORDER BY creado_en DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;
  
  const queryValues = [...values, limit, offset];
  const result = await dbPool.query<Campana>(query, queryValues);
  
  return {
    data: result.rows,
    total,
    page,
    limit,
  };
}

/** Campaña con estadísticas de cola de envíos */
export interface CampanaConStats extends Campana {
  stats: {
    total: number;
    pendientes: number;
    enviados: number;
    fallidos: number;
    abiertos: number;
    clicks: number;
  };
}

/**
 * Obtiene una campaña con estadísticas agregadas de su cola de envíos.
 */
export async function obtenerCampanaConEstadisticas(
  id: string,
): Promise<CampanaConStats | null> {
  const campana = await obtenerCampanaPorId(id);
  if (!campana) return null;

  const statsQuery = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
      COUNT(*) FILTER (WHERE estado = 'enviado')::int AS enviados,
      COUNT(*) FILTER (WHERE estado = 'fallido')::int AS fallidos,
      COUNT(*) FILTER (WHERE fecha_apertura IS NOT NULL)::int AS abiertos,
      COUNT(*) FILTER (WHERE fecha_click IS NOT NULL)::int AS clicks
    FROM cola_envios
    WHERE campana_id = $1;
  `;

  const statsResult = await dbPool.query<{
    total: number;
    pendientes: number;
    enviados: number;
    fallidos: number;
    abiertos: number;
    clicks: number;
  }>(statsQuery, [id]);

  const stats = statsResult.rows[0] ?? {
    total: 0,
    pendientes: 0,
    enviados: 0,
    fallidos: 0,
    abiertos: 0,
    clicks: 0,
  };

  return { ...campana, stats };
}

export async function eliminarCampanasMasivo(ids: string[]): Promise<boolean> {
  const query = 'UPDATE campanas SET eliminado_en = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[]) AND eliminado_en IS NULL RETURNING id;';
  const { rowCount } = await dbPool.query(query, [ids]);
  return (rowCount ?? 0) > 0;
}