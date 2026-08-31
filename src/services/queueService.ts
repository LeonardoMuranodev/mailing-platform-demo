import { dbPool } from '../config/db.js';
import type { CuentaSmtp } from '../types/smtp.js';
import type { PoblarColaResult } from '../types/colaEnvios.js';
import type { Campana } from '../types/campana.js';

/**
 * Consulta la campaña, obtiene contactos según rubros y los inserta
 * masivamente en `cola_envios` con estado 'pendiente'.
 *
 * — Si `para_todos_rubros` es true → todos los contactos con estado 'funcional'.
 * — Si es false → filtra por rubros cuyo `nombre` coincida con `rubros_seleccionados`.
 */
export async function poblarColaEnvios(campanaId: string): Promise<PoblarColaResult> {
  // 1. Obtener la campaña
  const campanaResult = await dbPool.query<Campana>(
    `SELECT * FROM campanas WHERE id = $1`,
    [campanaId],
  );

  const campana = campanaResult.rows[0];
  if (!campana) {
    throw new Error(`Campaña con id "${campanaId}" no encontrada`);
  }

  // 2. Verificar que la campaña esté en estado "aprobada"
  if (campana.estado !== 'aprobada') {
    throw new Error(
      `La campaña debe estar en estado "aprobada" para poblar la cola. Estado actual: "${campana.estado}"`,
    );
  }

  // 3. Parsear rubros_seleccionados (almacenados como JSON string en DB)
  let rubrosSeleccionados: string[] = [];
  if (typeof campana.rubros_seleccionados === 'string') {
    rubrosSeleccionados = JSON.parse(campana.rubros_seleccionados) as string[];
  } else if (Array.isArray(campana.rubros_seleccionados)) {
    rubrosSeleccionados = campana.rubros_seleccionados;
  }

  // 4. Construir la query de contactos según filtro de rubros
  let contactosQuery: string;
  let contactosParams: unknown[];

  if (campana.para_todos_rubros) {
    // Todos los contactos funcionales
    contactosQuery = `SELECT id FROM contactos WHERE estado = 'funcional'`;
    contactosParams = [];
  } else {
    contactosQuery = `
      SELECT c.id
      FROM contactos c
      WHERE c.estado = 'funcional'
        AND c.rubro_id = ANY($1)
    `;
    contactosParams = [rubrosSeleccionados];
  }

  const contactosResult = await dbPool.query<{ id: string }>(contactosQuery, contactosParams);

  if (contactosResult.rows.length === 0) {
    return {
      campana_id: campanaId,
      total_insertados: 0,
      para_todos_rubros: campana.para_todos_rubros,
      rubros_filtrados: rubrosSeleccionados,
    };
  }

  // 5. INSERT masivo en cola_envios usando unnest para eficiencia
  const contactoIds = contactosResult.rows.map((row) => row.id);

  const insertQuery = `
    INSERT INTO cola_envios (campana_id, contacto_id, estado)
    SELECT $1, unnest($2::uuid[]), 'pendiente'
    ON CONFLICT DO NOTHING
  `;

  const insertResult = await dbPool.query(insertQuery, [campanaId, contactoIds]);

  // 6. La campaña queda en estado 'aprobada'. El worker la pasará a 'en_proceso' al enviar el primer mail.

  return {
    campana_id: campanaId,
    total_insertados: insertResult.rowCount ?? contactoIds.length,
    para_todos_rubros: campana.para_todos_rubros,
    rubros_filtrados: rubrosSeleccionados,
  };
}

/**
 * Selecciona la siguiente cuenta SMTP activa disponible (Round-Robin).
 * Criterio: estado='activo', enviados_hoy < limite_diario, ordenado por ultimo_uso ASC (NULLS FIRST).
 */
export async function obtenerSiguienteSmtpDisponible(): Promise<CuentaSmtp | null> {
  const query = `
    SELECT *
    FROM cuentas_smtp
    WHERE estado = 'activo'
      AND enviados_hoy < limite_diario
    ORDER BY ultimo_uso ASC NULLS FIRST
    LIMIT 1
  `;

  const result = await dbPool.query<CuentaSmtp>(query);
  return result.rows[0] ?? null;
}

/**
 * Incrementa `enviados_hoy` en +1 y actualiza `ultimo_uso`.
 * Si alcanza el límite diario, cambia el estado a 'agotado'.
 */
export async function incrementarCuotaSmtp(cuentaId: string): Promise<CuentaSmtp> {
  const query = `
    UPDATE cuentas_smtp
    SET
      enviados_hoy = enviados_hoy + 1,
      ultimo_uso = CURRENT_TIMESTAMP,
      actualizado_en = CURRENT_TIMESTAMP,
      estado = CASE
        WHEN enviados_hoy + 1 >= limite_diario THEN 'agotado'
        ELSE estado
      END
    WHERE id = $1
    RETURNING *
  `;

  const result = await dbPool.query<CuentaSmtp>(query, [cuentaId]);
  const cuenta = result.rows[0];

  if (!cuenta) {
    throw new Error(`Cuenta SMTP con id "${cuentaId}" no encontrada`);
  }

  return cuenta;
}

/** Item de la cola con datos de contacto y cuenta SMTP resueltos */
export interface ColaEnvioConDetalles {
  id: number;
  contacto_email: string;
  estado: string;
  respuesta_smtp: string | null;
  intentos: number;
  fecha_envio: string | null;
  fecha_apertura: string | null;
  fecha_click: string | null;
  cuenta_smtp_email: string | null;
  creado_en: string;
}

/** Filtros opcionales para la cola de envíos */
export interface FiltrosColaEnvios {
  estado?: string;
  email?: string;
  cuenta_smtp_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

/**
 * Obtiene la cola de envíos de una campaña con JOINs a contactos y cuentas_smtp.
 * Soporta filtros opcionales por estado, email, cuenta y rango de fecha.
 */
export async function obtenerColaPorCampana(
  campanaId: string,
  filtros: FiltrosColaEnvios = {},
): Promise<ColaEnvioConDetalles[]> {
  const conditions: string[] = ['ce.campana_id = $1'];
  const values: unknown[] = [campanaId];
  let paramIdx = 2;

  if (filtros.estado) {
    conditions.push(`ce.estado = $${paramIdx}`);
    values.push(filtros.estado);
    paramIdx++;
  }

  if (filtros.email) {
    conditions.push(`co.email ILIKE $${paramIdx}`);
    values.push(`%${filtros.email}%`);
    paramIdx++;
  }

  if (filtros.cuenta_smtp_id) {
    conditions.push(`ce.cuenta_smtp_id = $${paramIdx}`);
    values.push(filtros.cuenta_smtp_id);
    paramIdx++;
  }

  if (filtros.fecha_desde) {
    conditions.push(`ce.fecha_envio >= $${paramIdx}`);
    values.push(filtros.fecha_desde);
    paramIdx++;
  }

  if (filtros.fecha_hasta) {
    conditions.push(`ce.fecha_envio <= $${paramIdx}`);
    values.push(filtros.fecha_hasta);
    paramIdx++;
  }

  const query = `
    SELECT
      ce.id,
      co.email AS contacto_email,
      ce.estado,
      ce.respuesta_smtp,
      ce.intentos,
      ce.fecha_envio,
      ce.fecha_apertura,
      ce.fecha_click,
      cs.email AS cuenta_smtp_email,
      ce.creado_en
    FROM cola_envios ce
    INNER JOIN contactos co ON ce.contacto_id = co.id
    LEFT JOIN cuentas_smtp cs ON ce.cuenta_smtp_id = cs.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ce.creado_en DESC;
  `;

  const result = await dbPool.query<ColaEnvioConDetalles>(query, values);
  return result.rows;
}

