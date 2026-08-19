import type { Application } from 'express';
import { campanaRouter } from './campanaRoutes.js';
import { queueRouter } from './queueRoutes.js';
import { smtpRouter } from './smtpRoutes.js';
import { statsRouter } from './statsRoutes.js';
import { contactoRouter } from './contactoRoutes.js';

export function registerRoutes(app: Application): void {
  app.use('/api/campanas', campanaRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/smtp', smtpRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/contactos', contactoRouter);
  console.log('[Routes] ✅ REST endpoints registered: /api/campanas, /api/queue, /api/smtp, /api/stats, /api/contactos');
}

