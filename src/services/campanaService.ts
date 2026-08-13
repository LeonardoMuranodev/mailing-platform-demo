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
 * Cambia el estado de una campaña existente.
 * Valida que el estado sea uno de los permitidos.
 */
export async function cambiarEstadoCampana(
  id: string,
  estado: EstadoCampana,
): Promise<Campana | null> {
  if (!ESTADOS_VALIDOS.has(estado)) {
    throw new Error(
      `Estado inválido: "${estado}". Valores permitidos: ${[...ESTADOS_VALIDOS].join(', ')}`,
    );
  }

  const query = `
    UPDATE campanas
    SET estado = $1, actualizado_en = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;

  const result = await dbPool.query<Campana>(query, [estado, id]);
  return result.rows[0] ?? null;
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
}

/**
 * Lista campañas con filtros opcionales.
 */
export async function listarCampanas(
  filtros: ListarCampanasFiltros = {},
): Promise<Campana[]> {
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

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const query = `SELECT * FROM campanas ${whereClause} ORDER BY creado_en DESC;`;
  const result = await dbPool.query<Campana>(query, values);
  return result.rows;
}

/** Campaña con estadísticas de cola de envíos */
export interface CampanaConStats extends Campana {
  stats: {
    total: number;
    pendientes: number;
    enviados: number;
    fallidos: number;
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
      COUNT(*) FILTER (WHERE estado = 'fallido')::int AS fallidos
    FROM cola_envios
    WHERE campana_id = $1;
  `;

  const statsResult = await dbPool.query<{
    total: number;
    pendientes: number;
    enviados: number;
    fallidos: number;
  }>(statsQuery, [id]);

  const stats = statsResult.rows[0] ?? {
    total: 0,
    pendientes: 0,
    enviados: 0,
    fallidos: 0,
  };

  return { ...campana, stats };
}

