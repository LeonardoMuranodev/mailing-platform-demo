import { Router } from 'express';
import { soporteController } from '../controllers/soporteController.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validateSchema } from '../middlewares/validateSchema.js';
import { reporteSchema } from '../schemas/soporteSchema.js';
import { upload } from '../config/multerConfig.js';

const router = Router();

// Todas las rutas de soporte requieren autenticación
router.use(requireAuth);

// Crear reporte (cualquier usuario)
router.post('/', upload.single('adjunto'), validateSchema(reporteSchema), soporteController.crearReporte);

// Rutas de administración (sólo desarrollador)
router.get('/', requireRole(['desarrollador']), soporteController.obtenerReportes);
router.patch('/:id/resuelto', requireRole(['desarrollador']), soporteController.marcarResuelto);

export default router;
