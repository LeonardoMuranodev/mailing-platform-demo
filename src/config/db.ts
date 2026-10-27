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


/**
 * Verifica la conectividad al iniciar el servidor.
 * No lanza excepción para no bloquear el arranque.
 */
export async function testDbConnection(): Promise<void> {
  try {
    const client = await dbPool.connect();
    const modoTexto = config.modoPrueba ? 'MODO PRUEBA' : 'PRODUCCIÓN';
    console.log(`[DB] ✅ Connected to Supabase PostgreSQL (${modoTexto}) [user: ${config.db.user}, host: ${config.db.host}]`);
    client.release();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DB] ❌ Connection failed:', message);
  }
}
