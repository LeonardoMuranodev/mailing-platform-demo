import bcrypt from 'bcrypt';
import { dbPool } from '../config/db.js';
import type { Rol } from '../types/usuario.js';

export async function seedUsuarios(): Promise<void> {
  try {
    const result = await dbPool.query('SELECT COUNT(*) FROM usuarios');
    const count = parseInt(result.rows[0].count, 10);

    if (count === 0) {
      console.log('[Seed] No hay usuarios. Creando usuario desarrollador...');
      const email = 'admin@3f.com';
      const password = 'admin123';
      const rol: Rol = 'desarrollador';
      
      const saltRounds = 10;
      const hash = await bcrypt.hash(password, saltRounds);

      await dbPool.query(
        'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4)',
        ['Desarrollador', email, hash, rol]
      );

      console.log(`[Seed] Usuario creado: ${email} / ${password} (rol: ${rol})`);
    } else {
      console.log('[Seed] Ya existen usuarios, omitiendo seed.');
    }
  } catch (error) {
    console.error('[Seed] Error al crear usuarios:', error);
  }
}
