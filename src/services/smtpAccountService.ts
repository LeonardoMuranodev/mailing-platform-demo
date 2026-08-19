import { dbPool } from '../config/db.js';
import type {
  CuentaSmtp,
  CrearCuentaSmtpInput,
  ActualizarCuentaSmtpInput,
} from '../types/smtp.js';
import { encrypt } from '../utils/encryption.js';

function omitPassword(cuenta: CuentaSmtp): CuentaSmtp {
  if (!cuenta) return cuenta;
  return { ...cuenta, password_encrypted: '********' };
}

/**
 * Registra una nueva cuenta SMTP en el pool.
 */
export async function crearCuentaSmtp(data: CrearCuentaSmtpInput): Promise<CuentaSmtp> {
  const {
    email,
    host = 'smtp.gmail.com',
    puerto = 465,
    usuario,
    password_encrypted,
    limite_diario = 400,
  } = data;

  const encryptedPassword = encrypt(password_encrypted);

  const query = `
    INSERT INTO cuentas_smtp (email, host, puerto, usuario, password_encrypted, limite_diario)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const result = await dbPool.query<CuentaSmtp>(query, [
    email,
    host,
    puerto,
    usuario,
    encryptedPassword,
    limite_diario,
  ]);

  return omitPassword(result.rows[0]);
}

/**
 * Lista todas las cuentas SMTP con resumen de cuota y estadísticas históricas.
 */
export async function listarCuentasSmtp(): Promise<(CuentaSmtp & { historial_despachado?: number })[]> {
  const query = `
    SELECT 
      c.*,
      COALESCE((
        SELECT COUNT(*)
        FROM cola_envios ce
        WHERE ce.cuenta_smtp_id = c.id AND ce.estado IN ('enviado', 'fallido')
      ), 0)::int AS historial_despachado
    FROM cuentas_smtp c
    ORDER BY c.creado_en DESC
  `;

  const result = await dbPool.query(query);
  return result.rows.map(omitPassword);
}

/**
 * Actualiza parcialmente una cuenta SMTP.
 * Solo modifica los campos proporcionados.
 */
export async function actualizarCuentaSmtp(
  id: string,
  data: ActualizarCuentaSmtpInput,
): Promise<CuentaSmtp | null> {
  // Construir SET dinámico solo con campos presentes
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  const entries = Object.entries(data) as [keyof ActualizarCuentaSmtpInput, unknown][];
  for (const [key, value] of entries) {
    if (value !== undefined) {
      if (key === 'password_encrypted') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(encrypt(value as string));
      } else {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    }
  }

  if (fields.length === 0) {
    throw new Error('No se proporcionaron campos para actualizar');
  }

  // Siempre actualizar timestamp
  fields.push(`actualizado_en = CURRENT_TIMESTAMP`);

  const query = `
    UPDATE cuentas_smtp
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;
  values.push(id);

  const result = await dbPool.query<CuentaSmtp>(query, values);
  return result.rows[0] ? omitPassword(result.rows[0]) : null;
}

/**
 * Elimina una cuenta SMTP por su UUID.
 */
export async function eliminarCuentaSmtp(id: string): Promise<CuentaSmtp | null> {
  const query = `DELETE FROM cuentas_smtp WHERE id = $1 RETURNING *`;
  const result = await dbPool.query<CuentaSmtp>(query, [id]);
  return result.rows[0] ? omitPassword(result.rows[0]) : null;
}

/**
 * Activa o desactiva (toggle) el estado de una cuenta SMTP.
 */
export async function toggleEstadoSmtp(id: string, nuevoEstado: string): Promise<CuentaSmtp | null> {
  const query = `
    UPDATE cuentas_smtp
    SET estado = $1, actualizado_en = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const result = await dbPool.query<CuentaSmtp>(query, [nuevoEstado, id]);
  return result.rows[0] ? omitPassword(result.rows[0]) : null;
}
