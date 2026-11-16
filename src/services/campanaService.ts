import { dbPool } from '../config/db.js';
import { parsearDestinatariosManuales, parsearRubrosSeleccionados } from '../utils/campanaParsers.js';
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
 * Resuelve la exclusividad mutua de links (link_inscripcion vs link_nacion / link_provincia).
 */
export function resolverLinksExclusivos(
  linkInscripcion?: string | null,
  linkNacion?: string | null,
  linkProvincia?: string | null
): { link_inscripcion: string | null; link_nacion: string | null; link_provincia: string | null } {
  if (linkNacion || linkProvincia) {
    return {
      link_inscripcion: null,
      link_nacion: linkNacion || null,
      link_provincia: linkProvincia || null,
    };
  }
  return {
    link_inscripcion: linkInscripcion || null,
    link_nacion: null,
    link_provincia: null,
  };
}

/**
 * Obtiene el ID de la cuenta emisora principal por defecto (o primera disponible).
 */
export async function resolverCuentaEmisorExclusiva(): Promise<string | null> {
  const res = await dbPool.query<{ id: string }>(
    `SELECT id FROM cuentas_smtp 
     WHERE (es_principal = true OR es_exclusiva = true) AND estado = 'activo' 
     ORDER BY es_principal DESC, es_exclusiva DESC 
     LIMIT 1`
  );
  if (res.rows.length > 0) return res.rows[0].id;

  const fallback = await dbPool.query<{ id: string }>(
    `SELECT id FROM cuentas_smtp WHERE estado = 'activo' ORDER BY creado_en ASC LIMIT 1`
  );
  return fallback.rows[0]?.id || null;
}

/**
 * Inserta una nueva campaña con estado 'borrador'.
 */
export async function crearCampana(data: CrearCampanaInput): Promise<Campana> {
  const {
    asunto,
    cuerpo_html,
    link_inscripcion = null,
    link_nacion = null,
    link_provincia = null,
    flyer_url = null,
    adjunto_url = null,
    adjunto_nombre_original = null,
    adjuntos_extras = [],
    fecha_limite_envio,
    prioridad = 'alta',
    para_todos_rubros = true,
    rubros_seleccionados = [],
    tipo_audiencia = 'rubros',
    destinatarios_manuales = [],
    cuenta_emisor_id = null,
  } = data;

  // Si la campaña es de destinatarios manuales y no vino cuenta_emisor_id, asignar por defecto Cuenta Principal
  let finalCuentaEmisorId = cuenta_emisor_id || null;
  if (tipo_audiencia === 'manual' && !finalCuentaEmisorId) {
    finalCuentaEmisorId = await resolverCuentaEmisorExclusiva();
  }

  const query = `
    INSERT INTO campanas
      (asunto, cuerpo_html, link_inscripcion, link_nacion, link_provincia, flyer_url, adjunto_url, adjunto_nombre_original, adjuntos_extras,
       fecha_limite_envio, prioridad, para_todos_rubros, rubros_seleccionados, tipo_audiencia, destinatarios_manuales, cuenta_emisor_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *;
  `;

  const links = resolverLinksExclusivos(link_inscripcion, link_nacion, link_provincia);

  const values: unknown[] = [
    asunto,
    cuerpo_html || null,
    links.link_inscripcion,
    links.link_nacion,
    links.link_provincia,
    flyer_url || null,
    adjunto_url || null,
    adjunto_nombre_original || null,
    JSON.stringify(adjuntos_extras || []),
    fecha_limite_envio || null,
    prioridad,
    para_todos_rubros,
    JSON.stringify(rubros_seleccionados),
    tipo_audiencia,
    JSON.stringify(destinatarios_manuales || []),
    finalCuentaEmisorId,
  ];

  const result = await dbPool.query<Campana>(query, values);
  const campanaCreada = result.rows[0];

  // Poblar cola preliminar para previsualizar destinatarios en el borrador
  try {
    const { poblarColaEnvios } = await import('./queueService.js');
    await poblarColaEnvios(campanaCreada.id);
  } catch (err) {
    console.warn(`[Campana] No se pudo generar cola preliminar para borrador ${campanaCreada.id}:`, err);
  }

  return campanaCreada;
}

/**
 * Actualiza una campaña existente.
 * Solo debe permitirse si la campaña está en estado 'borrador'.
 */
export async function actualizarCampana(id: string, data: Partial<CrearCampanaInput>): Promise<Campana | null> {
  // Construimos el query dinámicamente según los campos que vengan
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.asunto !== undefined) {
    updates.push(`asunto = $${paramIdx++}`);
    values.push(data.asunto);
  }
  if (data.cuerpo_html !== undefined) {
    updates.push(`cuerpo_html = $${paramIdx++}`);
    values.push(data.cuerpo_html || null);
  }
  
  // Si envían algún link, procesamos la exclusividad (XOR)
  if (data.link_inscripcion !== undefined || data.link_nacion !== undefined || data.link_provincia !== undefined) {
    const links = resolverLinksExclusivos(data.link_inscripcion, data.link_nacion, data.link_provincia);
    updates.push(`link_inscripcion = $${paramIdx++}`);
    values.push(links.link_inscripcion);
    updates.push(`link_nacion = $${paramIdx++}`);
    values.push(links.link_nacion);
    updates.push(`link_provincia = $${paramIdx++}`);
    values.push(links.link_provincia);
  }

  if (data.flyer_url !== undefined) {
    updates.push(`flyer_url = $${paramIdx++}`);
    values.push(data.flyer_url || null);
  }
  if (data.adjunto_url !== undefined) {
    updates.push(`adjunto_url = $${paramIdx++}`);
    values.push(data.adjunto_url || null);
  }
  if (data.adjunto_nombre_original !== undefined) {
    updates.push(`adjunto_nombre_original = $${paramIdx++}`);
    values.push(data.adjunto_nombre_original || null);
  }
  if (data.adjuntos_extras !== undefined) {
    updates.push(`adjuntos_extras = $${paramIdx++}`);
    values.push(JSON.stringify(data.adjuntos_extras || []));
  }
  if (data.fecha_limite_envio !== undefined) {
    updates.push(`fecha_limite_envio = $${paramIdx++}`);
    values.push(data.fecha_limite_envio || null);
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
  if (data.tipo_audiencia !== undefined) {
    updates.push(`tipo_audiencia = $${paramIdx++}`);
    values.push(data.tipo_audiencia);
  }
  if (data.destinatarios_manuales !== undefined) {
    updates.push(`destinatarios_manuales = $${paramIdx++}`);
    values.push(JSON.stringify(data.destinatarios_manuales || []));
  }
  if (data.cuenta_emisor_id !== undefined) {
    updates.push(`cuenta_emisor_id = $${paramIdx++}`);
    values.push(data.cuenta_emisor_id || null);
  } else if (data.tipo_audiencia === 'manual') {
    const exclusivId = await resolverCuentaEmisorExclusiva();
    if (exclusivId) {
      updates.push(`cuenta_emisor_id = $${paramIdx++}`);
      values.push(exclusivId);
    }
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
  const campanaActualizada = result.rows[0] ?? null;

  if (campanaActualizada) {
    // Si la campaña está en borrador, resincronizar la cola preliminar
    // para reflejar altas/bajas de destinatarios manuales, cambios de rubros o paso a "toda la base".
    try {
      await dbPool.query(
        "DELETE FROM cola_envios WHERE campana_id = $1 AND estado = 'pendiente'",
        [id]
      );
      const { poblarColaEnvios } = await import('./queueService.js');
      await poblarColaEnvios(id);
    } catch (err) {
      console.warn(`[Campana] No se pudo resincronizar cola preliminar para borrador ${id}:`, err);
    }
  }

  return campanaActualizada;
}

/**
 * Cambia el estado de una campaña existente.
 * Actualiza el estado de una campaña
 */
export async function cambiarEstadoCampana(
  id: string,
  nuevoEstado: string,
): Promise<Campana | null> {
  if (nuevoEstado === 'aprobada') {
    const campanaActual = await obtenerCampanaPorId(id);
    if (!campanaActual) throw new Error('Campaña no encontrada');
    if (!campanaActual.cuerpo_html || campanaActual.cuerpo_html.trim() === '') {
      throw new Error('No se puede aprobar una campaña sin contenido del correo.');
    }
    if (!campanaActual.fecha_limite_envio) {
      throw new Error('No se puede aprobar una campaña sin fecha límite de envío.');
    }
    if (campanaActual.tipo_audiencia === 'manual') {
      const dests = parsearDestinatariosManuales(campanaActual.destinatarios_manuales);
      if (dests.length === 0) {
        throw new Error('No se puede aprobar una campaña manual sin destinatarios.');
      }
    }
  }

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
      // Si la cola ya contiene los destinatarios (generados al guardar el borrador),
      // no la volvemos a poblar para evitar duplicados.
      const conteoRes = await dbPool.query<{ count: string }>(
        'SELECT COUNT(*) FROM cola_envios WHERE campana_id = $1',
        [id]
      );
      const cantidad = parseInt(conteoRes.rows[0]?.count || '0', 10);
      if (cantidad === 0) {
        await poblarColaEnvios(id);
      }
    } catch (error) {
      console.error(`Error poblando cola para campaña ${id}:`, error);
    }
  } else if (campana && nuevoEstado === 'cancelada') {
    // Si se cancela la campaña antes de enviar, limpiamos los envíos pendientes
    try {
      await dbPool.query("DELETE FROM cola_envios WHERE campana_id = $1 AND estado = 'pendiente'", [id]);
    } catch (error) {
      console.error(`Error limpiando cola de campaña cancelada ${id}:`, error);
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
 * Desarchiva (restaura) una campaña, poniendo eliminado_en en NULL.
 */
export async function desarchivarCampana(id: string): Promise<boolean> {
  const query = `UPDATE campanas SET eliminado_en = NULL WHERE id = $1 AND eliminado_en IS NOT NULL RETURNING id`;
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
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  rubro?: string;
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

  if (filtros.rubro) {
    const rubroLower = filtros.rubro.toLowerCase().trim();
    if (filtros.rubro === '__sin_rubro__' || rubroLower === 'sin rubro' || rubroLower === 'sin_rubro') {
      conditions.push(`(para_todos_rubros = true OR rubros_seleccionados::jsonb ? '__sin_rubro__')`);
    } else {
      conditions.push(`(para_todos_rubros = true OR rubros_seleccionados::jsonb ? $${paramIdx})`);
      values.push(filtros.rubro);
      paramIdx++;
    }
  }

  if (filtros.estado === 'archivada') {
    conditions.push('eliminado_en IS NOT NULL');
  } else {
    if (filtros.estado) {
      conditions.push(`estado = $${paramIdx}`);
      values.push(filtros.estado);
      paramIdx++;
    }
    // Siempre excluir campañas borradas (soft delete) a menos que se busquen explícitamente
    conditions.push('eliminado_en IS NULL');
  }

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
    desglose_fallos?: Array<{ categoria: string; cantidad: number; porcentaje: number }>;
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

  let desglose_fallos: Array<{ categoria: string; cantidad: number; porcentaje: number }> = [];

  if (stats.fallidos > 0) {
    const fallosQuery = `
      SELECT respuesta_smtp, COUNT(*)::int AS cantidad
      FROM cola_envios
      WHERE campana_id = $1 AND (estado = 'fallido' OR (estado = 'pendiente' AND respuesta_smtp IS NOT NULL))
      GROUP BY respuesta_smtp;
    `;
    const fallosResult = await dbPool.query<{ respuesta_smtp: string | null; cantidad: number }>(fallosQuery, [id]);

    const catMap: Record<string, number> = {
      'Cancelado': 0,
      'Dominio Inexistente': 0,
      'Credenciales/Login SMTP': 0,
      'Cuota Excedida (Remitente)': 0,
      'Casilla Llena (Destinatario)': 0,
      'Rechazado por Spam': 0,
      'Email Mal Escrito': 0,
      'Otros': 0,
    };

    let totalAnalizados = 0;

    for (const row of fallosResult.rows) {
      const msg = (row.respuesta_smtp || '').toLowerCase();
      const count = row.cantidad;
      totalAnalizados += count;

      if (msg.includes('cancelad')) {
        catMap['Cancelado'] += count;
      } else if (msg.includes('domain not found') || msg.includes('nxdomain') || msg.includes('no such domain') || msg.includes('el correo o dominio no existe')) {
        catMap['Dominio Inexistente'] += count;
      } else if (msg.includes('mail_mal_escrito') || msg.includes('syntax error') || msg.includes('mal escrito')) {
        catMap['Email Mal Escrito'] += count;
      } else if (msg.includes('login') || msg.includes('auth') || msg.includes('password') || msg.includes('webloginrequired')) {
        catMap['Credenciales/Login SMTP'] += count;
      } else if ((msg.includes('daily sending limit') || msg.includes('quota exceeded')) && !msg.includes('mailbox') && !msg.includes('bandeja')) {
        catMap['Cuota Excedida (Remitente)'] += count;
      } else if (msg.includes('mailbox full') || msg.includes('storage full') || msg.includes('bandeja de entrada llena') || (msg.includes('quota') && (msg.includes('mailbox') || msg.includes('bandeja')))) {
        catMap['Casilla Llena (Destinatario)'] += count;
      } else if (msg.includes('spam') || msg.includes('blocked') || msg.includes('blacklisted') || msg.includes('bloqueado') || msg.includes('política del servidor')) {
        catMap['Rechazado por Spam'] += count;
      } else {
        catMap['Otros'] += count;
      }
    }

    if (totalAnalizados > 0) {
      desglose_fallos = Object.entries(catMap)
        .filter(([_, count]) => count > 0)
        .map(([categoria, cantidad]) => ({
          categoria,
          cantidad,
          porcentaje: Math.round((cantidad / totalAnalizados) * 100),
        }));
    }
  }

  return { ...campana, stats: { ...stats, desglose_fallos } };
}

export async function eliminarCampanasMasivo(ids: string[]): Promise<boolean> {
  const query = 'UPDATE campanas SET eliminado_en = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[]) AND eliminado_en IS NULL RETURNING id;';
  const { rowCount } = await dbPool.query(query, [ids]);
  return (rowCount ?? 0) > 0;
}

/**
 * Modifica la fecha límite de envío y/o prioridad de una campaña.
 * Permitido en estados 'borrador', 'aprobada', 'en_proceso' y 'pausada'.
 * Esto permite regular o acelerar el ritmo de despacho de correos en el worker
 * sin afectar destinatarios, contenido ni campañas existentes.
 */
export async function actualizarProgramacionCampana(
  id: string,
  data: { fecha_limite_envio: string; prioridad?: 'alta' | 'media' | 'baja' }
): Promise<Campana | null> {
  const campanaActual = await obtenerCampanaPorId(id);
  if (!campanaActual) return null;

  if (['completada', 'cancelada'].includes(campanaActual.estado)) {
    throw new Error(`No se puede modificar la programación de una campaña en estado '${campanaActual.estado}'`);
  }

  const updates: string[] = ['fecha_limite_envio = $1', 'actualizado_en = CURRENT_TIMESTAMP'];
  const values: any[] = [data.fecha_limite_envio];
  let paramIdx = 2;

  if (data.prioridad) {
    updates.push(`prioridad = $${paramIdx++}`);
    values.push(data.prioridad);
  }

  values.push(id);
  const query = `
    UPDATE campanas
    SET ${updates.join(', ')}
    WHERE id = $${paramIdx}
    RETURNING *;
  `;

  const result = await dbPool.query<Campana>(query, values);
  return result.rows[0] ?? null;
}