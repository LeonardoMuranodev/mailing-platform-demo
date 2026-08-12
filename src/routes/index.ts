import type { Application } from 'express';
import { campanaRouter } from './campanaRoutes.js';

export function registerRoutes(app: Application): void {
  app.use('/api/campanas', campanaRouter);
  console.log('[Routes] ✅ REST endpoints registered: /api/campanas');
}
