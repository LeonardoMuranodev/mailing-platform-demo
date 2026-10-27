import { Router } from 'express';
import { horariosController } from '../controllers/horariosController.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validateSchema } from '../middlewares/validateSchema.js';
import { actualizarHorariosSchema, agregarFechaExcluidaSchema } from '../schemas/horariosSchema.js';

export const horariosRouter = Router();

horariosRouter.use(requireRole(['desarrollador', 'encargada']));

horariosRouter.get('/', horariosController.obtenerConfiguracion);
horariosRouter.put('/', validateSchema(actualizarHorariosSchema), horariosController.actualizarConfiguracion);
horariosRouter.post('/fechas', validateSchema(agregarFechaExcluidaSchema), horariosController.agregarFechaExcluida);
horariosRouter.delete('/fechas/:id', horariosController.eliminarFechaExcluida);
