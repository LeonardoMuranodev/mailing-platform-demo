import { Router } from 'express';
import { getHistorial, getMiHistorial } from '../controllers/historialController.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';

export const historialRouter = Router();

// Ya está protegido por requireAuth a nivel global en index.ts para todo /api/...
// Pero para historial general se necesita rol desarrollador
historialRouter.get('/', requireRole(['desarrollador']), getHistorial);
historialRouter.get('/me', getMiHistorial);
