import type { Request, Response, NextFunction } from 'express';
import { soporteService } from '../services/soporteService.js';
import { notificarSoporte } from '../services/notificationService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

export const soporteController = {
  crearReporte: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tipo, descripcion } = req.body;
      const usuario_id = req.user!.userId;
      
      let adjunto_url = undefined;
      if (req.file) {
        adjunto_url = `/uploads/${req.file.filename}`;
      }

      const nuevoReporte = await soporteService.crearReporte({
        tipo,
        descripcion,
        adjunto_url,
        usuario_id
      });

      // Intentar notificar en background
      notificarSoporte(tipo, descripcion, { nombre: req.user!.email, email: req.user!.email }, adjunto_url)
        .catch(err => console.error('Error en notificacion en background', err));

      sendSuccess(res, nuevoReporte, 201);
    } catch (error) {
      next(error);
    }
  },

  obtenerReportes: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reportes = await soporteService.obtenerReportes();
      sendSuccess(res, reportes);
    } catch (error) {
      next(error);
    }
  },

  marcarResuelto: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const reporte = await soporteService.marcarResuelto(id);
      sendSuccess(res, reporte);
    } catch (error) {
      if (error instanceof Error && error.message === 'Reporte no encontrado') {
        sendError(res, 'NOT_FOUND', error.message, 404);
      } else {
        next(error);
      }
    }
  }
};
