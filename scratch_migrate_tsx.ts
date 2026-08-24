import fs from 'fs';
import { dbPool } from './src/config/db.js';

async function runMigration() {
  try {
    const client = await dbPool.connect();
    console.log('Conectado a la base de datos (Pool)');
    const sql = fs.readFileSync('src/migrations/003_usuarios.sql', 'utf8');
    await client.query(sql);
    console.log('Migración 003 ejecutada exitosamente');
    client.release();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

runMigration();
