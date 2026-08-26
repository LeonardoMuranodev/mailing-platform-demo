import { Router } from 'express';
import { dbPool } from '../config/db.js';
import { redis } from '../config/redis.js';

const healthRouter = Router();

/**
 * GET /api/health
 * Endpoint público (sin auth) para healthchecks de Docker y monitoreo.
 * Verifica conectividad a PostgreSQL (Supabase) y Redis.
 */
healthRouter.get('/', async (_req, res) => {
  const checks: Record<string, boolean> = {
    db: false,
    redis: false,
  };

  // Verificar PostgreSQL
  try {
    const client = await dbPool.connect();
    client.release();
    checks.db = true;
  } catch {
    checks.db = false;
  }

  // Verificar Redis
  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG';
  } catch {
    checks.redis = false;
  }

  const allHealthy = checks.db && checks.redis;
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'ok' : 'degraded',
    checks,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export { healthRouter };
