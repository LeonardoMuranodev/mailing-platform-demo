import type { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import {
  crearCampana,
  cambiarEstadoCampana,
  obtenerCampanaPorId,
  listarCampanas,
  obtenerCampanaConEstadisticas,
  eliminarCampana,
  eliminarCampanasMasivo,
  archivarCampana,
} from '../services/campanaService.js';
import { enviarMailPrueba } from '../services/notificationService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import type { CrearCampanaBody, CambiarEstadoBody } from '../schemas/campanaSchema.js';
import { clearCacheByPrefix } from '../middlewares/cache.js';

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

    const cuerpo_html = body.cuerpo_html ? DOMPurify.sanitize(body.cuerpo_html) : undefined;
    
    const campanaData = { ...body, flyer_url };
    if (cuerpo_html) campanaData.cuerpo_html = cuerpo_html;

    const campana = await crearCampana(campanaData);
    
    // Invalidamos el caché de campañas y estadísticas
    await clearCacheByPrefix('/api/campanas');
    await clearCacheByPrefix('/api/stats');
    
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

    // Invalidamos el caché de campañas y estadísticas
    await clearCacheByPrefix('/api/campanas');
    await clearCacheByPrefix('/api/stats');

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

/**
 * DELETE /api/campanas/:id
 */
async function eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const deleted = await eliminarCampana(id);

    if (!deleted) {
      sendError(res, 'NOT_FOUND', 'Campaña no encontrada', 404);
      return;
    }

    // Invalidamos el caché
    await clearCacheByPrefix('/api/campanas');
    await clearCacheByPrefix('/api/stats');

    sendSuccess(res, { message: 'Campaña eliminada correctamente' });
  } catch (err) {
    next(err);
  }
}

async function archivar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const eliminado = await archivarCampana(String(id));
    if (!eliminado) {
      sendError(res, 'NOT_FOUND', 'Campaña no encontrada o ya archivada', 404);
      return;
    }
    sendSuccess(res, { message: 'Campaña archivada correctamente' });
  } catch (err) {
    next(err);
  }
}

async function eliminarMasivo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      sendError(res, 'BAD_REQUEST', 'Debe proporcionar un array de IDs', 400);
      return;
    }

    await eliminarCampanasMasivo(ids);
    
    sendSuccess(res, { message: 'Campañas eliminadas correctamente' });
  } catch (err) {
    next(err);
  }
}

import { generarHtmlDesdeCampana } from '../services/emailTemplate.js';
import type { Campana } from '../types/campana.js';

async function enviarPrueba(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { asunto, cuerpo_html, link_inscripcion, flyer_url } = req.body;
    if (!asunto || !cuerpo_html) {
      sendError(res, 'BAD_REQUEST', 'Faltan campos obligatorios para la prueba (asunto, cuerpo_html)', 400);
      return;
    }

    const campanaMock: Campana = {
      id: 'mock-id',
      asunto,
      cuerpo_html,
      link_inscripcion: link_inscripcion || null,
      flyer_url: flyer_url || null,
      estado: 'borrador',
      fecha_limite_envio: '',
      prioridad: 'media',
      para_todos_rubros: true,
      rubros_seleccionados: [],
      creado_en: '',
      actualizado_en: ''
    };

    const htmlRenderizado = generarHtmlDesdeCampana(campanaMock);

    const { destinatario } = await enviarMailPrueba(asunto, htmlRenderizado);
    sendSuccess(res, { message: `Email de prueba enviado exitosamente a ${destinatario}`, destinatario });
  } catch (err: any) {
    console.error('Error en enviarPrueba:', err);
    sendError(res, 'INTERNAL_SERVER_ERROR', err.message || 'Error al enviar el mail de prueba', 500);
  }
}

export const campanaController = {
  crear,
  obtenerPorId,
  cambiarEstado,
  listar,
  detalle,
  eliminar,
  archivar,
  eliminarMasivo,
  enviarPrueba,
};
