import type { Application } from 'express';
import { authRouter } from './authRoutes.js';
import { campanaRouter } from './campanaRoutes.js';
import { queueRouter } from './queueRoutes.js';
import { smtpRouter } from './smtpRoutes.js';
import { statsRouter } from './statsRoutes.js';
import { contactoRouter } from './contactoRoutes.js';
import { usuariosRouter } from './usuariosRoutes.js';
import soporteRouter from './soporteRoutes.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { healthRouter } from './healthRoutes.js';
import { apiLimiter, authLimiter, queueLimiter } from '../middlewares/rateLimiter.js';

export function registerRoutes(app: Application): void {
  // Rate limiter general para toda la API
  app.use('/api', apiLimiter);

  // Health check — sin auth (para Docker healthchecks y monitoreo)
  app.use('/api/health', healthRouter);

  // Auth — con limiter estricto adicional
  app.use('/api/auth', authLimiter, authRouter);

  // Todas las rutas a partir de aquí requieren autenticación
  app.use('/api', requireAuth);

  app.use('/api/campanas', campanaRouter);
  app.use('/api/queue', queueLimiter, queueRouter);
  app.use('/api/smtp', smtpRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/contactos', contactoRouter);
  app.use('/api/usuarios', usuariosRouter);
  app.use('/api/soporte', soporteRouter);
  
  console.log('[Routes] ✅ REST endpoints registered: /api/auth, /api/campanas, /api/queue, /api/smtp, /api/stats, /api/contactos, /api/usuarios, /api/soporte');
  console.log('[Routes] 🛡️  Rate limiters active: auth (10/15min), api (200/15min), queue (5/1min)');
}

