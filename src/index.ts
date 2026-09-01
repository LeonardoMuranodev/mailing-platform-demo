import express from 'express';
import path from 'node:path';
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
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';
const app = express();

// ── Security Middlewares ─────────────────────────────────
app.use(securityHeaders);
app.use(corsMiddleware);

// ── Global Rate Limiter ──────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // Límite de 300 peticiones por IP cada 15 min
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiadas peticiones, intente más tarde' } },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ── Body Parsers (con límite de tamaño) ─────────────────
app.use(express.json({ limit: '1mb' }));
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

// ── Start ───────────────────────────────────────────────
app.listen(config.port, async () => {
  logger.info(`🚀 Server listening on http://localhost:${config.port}`);
  await testDbConnection();
  await seedUsuarios();

  // Iniciar worker SMTP con Cron (Lunes a Viernes de 9 a 17 hs, o cada 1 min en TEST)
  const cronSmtp = MODO_PRUEBA ? '* * * * *' : '0 9-17 * * 1-5';
  logger.info(`🔄 Iniciando Worker SMTP (Cron: ${cronSmtp})...`);
  cron.schedule(cronSmtp, procesarCola, {
    timezone: 'America/Argentina/Buenos_Aires',
  });

  // Iniciar procesador de rebotes IMAP (Lunes a Viernes a las 18:00 hs, o cada 5 min en TEST)
  const cronExpression = MODO_PRUEBA ? '*/5 * * * *' : '0 18 * * 1-5';
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
});
