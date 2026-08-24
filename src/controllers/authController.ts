import type { Request, Response, NextFunction } from 'express';
import { login, obtenerUsuarioPorId } from '../services/authService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

export const authController = {
  login: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const { token, user } = await login(email, password);
      sendSuccess(res, { token, user });
    } catch (error) {
      if (error instanceof Error && error.message === 'Credenciales inválidas') {
        sendError(res, 'UNAUTHORIZED', error.message, 401);
      } else {
        next(error);
      }
    }
  },

  me: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        sendError(res, 'UNAUTHORIZED', 'Usuario no autenticado', 401);
        return;
      }

      const user = await obtenerUsuarioPorId(req.user.userId);
      if (!user) {
        sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);
        return;
      }

      sendSuccess(res, { user });
    } catch (error) {
      next(error);
    }
  }
};
