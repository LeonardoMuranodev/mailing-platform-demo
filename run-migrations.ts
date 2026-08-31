import { dbPool } from './src/config/db.js';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  try {
    const sql = fs.readFileSync(path.join(process.cwd(), 'src/migrations/007_campanas_pausada.sql'), 'utf-8');
    await dbPool.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

run();
