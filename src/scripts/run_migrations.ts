import { dbPool } from '../config/db.js';
import fs from 'fs';
import path from 'path';

async function migrate() {
  try {
    console.log('Ejecutando migraciones SQL...');
    const migrationsDir = path.resolve('src/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort alphabetically (000, 001, 002, etc.)

    for (const file of files) {
      console.log(`Ejecutando: ${file}...`);
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await dbPool.query(sql);
    }

    console.log('Todas las migraciones fueron ejecutadas exitosamente.');
  } catch (e) {
    console.error('Error migrando DB:', e);
  } finally {
    await dbPool.end();
  }
}
migrate();
