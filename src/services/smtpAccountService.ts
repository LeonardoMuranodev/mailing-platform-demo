import { dbPool } from '../config/db.js';
import type {
  CuentaSmtp,
  CrearCuentaSmtpInput,
  ActualizarCuentaSmtpInput,
} from '../types/smtp.js';

/**
 * Registra una nueva cuenta SMTP en el pool.
 */
export async function crearCuentaSmtp(data: CrearCuentaSmtpInput): Promise<CuentaSmtp> {
  const {
    email,
    host = 'smtp.gmail.com',
    puerto = 587,
    usuario,
    password_encrypted,
    limite_diario = 400,
  } = data;

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
    password_encrypted,
    limite_diario,
  ]);

  return result.rows[0];
}

/**
 * Lista todas las cuentas SMTP con resumen de cuota.
 */
export async function listarCuentasSmtp(): Promise<CuentaSmtp[]> {
  const query = `
    SELECT *
    FROM cuentas_smtp
    ORDER BY creado_en DESC
  `;

  const result = await dbPool.query<CuentaSmtp>(query);
  return result.rows;
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
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
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
  return result.rows[0] ?? null;
}

/**
 * Elimina una cuenta SMTP por su UUID.
 */
export async function eliminarCuentaSmtp(id: string): Promise<CuentaSmtp | null> {
  const query = `DELETE FROM cuentas_smtp WHERE id = $1 RETURNING *`;
  const result = await dbPool.query<CuentaSmtp>(query, [id]);
  return result.rows[0] ?? null;
}
