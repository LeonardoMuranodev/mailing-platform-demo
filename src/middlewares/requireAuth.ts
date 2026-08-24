import type { Request, Response, NextFunction } from 'express';
import { verificarToken } from '../services/authService.js';
import { sendError } from '../utils/responseHandler.js';
import type { JwtPayload } from '../types/usuario.js';

// Extender el Request de Express para incluir el usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'UNAUTHORIZED', 'No se proporcionó un token de autenticación', 401);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verificarToken(token);
    req.user = payload;
    next();
  } catch (error) {
    sendError(res, 'UNAUTHORIZED', 'Token inválido o expirado', 401);
  }
}
