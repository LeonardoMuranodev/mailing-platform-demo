import type { Request, Response, NextFunction } from 'express';
import { verificarToken } from '../services/authService.js';
import { dbPool } from '../config/db.js';
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

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'UNAUTHORIZED', 'No se proporcionó un token de autenticación', 401);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verificarToken(token);
    
    // Verificar que el usuario siga existiendo y actualizar su rol
    const { rows } = await dbPool.query('SELECT id, rol FROM usuarios WHERE id = $1', [payload.userId]);
    
    if (rows.length === 0) {
      sendError(res, 'UNAUTHORIZED', 'Usuario ya no existe en el sistema', 401);
      return;
    }

    req.user = {
      ...payload,
      rol: rows[0].rol
    };
    next();
  } catch (error) {
    sendError(res, 'UNAUTHORIZED', 'Token inválido o expirado', 401);
  }
}
