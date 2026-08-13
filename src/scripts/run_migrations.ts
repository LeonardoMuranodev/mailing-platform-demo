import { dbPool } from '../config/db.js';
import fs from 'fs';
import path from 'path';

async function migrate() {
  try {
    console.log('Ejecutando migraciones SQL...');
    const sqlPath = path.resolve('src/migrations/001_smtp_cola_envios.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await dbPool.query(sql);
    console.log('Migraciones ejecutadas exitosamente.');
  } catch (e) {
    console.error('Error migrando DB:', e);
  } finally {
    await dbPool.end();
  }
}
migrate();
