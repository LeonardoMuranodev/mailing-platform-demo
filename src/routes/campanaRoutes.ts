import { Router } from 'express';
import { upload } from '../config/multerConfig.js';
import { validateSchema } from '../middlewares/validateSchema.js';
import { crearCampanaSchema, cambiarEstadoSchema } from '../schemas/campanaSchema.js';
import { campanaController } from '../controllers/campanaController.js';
import { requireRole } from '../middlewares/requireRole.js';

export const campanaRouter = Router();

// POST /api/campanas — Crear campaña (multipart + validación Zod)
campanaRouter.post(
  '/',
  requireRole(['desarrollador', 'encargada']),
  upload.single('flyer'),
  validateSchema(crearCampanaSchema),
  campanaController.crear,
);

// GET /api/campanas — Listar campañas
campanaRouter.get('/', campanaController.listar);

// GET /api/campanas/:id/detalle — Obtener campaña con estadísticas
campanaRouter.get('/:id/detalle', campanaController.detalle);

// GET /api/campanas/:id — Obtener campaña por UUID
campanaRouter.get('/:id', campanaController.obtenerPorId);

// PATCH /api/campanas/:id/estado — Cambiar estado
campanaRouter.patch(
  '/:id/estado',
  requireRole(['desarrollador', 'encargada']),
  validateSchema(cambiarEstadoSchema),
  campanaController.cambiarEstado,
);

