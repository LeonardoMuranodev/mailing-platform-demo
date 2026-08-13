import type { Request, Response, NextFunction } from 'express';
import { poblarColaEnvios, obtenerColaPorCampana } from '../services/queueService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * POST /api/queue/poblar/:campanaId
 * Params ya validados por Zod middleware (poblarColaParamsSchema).
 * Genera la cola de envíos masivos para la campaña indicada.
 */
async function poblar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campanaId } = req.params as { campanaId: string };
    const result = await poblarColaEnvios(campanaId);

    if (result.total_insertados === 0) {
      sendSuccess(res, result, 200, {
        mensaje: 'No se encontraron contactos para los rubros seleccionados',
      });
      return;
    }

    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/queue/:campanaId
 */
async function listarCola(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const campanaId = req.params.campanaId as string;
    const filtros = {
      estado: req.query.estado as string | undefined,
      email: req.query.email as string | undefined,
      cuenta_smtp_id: req.query.cuenta_smtp_id as string | undefined,
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
    };

    const cola = await obtenerColaPorCampana(campanaId, filtros);
    sendSuccess(res, cola);
  } catch (err) {
    next(err);
  }
}

export const queueController = {
  poblar,
  listarCola,
};
