import { Router } from 'express';
import multer from 'multer';
import { validateSchema } from '../middlewares/validateSchema.js';
import { crearContactoSchema, actualizarContactoSchema, listarContactosQuerySchema, bulkDeleteSchema } from '../schemas/contactoSchema.js';
import { contactoController } from '../controllers/contactoController.js';

export const contactoRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

contactoRouter.get(
  '/',
  validateSchema(listarContactosQuerySchema, 'query'),
  contactoController.listar
);

contactoRouter.post(
  '/',
  validateSchema(crearContactoSchema),
  contactoController.crear
);

contactoRouter.patch(
  '/:id',
  validateSchema(actualizarContactoSchema),
  contactoController.actualizar
);

contactoRouter.post('/bulk-delete', validateSchema(bulkDeleteSchema), contactoController.bulkDelete);

contactoRouter.delete('/:id', contactoController.eliminar);

contactoRouter.patch('/:id/toggle', contactoController.toggleEstado);

contactoRouter.post('/importar-csv', upload.single('file'), contactoController.importarCsv);
