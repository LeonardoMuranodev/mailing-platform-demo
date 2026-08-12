import { Pool } from 'pg';
import { config } from './env.js';

export const dbPool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

dbPool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Verifica la conectividad al iniciar el servidor.
 * No lanza excepción para no bloquear el arranque.
 */
export async function testDbConnection(): Promise<void> {
  try {
    const client = await dbPool.connect();
    console.log('[DB] ✅ Connected to Supabase PostgreSQL');
    client.release();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DB] ❌ Connection failed:', message);
  }
}
