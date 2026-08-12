import type { Request, Response, NextFunction } from 'express';
import {
  crearCampana,
  cambiarEstadoCampana,
  obtenerCampanaPorId,
} from '../services/campanaService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import type { CrearCampanaBody, CambiarEstadoBody } from '../schemas/campanaSchema.js';

/**
 * POST /api/campanas
 * Body ya validado por Zod middleware (crearCampanaSchema).
 */
async function crear(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CrearCampanaBody;

    // Si multer subió un archivo, sobreescribir flyer_url
    const flyer_url = req.file
      ? `/uploads/${req.file.filename}`
      : body.flyer_url;

    const campana = await crearCampana({ ...body, flyer_url });
    sendSuccess(_res, campana, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/campanas/:id
 */
async function obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const campana = await obtenerCampanaPorId(id);

    if (!campana) {
      sendError(res, 'NOT_FOUND', 'Campaña no encontrada', 404);
      return;
    }

    sendSuccess(res, campana);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/campanas/:id/estado
 * Body ya validado por Zod middleware (cambiarEstadoSchema).
 */
async function cambiarEstado(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const { estado } = req.body as CambiarEstadoBody;

    const campana = await cambiarEstadoCampana(id, estado);

    if (!campana) {
      sendError(res, 'NOT_FOUND', 'Campaña no encontrada', 404);
      return;
    }

    sendSuccess(res, campana);
  } catch (err) {
    next(err);
  }
}

export const campanaController = {
  crear,
  obtenerPorId,
  cambiarEstado,
};
