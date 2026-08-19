import { Router } from 'express';
import { validateSchema } from '../middlewares/validateSchema.js';
import { crearCuentaSmtpSchema, actualizarCuentaSmtpSchema } from '../schemas/smtpSchema.js';
import { smtpController } from '../controllers/smtpController.js';

export const smtpRouter = Router();

// POST /api/smtp — Registrar cuenta SMTP
smtpRouter.post(
  '/',
  validateSchema(crearCuentaSmtpSchema),
  smtpController.crear,
);

// GET /api/smtp — Listar cuentas SMTP
smtpRouter.get('/', smtpController.listar);

// PATCH /api/smtp/:id — Actualizar cuenta SMTP
smtpRouter.patch(
  '/:id',
  validateSchema(actualizarCuentaSmtpSchema),
  smtpController.actualizar,
);

// DELETE /api/smtp/:id — Eliminar cuenta SMTP
smtpRouter.delete('/:id', smtpController.eliminar);

// PATCH /api/smtp/:id/toggle — Activar/desactivar cuenta
smtpRouter.patch('/:id/toggle', smtpController.toggleEstado);
