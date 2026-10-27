import { Router } from 'express';
import { streamNotificaciones } from '../controllers/notificacionController.js';
import { requireRole } from '../middlewares/requireRole.js';

export const notificacionRouter = Router();

// Canal SSE para recibir notificaciones y eventos en tiempo real
notificacionRouter.get('/stream', requireRole(['desarrollador', 'encargada']), streamNotificaciones);
