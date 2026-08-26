import { dbPool } from '../config/db.js';
import type {
  CuentaSmtp,
  CrearCuentaSmtpInput,
  ActualizarCuentaSmtpInput,
} from '../types/smtp.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import nodemailer from 'nodemailer';

function omitPassword(cuenta: CuentaSmtp): CuentaSmtp {
  if (!cuenta) return cuenta;
  return { ...cuenta, password_encrypted: '********' };
}

/**
 * Verifica las credenciales SMTP. Lanza error si fallan.
 */
async function verificarConexionSmtp(host: string, puerto: number, usuario: string, pass: string) {
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: puerto,
      secure: puerto === 465,
      auth: {
        user: usuario,
        pass,
      },
      connectionTimeout: 10000,
    });
    await transporter.verify();
  } catch (error: any) {
    if (error.responseCode === 535 || (error.message && error.message.includes('Auth')) || (error.message && error.message.includes('Username and Password'))) {
      throw new Error('Contraseña de aplicación inválida o el usuario no existe.');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw new Error('El host SMTP es inválido o no se pudo alcanzar.');
    } else {
      throw new Error('Error al conectar con el servidor SMTP: ' + error.message);
    }
  }
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
    minimo_por_ejecucion = 5,
    maximo_por_ejecucion = 25,
  } = data;

  const authUser = usuario || email;
  await verificarConexionSmtp(host, puerto, authUser, password_encrypted);

  const encryptedPassword = encrypt(password_encrypted);

  const query = `
    INSERT INTO cuentas_smtp (email, host, puerto, usuario, password_encrypted, limite_diario, minimo_por_ejecucion, maximo_por_ejecucion)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const result = await dbPool.query<CuentaSmtp>(query, [
    email,
    host,
    puerto,
    usuario,
    encryptedPassword,
    limite_diario,
    minimo_por_ejecucion,
    maximo_por_ejecucion,
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
  const cuentaQuery = `SELECT * FROM cuentas_smtp WHERE id = $1`;
  const cuentaResult = await dbPool.query<CuentaSmtp>(cuentaQuery, [id]);
  const cuentaActual = cuentaResult.rows[0];
  
  if (!cuentaActual) return null;

  const willUpdateConnection = 
    data.host !== undefined || 
    data.puerto !== undefined || 
    data.usuario !== undefined || 
    data.password_encrypted !== undefined ||
    data.email !== undefined;

  if (willUpdateConnection) {
    const hostToVerify = data.host ?? cuentaActual.host;
    const puertoToVerify = data.puerto ?? cuentaActual.puerto;
    const emailToVerify = data.email ?? cuentaActual.email;
    const usuarioToVerify = data.usuario ?? cuentaActual.usuario ?? emailToVerify;
    let passToVerify = data.password_encrypted;
    
    if (!passToVerify) {
      passToVerify = decrypt(cuentaActual.password_encrypted);
    }

    await verificarConexionSmtp(hostToVerify, puertoToVerify, usuarioToVerify, passToVerify);
  }

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
