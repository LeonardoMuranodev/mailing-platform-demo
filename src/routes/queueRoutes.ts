import { Router } from 'express';
import { validateSchema } from '../middlewares/validateSchema.js';
import { poblarColaParamsSchema } from '../schemas/colaEnviosSchema.js';
import { queueController } from '../controllers/queueController.js';

export const queueRouter = Router();

// POST /api/queue/poblar/:campanaId — Poblar cola de envíos masivos
queueRouter.post(
  '/poblar/:campanaId',
  validateSchema(poblarColaParamsSchema, 'params'),
  queueController.poblar,
);

// GET /api/queue/:campanaId — Listar cola de envíos con filtros
queueRouter.get('/:campanaId', queueController.listarCola);

// POST /api/queue/procesar-ahora — Forzar envío manual
queueRouter.post('/procesar-ahora', queueController.forzarEnvio);
