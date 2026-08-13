import type { Application } from 'express';
import { campanaRouter } from './campanaRoutes.js';
import { queueRouter } from './queueRoutes.js';
import { smtpRouter } from './smtpRoutes.js';

export function registerRoutes(app: Application): void {
  app.use('/api/campanas', campanaRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/smtp', smtpRouter);
  console.log('[Routes] ✅ REST endpoints registered: /api/campanas, /api/queue, /api/smtp');
}

