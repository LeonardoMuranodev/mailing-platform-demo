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
  let token: string | undefined;

  // 1. Priorizar Cookie HttpOnly segura anti-XSS
  if (req.cookies && typeof req.cookies.auth_token === 'string' && req.cookies.auth_token.trim()) {
    token = req.cookies.auth_token.trim();
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    // 2. Fallback a header Authorization para APIs, scripts y tests
    token = authHeader.split(' ')[1];
  } else if (typeof req.query.token === 'string' && req.query.token.trim()) {
    // 3. Fallback a query parameter para descargas o SSE si aplica
    token = req.query.token.trim();
  }

  if (!token) {
    sendError(res, 'UNAUTHORIZED', 'No se proporcionó un token de autenticación', 401);
    return;
  }

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
