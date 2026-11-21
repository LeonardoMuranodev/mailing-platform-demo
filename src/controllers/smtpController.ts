import type { Request, Response, NextFunction } from 'express';
import {
  crearCuentaSmtp,
  listarCuentasSmtp,
  actualizarCuentaSmtp,
  eliminarCuentaSmtp,
  toggleEstadoSmtp,
  resetearContadoresSmtp,
  marcarCuentaComoPrincipal,
} from '../services/smtpAccountService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import type { CrearCuentaSmtpBody, ActualizarCuentaSmtpBody } from '../schemas/smtpSchema.js';
import { clearCacheByPrefix } from '../middlewares/cache.js';
import { registrarAccion } from '../services/historialService.js';

/**
 * POST /api/smtp
 * Body ya validado por Zod middleware (crearCuentaSmtpSchema).
 */
async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CrearCuentaSmtpBody;
    const cuenta = await crearCuentaSmtp(body);
    await clearCacheByPrefix('/api/smtp');
    await registrarAccion(req.user?.userId || null, 'CREAR', 'SMTP', cuenta.id, { email: cuenta.email });
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

    await clearCacheByPrefix('/api/smtp');
    await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'SMTP', cuenta.id, { email: cuenta.email });
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

    await clearCacheByPrefix('/api/smtp');
    await registrarAccion(req.user?.userId || null, 'ELIMINAR', 'SMTP', cuenta.id, { email: cuenta.email });
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

    if (!estado || !['activo', 'inactivo', 'bloqueado'].includes(estado)) {
      sendError(res, 'BAD_REQUEST', 'Estado inválido. Debe ser activo, inactivo o bloqueado', 400);
      return;
    }

    const cuenta = await toggleEstadoSmtp(id, estado);

    if (!cuenta) {
      sendError(res, 'NOT_FOUND', 'Cuenta SMTP no encontrada', 404);
      return;
    }

    await clearCacheByPrefix('/api/smtp');
    await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'SMTP', cuenta.id, { email: cuenta.email, nuevo_estado: estado });
    sendSuccess(res, cuenta);
  } catch (err) {
    next(err);
  }
}


/**
 * PATCH /api/smtp/:id/principal
 */
async function marcarPrincipal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const cuenta = await marcarCuentaComoPrincipal(id);
    await clearCacheByPrefix('/api/smtp');
    await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'SMTP', cuenta.id, { email: cuenta.email, accion: 'marcar_principal' });
    sendSuccess(res, cuenta);
  } catch (err) {
    next(err);
  }
}


/**
 * POST /api/smtp/reset-diario
 * Fuerza el reset de medianoche (00:00 hs): limpia contadores y reactiva cuentas agotadas o bloqueadas.
 */
async function resetDiario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await resetearContadoresSmtp();
    await clearCacheByPrefix('/api/smtp');
    await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'SMTP', undefined, { accion: 'reset_diario_manual' });
    sendSuccess(res, { message: 'Reset diario ejecutado correctamente. Cuentas desbloqueadas y cuotas a cero.' });
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
  resetDiario,
  marcarPrincipal,
};
