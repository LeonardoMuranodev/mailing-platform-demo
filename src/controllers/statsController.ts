import { Request, Response, NextFunction } from 'express';
import { obtenerEstadisticasGlobales } from '../services/statsService.js';
import { sendSuccess } from '../utils/responseHandler.js';

export const getGlobalStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await obtenerEstadisticasGlobales();
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};
