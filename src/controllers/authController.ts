import type { Request, Response, NextFunction } from 'express';
import { login, obtenerUsuarioPorId, forgotPassword, resetPassword, changePassword } from '../services/authService.js';
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
  },

  forgotPassword: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;
      if (!email) {
        sendError(res, 'BAD_REQUEST', 'El email es requerido', 400);
        return;
      }
      await forgotPassword(email);
      sendSuccess(res, { message: 'Si el correo existe en nuestro sistema, hemos enviado las instrucciones para recuperar tu contraseña.' });
    } catch (error) {
      next(error);
    }
  },

  resetPassword: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        sendError(res, 'BAD_REQUEST', 'El token y la nueva contraseña son requeridos', 400);
        return;
      }
      await resetPassword(token, newPassword);
      sendSuccess(res, { message: 'Tu contraseña ha sido restablecida exitosamente. Ahora puedes iniciar sesión.' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('inválido o ha expirado')) {
        sendError(res, 'BAD_REQUEST', error.message, 400);
      } else {
        next(error);
      }
    }
  },

  changePassword: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        sendError(res, 'BAD_REQUEST', 'La contraseña actual y la nueva son requeridas', 400);
        return;
      }
      if (!req.user?.userId) {
        sendError(res, 'UNAUTHORIZED', 'Usuario no autenticado', 401);
        return;
      }
      await changePassword(req.user.userId, currentPassword, newPassword);
      sendSuccess(res, { message: 'Tu contraseña ha sido actualizada exitosamente.' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('incorrecta')) {
        sendError(res, 'BAD_REQUEST', error.message, 400);
      } else {
        next(error);
      }
    }
  }
};
