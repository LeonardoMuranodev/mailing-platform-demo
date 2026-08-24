import { Router } from 'express';
import { UsuarioController } from '../controllers/usuarioController.js';
import { validateSchema } from '../middlewares/validateSchema.js';
import { crearUsuarioSchema, actualizarUsuarioSchema } from '../schemas/usuarioSchema.js';
import { requireRole } from '../middlewares/requireRole.js';

const router = Router();
const controller = new UsuarioController();

// Todo este router está protegido para 'desarrollador'
router.use(requireRole(['desarrollador']));

router.get('/', controller.obtenerUsuarios);

router.post('/', validateSchema(crearUsuarioSchema), controller.crearUsuario);

router.patch('/:id', validateSchema(actualizarUsuarioSchema), controller.actualizarUsuario);

router.delete('/:id', controller.eliminarUsuario);

export { router as usuariosRouter };
