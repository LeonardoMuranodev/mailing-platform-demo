import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { dbPool } from '../config/db.js';
import { config } from '../config/env.js';
import type { Usuario, UsuarioPublico, JwtPayload } from '../types/usuario.js';

export async function login(email: string, password_plain: string): Promise<{ token: string; user: UsuarioPublico }> {
  // Buscar usuario
  const result = await dbPool.query<Usuario>('SELECT * FROM usuarios WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user) {
    throw new Error('Credenciales inválidas');
  }

  // Verificar password
  const isValid = await bcrypt.compare(password_plain, user.password_hash);
  if (!isValid) {
    throw new Error('Credenciales inválidas');
  }

  // Generar JWT
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    rol: user.rol,
  };

  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });

  return {
    token,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
    },
  };
}

export function verificarToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch (err) {
    throw new Error('Token inválido o expirado');
  }
}

export async function obtenerUsuarioPorId(id: string): Promise<UsuarioPublico | null> {
  const result = await dbPool.query<UsuarioPublico>(
    'SELECT id, nombre, email, rol FROM usuarios WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

import { enviarMailTransaccional } from './notificationService.js';

export async function forgotPassword(email: string): Promise<void> {
  const userResult = await dbPool.query<Usuario>('SELECT * FROM usuarios WHERE email = $1', [email]);
  const user = userResult.rows[0];
  if (!user) {
    // Para no revelar qué usuarios existen, simulamos éxito
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiraEn = new Date(Date.now() + 1800000); // 30 minutos (30 * 60 * 1000)
  
  await dbPool.query(
    'INSERT INTO tokens_recuperacion (usuario_id, token, expira_en) VALUES ($1, $2, $3)',
    [user.id, token, expiraEn]
  );

  const baseUrl = config.appUrl;
  const resetLink = `${baseUrl}/reset-password?token=${token}`;
  
  const cuerpo_html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de contraseña</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" max-width="500" style="max-width: 500px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid #e1e6eb; text-align: center;">
          
          <!-- Banner Superior Institucional -->
          <tr>
            <td style="background-color: #004578; border-top: 6px solid #E87722; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 600; margin: 0;">Restablecer tu contraseña</h1>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding: 40px 30px; color: #333333; font-size: 16px; line-height: 1.6;">
              <p style="margin: 0 0 20px 0;">Hola <strong>${user.nombre}</strong>,</p>
              <p style="margin: 0 0 20px 0;">Recibimos una solicitud para restablecer tu contraseña en GenMailer.</p>
              <p style="margin: 0 0 25px 0;">Hacé clic en el siguiente botón para continuar (este enlace expira en <strong>30 minutos</strong>):</p>
              
              <a href="${resetLink}" style="display: inline-block; background-color: #004578; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 6px; font-size: 16px;">Restablecer contraseña</a>

              <p style="margin: 30px 0 0 0; font-size: 14px; color: #718096;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:</p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #2b6cb0; word-break: break-all;"><a href="${resetLink}" style="color: #2b6cb0;">${resetLink}</a></p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #718096;">Si no solicitaste este cambio, podés ignorar este correo.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await enviarMailTransaccional(user.email, 'Recuperación de Contraseña', cuerpo_html);
}

export async function resetPassword(token: string, newPassword_plain: string): Promise<void> {
  const { rows } = await dbPool.query(
    'SELECT * FROM tokens_recuperacion WHERE token = $1 AND usado = FALSE AND expira_en > NOW()',
    [token]
  );

  if (rows.length === 0) {
    throw new Error('El enlace de recuperación es inválido o ha expirado');
  }

  const tokenData = rows[0];
  const newPasswordHash = await bcrypt.hash(newPassword_plain, 10);

  // Todo en una transacción para asegurar consistencia
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [newPasswordHash, tokenData.usuario_id]);
    await client.query('UPDATE tokens_recuperacion SET usado = TRUE WHERE id = $1', [tokenData.id]);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function changePassword(userId: string, currentPassword_plain: string, newPassword_plain: string): Promise<void> {
  const { rows } = await dbPool.query<Usuario>('SELECT * FROM usuarios WHERE id = $1', [userId]);
  const user = rows[0];

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  const isValid = await bcrypt.compare(currentPassword_plain, user.password_hash);
  if (!isValid) {
    throw new Error('La contraseña actual es incorrecta');
  }

  const newPasswordHash = await bcrypt.hash(newPassword_plain, 10);
  await dbPool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);
}
