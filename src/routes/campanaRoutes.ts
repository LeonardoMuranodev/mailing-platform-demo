import { Router, type Request, type Response, type NextFunction } from 'express';
import { upload } from '../config/multerConfig.js';
import { config } from '../config/env.js';
import { validateSchema } from '../middlewares/validateSchema.js';
import { crearCampanaSchema, cambiarEstadoSchema, actualizarCampanaSchema, actualizarProgramacionSchema } from '../schemas/campanaSchema.js';
import { campanaController } from '../controllers/campanaController.js';
import { requireRole } from '../middlewares/requireRole.js';
import { cache } from '../middlewares/cache.js';

export const campanaRouter = Router();

const uploadCampana = (req: Request, res: Response, next: NextFunction) => {
  upload.fields([
    { name: 'flyer', maxCount: 1 },
    { name: 'adjuntos', maxCount: config.maxAdjuntos },
  ])(req, res, next);
};

// GET /api/campanas/config — Configuración de campañas (ej: maxAdjuntos)
campanaRouter.get('/config', campanaController.obtenerConfig);

// POST /api/campanas — Crear campaña (multipart + validación Zod)
campanaRouter.post(
  '/',
  requireRole(['desarrollador', 'encargada']),
  uploadCampana,
  validateSchema(crearCampanaSchema),
  campanaController.crear,
);

// PUT /api/campanas/:id — Actualizar campaña (solo borrador)
campanaRouter.put(
  '/:id',
  requireRole(['desarrollador', 'encargada']),
  uploadCampana,
  validateSchema(actualizarCampanaSchema),
  campanaController.actualizar,
);

// POST /api/campanas/prueba — Enviar email de prueba
campanaRouter.post(
  '/prueba',
  requireRole(['desarrollador', 'encargada']),
  uploadCampana,
  campanaController.enviarPrueba
);

// GET /api/campanas — Listar campañas
campanaRouter.get('/', campanaController.listar);

// GET /api/campanas/:id/detalle — Obtener campaña con estadísticas
campanaRouter.get('/:id/detalle', cache(15), campanaController.detalle);

// GET /api/campanas/:id — Obtener campaña por UUID
campanaRouter.get('/:id', campanaController.obtenerPorId);

// PATCH /api/campanas/:id/estado — Cambiar estado
campanaRouter.patch(
  '/:id/estado',
  requireRole(['desarrollador', 'encargada']),
  validateSchema(cambiarEstadoSchema),
  campanaController.cambiarEstado,
);

// PATCH /api/campanas/:id/programacion — Modificar fecha límite y prioridad
campanaRouter.patch(
  '/:id/programacion',
  requireRole(['desarrollador', 'encargada']),
  validateSchema(actualizarProgramacionSchema),
  campanaController.actualizarProgramacion,
);

// DELETE /api/campanas/masivo — Eliminar campañas masivamente
campanaRouter.delete(
  '/masivo',
  requireRole(['desarrollador', 'encargada']),
  campanaController.eliminarMasivo,
);

// PATCH /api/campanas/:id/archivar — Archivar campaña (soft delete)
campanaRouter.patch(
  '/:id/archivar',
  requireRole(['desarrollador', 'encargada']),
  campanaController.archivar,
);

// PATCH /api/campanas/:id/desarchivar — Restaurar campaña
campanaRouter.patch(
  '/:id/desarchivar',
  requireRole(['desarrollador', 'encargada']),
  campanaController.desarchivar,
);

// DELETE /api/campanas/:id — Eliminar campaña (hard delete)
campanaRouter.delete(
  '/:id',
  requireRole(['desarrollador', 'encargada']),
  campanaController.eliminar,
);

