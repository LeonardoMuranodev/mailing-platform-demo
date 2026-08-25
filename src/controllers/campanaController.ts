import type { Request, Response, NextFunction } from 'express';
import {
  crearCampana,
  cambiarEstadoCampana,
  obtenerCampanaPorId,
  listarCampanas,
  obtenerCampanaConEstadisticas,
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

    const flyer_url = req.file
      ? `/uploads/${req.file.filename}`
      : body.flyer_url;

    if (!flyer_url) {
      sendError(_res, 'VALIDATION_ERROR', 'El flyer es obligatorio', 400, [{ field: 'flyer', message: 'El flyer es obligatorio' }]);
      return;
    }

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

/**
 * GET /api/campanas
 */
async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filtros = {
      asunto: req.query.asunto as string | undefined,
      estado: req.query.estado as any,
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 15,
    };
    
    const campanasResponse = await listarCampanas(filtros);
    sendSuccess(res, campanasResponse);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/campanas/:id/detalle
 */
async function detalle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const campana = await obtenerCampanaConEstadisticas(id);

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
  listar,
  detalle,
};
