import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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
