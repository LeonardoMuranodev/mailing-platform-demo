import type { Request, Response, NextFunction } from 'express';
import {
  crearCuentaSmtp,
  listarCuentasSmtp,
  actualizarCuentaSmtp,
  eliminarCuentaSmtp,
  toggleEstadoSmtp,
} from '../services/smtpAccountService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import type { CrearCuentaSmtpBody, ActualizarCuentaSmtpBody } from '../schemas/smtpSchema.js';

/**
 * POST /api/smtp
 * Body ya validado por Zod middleware (crearCuentaSmtpSchema).
 */
async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CrearCuentaSmtpBody;
    const cuenta = await crearCuentaSmtp(body);
    sendSuccess(res, cuenta, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/smtp
 * Lista todas las cuentas SMTP del pool.
 */
async function listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cuentas = await listarCuentasSmtp();
    sendSuccess(res, cuentas);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/smtp/:id
 * Body ya validado por Zod middleware (actualizarCuentaSmtpSchema).
 */
async function actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const body = req.body as ActualizarCuentaSmtpBody;

    const cuenta = await actualizarCuentaSmtp(id, body);

    if (!cuenta) {
      sendError(res, 'NOT_FOUND', 'Cuenta SMTP no encontrada', 404);
      return;
    }

    sendSuccess(res, cuenta);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/smtp/:id
 */
async function eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const cuenta = await eliminarCuentaSmtp(id);

    if (!cuenta) {
      sendError(res, 'NOT_FOUND', 'Cuenta SMTP no encontrada', 404);
      return;
    }

    sendSuccess(res, cuenta);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/smtp/:id/toggle
 */
async function toggleEstado(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const { estado } = req.body as { estado: string };

    if (!estado || !['activo', 'inactivo'].includes(estado)) {
      sendError(res, 'BAD_REQUEST', 'Estado inválido. Debe ser activo o inactivo', 400);
      return;
    }

    const cuenta = await toggleEstadoSmtp(id, estado);

    if (!cuenta) {
      sendError(res, 'NOT_FOUND', 'Cuenta SMTP no encontrada', 404);
      return;
    }

    sendSuccess(res, cuenta);
  } catch (err) {
    next(err);
  }
}

export const smtpController = {
  crear,
  listar,
  actualizar,
  eliminar,
  toggleEstado,
};
