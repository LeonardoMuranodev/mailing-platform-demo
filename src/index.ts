import express from 'express';
import path from 'node:path';
import { config } from './config/env.js';
import { testDbConnection } from './config/db.js';
import { SmtpService, ImapService } from './services/index.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// ── Middlewares ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos subidos de forma estática
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// ── Routes ──────────────────────────────────────────────
registerRoutes(app);

// ── Global Error Handler (DEBE ir después de las rutas) ─
app.use(errorHandler);

// ── Services ────────────────────────────────────────────
const smtp = new SmtpService();
const imap = new ImapService();

smtp.sendMail('test@example.com', 'Welcome', 'Initialization test email');
imap.fetchMails();

import { seedUsuarios } from './scripts/seedUsuarios.js';

// ── Start ───────────────────────────────────────────────
app.listen(config.port, async () => {
  console.log(`🚀 Server listening on http://localhost:${config.port}`);
  await testDbConnection();
  await seedUsuarios();
});

