import bcrypt from 'bcrypt';
import { dbPool } from '../config/db.js';
import type { Rol } from '../types/usuario.js';
import fs from 'node:fs';
import path from 'node:path';

export async function seedUsuarios(): Promise<void> {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@organizacion.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const rol: Rol = 'desarrollador';
    const saltRounds = 10;

    const result = await dbPool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const hash = await bcrypt.hash(password, saltRounds);

    if (result.rows.length === 0) {
      console.log(`[Seed] Usuario ${email} no encontrado. Creando...`);
      await dbPool.query(
        'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4)',
        ['Desarrollador', email, hash, rol]
      );
      console.log(`[Seed] Usuario creado: ${email} / ${password} (rol: ${rol})`);
    } else {
      console.log(`[Seed] Usuario ${email} encontrado. Actualizando contraseña...`);
      await dbPool.query(
        'UPDATE usuarios SET password_hash = $1 WHERE email = $2',
        [hash, email]
      );
      console.log(`[Seed] Contraseña actualizada para: ${email} / ${password}`);
    }
  } catch (error) {
    console.error('[Seed] Error al crear o actualizar usuarios:', error);
  }
}
