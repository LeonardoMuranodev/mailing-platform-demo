import { dbPool } from '../config/db.js';
import { parsearDestinatariosManuales, parsearRubrosSeleccionados } from '../utils/campanaParsers.js';
import type { CuentaSmtp } from '../types/smtp.js';
import type { PoblarColaResult } from '../types/colaEnvios.js';
import type { Campana } from '../types/campana.js';

/**
 * Consulta la campaña, obtiene contactos según rubros y los inserta
 * masivamente en `cola_envios` con estado 'pendiente'.
 *
 * — Si `para_todos_rubros` es true → todos los contactos de la base oficial con estado 'funcional' (es_contacto_base = true).
 * — Si es false → filtra por rubros cuyo `nombre` coincida con `rubros_seleccionados` (es_contacto_base = true).
 * — Si `tipo_audiencia` es 'manual' → inserta o usa exclusivamente los `destinatarios_manuales`.
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

  // 2. Verificar que la campaña esté en estado "aprobada" o "borrador"
  if (campana.estado !== 'aprobada' && campana.estado !== 'borrador') {
    throw new Error(
      `La campaña debe estar en estado "aprobada" o "borrador" para poblar la cola. Estado actual: "${campana.estado}"`,
    );
  }

  // 3. Manejo según tipo_audiencia ('manual' vs 'rubros')
  if (campana.tipo_audiencia === 'manual') {
    const emailsUnicos = parsearDestinatariosManuales(campana.destinatarios_manuales);

    if (emailsUnicos.length === 0) {
      return {
        campana_id: campanaId,
        total_insertados: 0,
        para_todos_rubros: false,
        rubros_filtrados: [],
      };
    }

    // Asegurar que existan en la tabla contactos para tener tracking y consistencia,
    // pero marcados como es_contacto_base = false para no mezclarlos con la base oficial.
    await dbPool.query(`
      INSERT INTO contactos (email, empresa_nombre, estado, es_contacto_base)
      SELECT unnest($1::text[]), 'Destinatario Manual', 'funcional', false
      ON CONFLICT (email) DO UPDATE SET estado = CASE WHEN contactos.estado = 'inactivo' THEN 'funcional' ELSE contactos.estado END
    `, [emailsUnicos]);

    const contactosResult = await dbPool.query<{ id: string }>(
      `SELECT id FROM contactos WHERE email = ANY($1::text[])`,
      [emailsUnicos]
    );

    const contactoIds = contactosResult.rows.map((row) => row.id);

    const insertQuery = `
      INSERT INTO cola_envios (campana_id, contacto_id, estado)
      SELECT $1, unnest($2::uuid[]), 'pendiente'
      ON CONFLICT DO NOTHING
    `;

    const insertResult = await dbPool.query(insertQuery, [campanaId, contactoIds]);

    return {
      campana_id: campanaId,
      total_insertados: insertResult.rowCount ?? contactoIds.length,
      para_todos_rubros: false,
      rubros_filtrados: [],
    };
  }

  // 4. Parsear rubros_seleccionados (almacenados como JSON string en DB)
  const rubrosSeleccionados = parsearRubrosSeleccionados(campana.rubros_seleccionados);

  // 5. Construir la query de contactos según filtro de rubros (filtrando estrictamente por la base oficial: es_contacto_base = true)
  let contactosQuery: string;
  let contactosParams: unknown[];

  if (campana.para_todos_rubros) {
    // Todos los contactos funcionales de la base oficial (excluyendo destinatarios manuales)
    contactosQuery = `SELECT id FROM contactos WHERE estado = 'funcional' AND es_contacto_base = true`;
    contactosParams = [];
  } else {
    const isSinRubro = rubrosSeleccionados.includes('__sin_rubro__') || rubrosSeleccionados.some(r => r.toLowerCase() === 'sin rubro');
    const validRubros = rubrosSeleccionados
      .filter(r => r !== '__sin_rubro__' && r.toLowerCase() !== 'sin rubro')
      .map(r => r.trim().toLowerCase());

    const sinRubroCondition = `(c.rubro_id IS NULL OR c.rubro_id = '' OR LOWER(TRIM(c.rubro_id)) = 'sin rubro')`;

    if (isSinRubro && validRubros.length > 0) {
      contactosQuery = `
        SELECT c.id
        FROM contactos c
        LEFT JOIN rubros r ON c.rubro_id::text = r.id::text
        WHERE c.estado = 'funcional'
          AND c.es_contacto_base = true
          AND (
            LOWER(TRIM(r.nombre)) = ANY($1::text[])
            OR c.rubro_id = ANY($1)
            OR c.rubro_id::text = ANY($1::text[])
            OR ${sinRubroCondition}
          )
      `;
      contactosParams = [validRubros];
    } else if (isSinRubro) {
      contactosQuery = `
        SELECT c.id
        FROM contactos c
        WHERE c.estado = 'funcional'
          AND c.es_contacto_base = true
          AND ${sinRubroCondition}
      `;
      contactosParams = [];
    } else {
      contactosQuery = `
        SELECT c.id
        FROM contactos c
        LEFT JOIN rubros r ON c.rubro_id::text = r.id::text
        WHERE c.estado = 'funcional'
          AND c.es_contacto_base = true
          AND (
            LOWER(TRIM(r.nombre)) = ANY($1::text[])
            OR c.rubro_id = ANY($1)
            OR c.rubro_id::text = ANY($1::text[])
          )
      `;
      contactosParams = [validRubros];
    }
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

  // 6. INSERT masivo en cola_envios usando unnest para eficiencia
  const contactoIds = contactosResult.rows.map((row) => row.id);

  const insertQuery = `
    INSERT INTO cola_envios (campana_id, contacto_id, estado)
    SELECT $1, unnest($2::uuid[]), 'pendiente'
    ON CONFLICT DO NOTHING
  `;

  const insertResult = await dbPool.query(insertQuery, [campanaId, contactoIds]);

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
 * EXCLUYE cuentas exclusivas (es_exclusiva = true), preservándolas para envíos específicos/manuales.
 */
export async function obtenerSiguienteSmtpDisponible(): Promise<CuentaSmtp | null> {
  const query = `
    SELECT *
    FROM cuentas_smtp
    WHERE estado = 'activo'
      AND enviados_hoy < limite_diario
      AND (es_exclusiva IS FALSE OR es_exclusiva IS NULL)
    ORDER BY ultimo_uso ASC NULLS FIRST
    LIMIT 1
  `;

  const result = await dbPool.query<CuentaSmtp>(query);
  return result.rows[0] ?? null;
}

/**
 * Obtiene la cuenta SMTP específica fijada a una campaña (o la cuenta principal).
 */
export async function obtenerSmtpExclusivo(cuentaId?: string | null): Promise<CuentaSmtp | null> {
  if (cuentaId) {
    const query = `
      SELECT *
      FROM cuentas_smtp
      WHERE id = $1
        AND estado = 'activo'
        AND enviados_hoy < limite_diario
      LIMIT 1
    `;
    const res = await dbPool.query<CuentaSmtp>(query, [cuentaId]);
    if (res.rows[0]) return res.rows[0];
  }

  const queryPrincipal = `
    SELECT *
    FROM cuentas_smtp
    WHERE (es_principal = true OR es_exclusiva = true)
      AND estado = 'activo'
      AND enviados_hoy < limite_diario
    ORDER BY es_principal DESC, es_exclusiva DESC
    LIMIT 1
  `;
  const resPrincipal = await dbPool.query<CuentaSmtp>(queryPrincipal);
  if (resPrincipal.rows[0]) return resPrincipal.rows[0];

  return obtenerSiguienteSmtpDisponible();
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
    conditions.push(`COALESCE(ce.fecha_envio, ce.creado_en) >= $${paramIdx}::date`);
    values.push(filtros.fecha_desde);
    paramIdx++;
  }

  if (filtros.fecha_hasta) {
    conditions.push(`COALESCE(ce.fecha_envio, ce.creado_en) < ($${paramIdx}::date + interval '1 day')`);
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
