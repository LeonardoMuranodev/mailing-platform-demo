import express from 'express';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import { logger } from './utils/logger.js';
import { config } from './config/env.js';
import { testDbConnection, dbPool } from './config/db.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { securityHeaders } from './middlewares/securityHeaders.js';
import { corsMiddleware } from './middlewares/cors.js';
import {
  notifyDbError,
  notifyUncaughtException,
  notifyUnhandledRejection,
} from './services/telegramNotifier.js';
import { procesarCola } from './services/emailWorker.js';
import { procesarRebotes, MODO_PRUEBA } from './services/bounceService.js';
import { resetearContadoresSmtp } from './services/smtpAccountService.js';
import { syncContactosFromSheetsCron } from './services/googleSheetsService.js';
import { getClientIdentifier } from './middlewares/rateLimiter.js';
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';
const app = express();

// Confiar en Nginx (1 salto de proxy) para Rate Limiting
app.set('trust proxy', 1);

// ── Security Middlewares ─────────────────────────────────
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(cookieParser());

// ── Global Rate Limiter ──────────────────────────────────
// Protección general para la aplicación (5000 peticiones por usuario/IP cada 15 min)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5000,
  keyGenerator: getClientIdentifier,
  validate: { trustProxy: false, keyGeneratorIpFallback: false },
  skip: (req) => {
    // Excluir endpoints de polling recurrente, SSE streaming, healthcheck y archivos estáticos
    return req.path.endsWith('/sync-status') || req.path.endsWith('/stream') || req.path.endsWith('/health') || req.path.startsWith('/uploads');
  },
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiadas peticiones, intente más tarde' } },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ── Body Parsers (con límite de tamaño y captura de rawBody para firmas Svix) ───
app.use(
  express.json({
    limit: '1mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Servir archivos subidos de forma estática
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// ── Routes ──────────────────────────────────────────────
registerRoutes(app);

// ── Global Error Handler (DEBE ir después de las rutas) ─
app.use(errorHandler);

// ── Global Process Error Handlers ───────────────────────
process.on('uncaughtException', async (error) => {
  logger.error('[FATAL] Uncaught Exception:', { error: error.message, stack: error.stack });
  await notifyUncaughtException(error);
  // Dar tiempo al mensaje de Telegram antes de cerrar
  setTimeout(() => process.exit(1), 2000);
});

process.on('unhandledRejection', async (reason) => {
  logger.error('[FATAL] Unhandled Rejection:', reason);
  await notifyUnhandledRejection(reason);
  // Dar tiempo al mensaje de Telegram antes de cerrar
  setTimeout(() => process.exit(1), 2000);
});

// Notificar errores inesperados del pool de BD
dbPool.on('error', async (err) => {
  logger.error('[DB] Unexpected pool error:', err.message);
  await notifyDbError(err);
});

import { seedUsuarios } from './scripts/seedUsuarios.js';
import fs from 'node:fs';

async function runMigrations(): Promise<void> {
  const candidates = [
    path.resolve(process.cwd(), 'src/migrations'),
    path.resolve(process.cwd(), 'dist/migrations'),
  ];
  const migrationsDir = candidates.find(d => fs.existsSync(d));
  if (!migrationsDir) {
    logger.warn('[Migration] No se encontró directorio de migraciones, saltando...');
    return;
  }

  // Crear tabla de tracking si no existe
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err: any) {
    logger.error('Error al inicializar tabla _schema_migrations:', err.message);
  }

  let appliedSet = new Set<string>();
  try {
    const { rows: appliedRows } = await dbPool.query<{ filename: string }>(
      'SELECT filename FROM _schema_migrations'
    );
    appliedSet = new Set(appliedRows.map(r => r.filename));
  } catch (err: any) {
    logger.warn('[Migration] No se pudo leer _schema_migrations, ejecutando con verificación inline:', err.message);
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }

    try {
      const rawSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const sql = rawSql.replace(/^\uFEFF/, '').trim();
      await dbPool.query(sql);
      await dbPool.query(
        'INSERT INTO _schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
        [file]
      );
      logger.info(`✅ [Migration] ${file} OK`);
    } catch (err: any) {
      if (err.code === '42701' || err.code === '42P07' || err.code === '42710') {
        logger.info(`⏭️ [Migration] ${file} ya aplicada (skip)`);
        await dbPool.query(
          'INSERT INTO _schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        ).catch(() => {});
      } else {
        logger.error(`❌ [Migration] ${file} falló:`, err.message);
      }
    }
  }
}

// ── Start ───────────────────────────────────────────────
app.listen(config.port, async () => {
  logger.info(`🚀 Server listening on http://localhost:${config.port}`);
  await testDbConnection();
  await runMigrations();
  await seedUsuarios();

  // Iniciar worker SMTP con Cron (Lunes a Viernes de 9 a 17 hs cada 30 min, o cada 1 min en TEST)
  const cronSmtp = MODO_PRUEBA ? '* * * * *' : '*/30 9-17 * * 1-5';
  logger.info(`🔄 Iniciando Worker SMTP (Cron: ${cronSmtp})...`);
  cron.schedule(cronSmtp, () => procesarCola(false), {
    timezone: 'America/Argentina/Buenos_Aires',
  });

  // Iniciar procesador de rebotes IMAP (Lunes a Viernes a las 18:00 hs, o cada 5 min en TEST)
  const cronExpression = MODO_PRUEBA ? '*/5 * * * *' : '5 9-17 * * 1-5';
  logger.info(`📥 Iniciando Worker IMAP de Rebotes (Cron: ${cronExpression})...`);
  cron.schedule(cronExpression, procesarRebotes, {
    timezone: 'America/Argentina/Buenos_Aires',
  });

  // Tarea de mantenimiento diario a la medianoche
  const cronMedianoche = MODO_PRUEBA ? '*/10 * * * *' : '0 0 * * *';
  logger.info(`🕛 Programando reset de contadores SMTP (Cron: ${cronMedianoche})...`);
  cron.schedule(cronMedianoche, async () => {
    try {
      await resetearContadoresSmtp();
      logger.info('[CRON] Contadores SMTP reseteados correctamente.');
    } catch (err: any) {
      logger.error('[CRON] Error reseteando contadores SMTP:', err.message);
    }
  }, {
    timezone: 'America/Argentina/Buenos_Aires',
  });

  // Sincronización automática de contactos desde Google Sheets
  // Se ejecuta cada 2 horas (de 8 a 18 hs los días hábiles) en segundo plano
  const cronSheets = MODO_PRUEBA ? '*/15 * * * *' : '0 8-18/2 * * 1-5';
  logger.info(`📊 Programando sincronización automática con Google Sheets (Cron: ${cronSheets})...`);
  cron.schedule(cronSheets, syncContactosFromSheetsCron, {
    timezone: 'America/Argentina/Buenos_Aires',
  });
});

