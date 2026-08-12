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
