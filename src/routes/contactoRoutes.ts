import { Router } from 'express';
import multer from 'multer';
import { validateSchema } from '../middlewares/validateSchema.js';
import { crearContactoSchema, actualizarContactoSchema, listarContactosQuerySchema, bulkDeleteSchema } from '../schemas/contactoSchema.js';
import { contactoController } from '../controllers/contactoController.js';
import { requireRole } from '../middlewares/requireRole.js';

export const contactoRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

contactoRouter.get(
  '/',
  validateSchema(listarContactosQuerySchema, 'query'),
  contactoController.listar
);

contactoRouter.post(
  '/',
  requireRole(['desarrollador', 'encargada']),
  validateSchema(crearContactoSchema),
  contactoController.crear
);

contactoRouter.patch(
  '/:id',
  requireRole(['desarrollador', 'encargada']),
  validateSchema(actualizarContactoSchema),
  contactoController.actualizar
);

contactoRouter.post('/bulk-delete', requireRole(['desarrollador', 'encargada']), validateSchema(bulkDeleteSchema), contactoController.bulkDelete);

contactoRouter.delete('/:id', requireRole(['desarrollador', 'encargada']), contactoController.eliminar);

contactoRouter.patch('/:id/toggle', requireRole(['desarrollador', 'encargada']), contactoController.toggleEstado);

contactoRouter.post('/importar-csv', requireRole(['desarrollador', 'encargada']), upload.single('file'), contactoController.importarCsv);

contactoRouter.post('/import-json', requireRole(['desarrollador', 'encargada']), contactoController.importarJson);
