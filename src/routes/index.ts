import type { Application } from 'express';
import { authRouter } from './authRoutes.js';
import { campanaRouter } from './campanaRoutes.js';
import { queueRouter } from './queueRoutes.js';
import { smtpRouter } from './smtpRoutes.js';
import { statsRouter } from './statsRoutes.js';
import { contactoRouter } from './contactoRoutes.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';

export function registerRoutes(app: Application): void {
  app.use('/api/auth', authRouter);

  // Todas las rutas a partir de aquí requieren autenticación
  app.use('/api', requireAuth);

  app.use('/api/campanas', campanaRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/smtp', smtpRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/contactos', contactoRouter);
  
  console.log('[Routes] ✅ REST endpoints registered: /api/auth, /api/campanas, /api/queue, /api/smtp, /api/stats, /api/contactos');
}

