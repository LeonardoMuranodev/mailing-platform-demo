import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/responseHandler.js';
import type { Rol } from '../types/usuario.js';

/**
 * Middleware para proteger rutas basado en roles.
 * Debe ser usado DESPUÉS de `requireAuth`.
 */
export function requireRole(allowedRoles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      sendError(res, 'UNAUTHORIZED', 'Usuario no autenticado', 401);
      return;
    }

    if (!allowedRoles.includes(user.rol)) {
      sendError(res, 'FORBIDDEN', 'No tienes permisos para realizar esta acción', 403);
      return;
    }

    next();
  };
}
