import { dbPool } from '../config/db.js';
import fs from 'fs';
import path from 'path';

async function migrate() {
  try {
    console.log('Ejecutando migraciones SQL...');
    const sqlPath = path.resolve('src/migrations/001_smtp_cola_envios.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await dbPool.query(sql);

    const sqlPath2 = path.resolve('src/migrations/002_add_cuit.sql');
    const sql2 = fs.readFileSync(sqlPath2, 'utf8');
    await dbPool.query(sql2);

    console.log('Migraciones ejecutadas exitosamente.');
  } catch (e) {
    console.error('Error migrando DB:', e);
  } finally {
    await dbPool.end();
  }
}
migrate();
