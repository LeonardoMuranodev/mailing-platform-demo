import bcrypt from 'bcrypt';
import { dbPool } from '../config/db.js';
import type { Rol } from '../types/usuario.js';
import fs from 'node:fs';
import path from 'node:path';

export async function seedUsuarios(): Promise<void> {
  try {
    const result = await dbPool.query('SELECT COUNT(*) FROM usuarios');
    const count = parseInt(result.rows[0].count, 10);

    if (count === 0) {
      console.log('[Seed] No hay usuarios. Creando usuario desarrollador...');
      const email = process.env.ADMIN_EMAIL || 'admin@gmail.com';
      const password = process.env.ADMIN_PASSWORD || 'admin123';
      const rol: Rol = 'desarrollador';

      const saltRounds = 10;
      const migration3 = fs.readFileSync(path.join(process.cwd(), 'src/migrations/003_usuarios.sql'), 'utf-8');
      await dbPool.query(migration3);

      const migration4 = fs.readFileSync(path.join(process.cwd(), 'src/migrations/004_soporte.sql'), 'utf-8');
      await dbPool.query(migration4);

      console.log('✅ Tablas creadas correctamente');

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
