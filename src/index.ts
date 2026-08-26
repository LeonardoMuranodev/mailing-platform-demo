import express from 'express';
import path from 'node:path';
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
import cron from 'node-cron';

const app = express();

// ── Security Middlewares ─────────────────────────────────
app.use(securityHeaders);
app.use(corsMiddleware);

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
  console.error('[FATAL] Uncaught Exception:', error);
  await notifyUncaughtException(error);
  // Dar tiempo al mensaje de Telegram antes de cerrar
  setTimeout(() => process.exit(1), 2000);
});

process.on('unhandledRejection', async (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
  await notifyUnhandledRejection(reason);
});

// Notificar errores inesperados del pool de BD
dbPool.on('error', async (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
  await notifyDbError(err);
});

import { seedUsuarios } from './scripts/seedUsuarios.js';

// ── Start ───────────────────────────────────────────────
app.listen(config.port, async () => {
  console.log(`🚀 Server listening on http://localhost:${config.port}`);
  await testDbConnection();
  await seedUsuarios();

  // Iniciar worker SMTP con Cron (Lunes a Viernes de 9 a 17 hs)
  console.log(`🔄 Iniciando Worker SMTP (Cron: 0 9-17 * * 1-5)...`);
  cron.schedule('0 9-17 * * 1-5', procesarCola, {
    timezone: 'America/Argentina/Buenos_Aires',
  });
});

