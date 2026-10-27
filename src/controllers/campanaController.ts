import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import DOMPurify from 'isomorphic-dompurify';
import { config } from '../config/env.js';
import { dbPool } from '../config/db.js';
import {
  crearCampana,
  actualizarCampana,
  cambiarEstadoCampana,
  obtenerCampanaPorId,
  listarCampanas,
  obtenerCampanaConEstadisticas,
  eliminarCampana,
  eliminarCampanasMasivo,
  archivarCampana,
  desarchivarCampana,
  actualizarProgramacionCampana,
} from '../services/campanaService.js';
import { enviarMailPrueba } from '../services/notificationService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import type { CrearCampanaBody, CambiarEstadoBody, ActualizarCampanaBody, ActualizarProgramacionBody } from '../schemas/campanaSchema.js';
import { clearCacheByPrefix } from '../middlewares/cache.js';
import { registrarAccion } from '../services/historialService.js';
import { emitirAlertaRealtime } from '../services/realtimeService.js';

/**
 * POST /api/campanas
 * Body ya validado por Zod middleware (crearCampanaSchema).
 */
async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CrearCampanaBody;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const flyerFile = files?.['flyer']?.[0];
    const adjuntoFiles = files?.['adjuntos'] || [];

    if (adjuntoFiles.length > config.maxAdjuntos) {
      sendError(res, 'BAD_REQUEST', `No se pueden subir más de ${config.maxAdjuntos} archivos adjuntos`, 400);
      return;
    }

    const flyer_url = flyerFile
      ? `/uploads/${flyerFile.filename}`
      : (body.flyer_url || null);

    // Construir adjuntos_extras desde los archivos subidos
    const adjuntos_extras_nuevos = adjuntoFiles.map((f) => ({
      url: `/uploads/${f.filename}`,
      nombre_original: f.originalname,
    }));

    // Retrocompatibilidad: el primer adjunto también va en adjunto_url
    const adjunto_url = adjuntos_extras_nuevos[0]?.url || (body.adjunto_url || null);
    const adjunto_nombre_original = adjuntos_extras_nuevos[0]?.nombre_original || null;

    // Combinar: archivos nuevos subidos + extras existentes del body (al editar)
    const adjuntos_extras_body = (body as any).adjuntos_extras || [];
    const adjuntos_extras = adjuntos_extras_nuevos.length > 0
      ? adjuntos_extras_nuevos
      : adjuntos_extras_body;

    const cuerpo_html = body.cuerpo_html ? DOMPurify.sanitize(body.cuerpo_html) : undefined;
    
    const campanaData: any = { ...body, flyer_url, adjunto_url, adjunto_nombre_original, adjuntos_extras };
    if (cuerpo_html) campanaData.cuerpo_html = cuerpo_html;

    const campana = await crearCampana(campanaData);
    
    // Invalidamos el caché de campañas y estadísticas
    await clearCacheByPrefix('/api/campanas');
    await clearCacheByPrefix('/api/stats');
    
    await registrarAccion(req.user?.userId || null, 'CREAR', 'CAMPANA', campana.id, { asunto: campana.asunto });

    sendSuccess(res, campana, 201);
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

    await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'CAMPANA', campana.id, { asunto: campana.asunto, estado_nuevo: estado });

    if (estado === 'aprobada') {
      emitirAlertaRealtime({
        tipo: 'campaign_approved',
        titulo: 'Campaña Aprobada',
        mensaje: `La campaña "${campana.asunto}" fue aprobada y quedó lista para su envío.`,
        urlDestino: `/campanas/${campana.id}`,
        timestamp: new Date().toISOString(),
      });
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
      rubro: req.query.rubro as string | undefined,
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

    await registrarAccion(req.user?.userId || null, 'ELIMINAR', 'CAMPANA', id);

    sendSuccess(res, { message: 'Campaña eliminada correctamente' });
  } catch (err) {
    next(err);
  }
}

async function archivar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const eliminado = await archivarCampana(id);
    if (!eliminado) {
      sendError(res, 'NOT_FOUND', 'Campaña no encontrada o ya archivada', 404);
      return;
    }
    
    // Fetch campana para obtener el asunto
    const campanaResult = await dbPool.query('SELECT asunto FROM campanas WHERE id = $1', [id]);
    const asunto = campanaResult.rows[0]?.asunto || 'Desconocida';
    await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'CAMPANA', id, { asunto, estado_nuevo: 'archivada' });
    
    sendSuccess(res, { message: 'Campaña archivada correctamente' });
  } catch (err) {
    next(err);
  }
}

async function desarchivar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const restaurado = await desarchivarCampana(id);
    if (!restaurado) {
      sendError(res, 'NOT_FOUND', 'Campaña no encontrada o no estaba archivada', 404);
      return;
    }
    
    // Fetch campana para obtener el asunto
    const campanaResult = await dbPool.query('SELECT asunto FROM campanas WHERE id = $1', [id]);
    const asunto = campanaResult.rows[0]?.asunto || 'Desconocida';
    await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'CAMPANA', id, { asunto, estado_nuevo: 'restaurada' });
    
    sendSuccess(res, { message: 'Campaña restaurada correctamente' });
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
    
    await registrarAccion(req.user?.userId || null, 'ELIMINAR', 'CAMPANA', null, { ids_eliminados: ids });

    sendSuccess(res, { message: 'Campañas eliminadas correctamente' });
  } catch (err) {
    next(err);
  }
}

import { generarHtmlDesdeCampana } from '../services/emailTemplate.js';
import type { Campana } from '../types/campana.js';

async function enviarPrueba(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { asunto, cuerpo_html, link_inscripcion, link_nacion, link_provincia, flyer_url, adjunto_url } = req.body;
    if (!asunto || !cuerpo_html) {
      sendError(res, 'BAD_REQUEST', 'Faltan campos obligatorios para la prueba (asunto, cuerpo_html)', 400);
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    
    // Obtener los URLs (ya sean nuevos subidos o existentes en body)
    let flyerUrlFinal = flyer_url || null;

    if (files?.flyer?.[0]) {
      flyerUrlFinal = `/uploads/${files.flyer[0].filename}`;
    }

    const adjuntoFiles = files?.['adjuntos'] || (files?.['adjunto'] ? [files['adjunto'][0]] : []);

    if (adjuntoFiles.length > config.maxAdjuntos) {
      sendError(res, 'BAD_REQUEST', `No se pueden subir más de ${config.maxAdjuntos} archivos adjuntos`, 400);
      return;
    }
    const adjuntos_extras_nuevos = adjuntoFiles.map(f => ({
      url: `/uploads/${f.filename}`,
      nombre_original: f.originalname
    }));

    let adjuntos_extras_body: Array<{ url: string; nombre_original: string }> = [];
    if (req.body.adjuntos_extras) {
      if (typeof req.body.adjuntos_extras === 'string') {
        try { adjuntos_extras_body = JSON.parse(req.body.adjuntos_extras); } catch {}
      } else if (Array.isArray(req.body.adjuntos_extras)) {
        adjuntos_extras_body = req.body.adjuntos_extras;
      }
    }

    const adjuntosExtrasFinal = adjuntos_extras_nuevos.length > 0 ? adjuntos_extras_nuevos : adjuntos_extras_body;
    const adjuntoUrlFinal = adjuntosExtrasFinal[0]?.url || adjunto_url || null;
    const adjuntoNombreOriginalFinal = adjuntosExtrasFinal[0]?.nombre_original || null;

    let flyerParaTemplate = flyerUrlFinal;
    if (flyerUrlFinal) {
      const cleanFlyerPath = flyerUrlFinal.startsWith('/') ? flyerUrlFinal.slice(1) : flyerUrlFinal;
      const localFlyerPath = path.resolve(process.cwd(), cleanFlyerPath);
      if (fs.existsSync(localFlyerPath)) {
        flyerParaTemplate = 'cid:flyer_campana';
      }
    }

    const campanaMock: Campana = {
      id: 'mock-id',
      asunto,
      cuerpo_html,
      link_inscripcion: link_inscripcion || null,
      link_nacion: link_nacion || null,
      link_provincia: link_provincia || null,
      flyer_url: flyerParaTemplate,
      adjunto_url: adjuntoUrlFinal,
      adjunto_nombre_original: adjuntoNombreOriginalFinal,
      adjuntos_extras: adjuntosExtrasFinal,
      estado: 'borrador',
      fecha_limite_envio: '',
      prioridad: 'media',
      para_todos_rubros: true,
      rubros_seleccionados: [],
      creado_en: '',
      actualizado_en: ''
    };

    const htmlRenderizado = generarHtmlDesdeCampana(campanaMock);

    const { destinatario } = await enviarMailPrueba(asunto, htmlRenderizado, adjuntoUrlFinal, flyerUrlFinal, adjuntosExtrasFinal);
    sendSuccess(res, { message: `Email de prueba enviado exitosamente a ${destinatario}`, destinatario });
  } catch (err: any) {
    console.error('Error en enviarPrueba:', err);
    sendError(res, 'INTERNAL_SERVER_ERROR', err.message || 'Error al enviar el mail de prueba', 500);
  }
}

/**
 * PUT /api/campanas/:id
 * Body ya validado por Zod middleware (actualizarCampanaSchema).
 */
async function actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const body = req.body as ActualizarCampanaBody;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const flyerFile = files?.['flyer']?.[0];
    const adjuntoFiles = files?.['adjuntos'] || [];

    if (adjuntoFiles.length > config.maxAdjuntos) {
      sendError(res, 'BAD_REQUEST', `No se pueden subir más de ${config.maxAdjuntos} archivos adjuntos`, 400);
      return;
    }

    const flyer_url = flyerFile
      ? `/uploads/${flyerFile.filename}`
      : body.flyer_url;

    // Construir adjuntos_extras desde los archivos subidos
    const adjuntos_extras_nuevos = adjuntoFiles.map((f) => ({
      url: `/uploads/${f.filename}`,
      nombre_original: f.originalname,
    }));

    // Retrocompatibilidad: el primer adjunto también va en adjunto_url
    const adjunto_url = adjuntos_extras_nuevos[0]?.url !== undefined
      ? adjuntos_extras_nuevos[0].url
      : body.adjunto_url;
    const adjunto_nombre_original = adjuntos_extras_nuevos[0]?.nombre_original || undefined;

    // Combinar: archivos nuevos + extras existentes del body (al editar sin subir nuevos)
    const adjuntos_extras_body = (body as any).adjuntos_extras || [];
    const adjuntos_extras = adjuntos_extras_nuevos.length > 0
      ? adjuntos_extras_nuevos
      : adjuntos_extras_body;

    const cuerpo_html = body.cuerpo_html ? DOMPurify.sanitize(body.cuerpo_html) : undefined;

    const campanaData: any = { ...body };
    if (flyer_url !== undefined) campanaData.flyer_url = flyer_url || null;
    if (adjunto_url !== undefined) campanaData.adjunto_url = adjunto_url || null;
    if (adjunto_nombre_original) campanaData.adjunto_nombre_original = adjunto_nombre_original;
    campanaData.adjuntos_extras = adjuntos_extras;
    if (cuerpo_html) campanaData.cuerpo_html = cuerpo_html;

    const campana = await actualizarCampana(id, campanaData);
    
    if (!campana) {
      sendError(res, 'BAD_REQUEST', 'Campaña no encontrada o no está en estado borrador', 400);
      return;
    }
    
    // Invalidamos el caché de campañas
    await clearCacheByPrefix('/api/campanas');
    
    await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'CAMPANA', campana.id, { asunto: campana.asunto });

    sendSuccess(res, campana, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/campanas/:id/programacion
 * Body validado por Zod middleware (actualizarProgramacionSchema).
 * Permite cambiar la fecha límite o prioridad de campañas activas (aprobada, en_proceso, pausada)
 * o borradores para acelerar/regular el ritmo de envíos en el worker.
 */
async function actualizarProgramacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const body = req.body as ActualizarProgramacionBody;

    const campana = await actualizarProgramacionCampana(id, body);
    if (!campana) {
      sendError(res, 'NOT_FOUND', 'Campaña no encontrada', 404);
      return;
    }

    // Invalidar caché
    await clearCacheByPrefix('/api/campanas');
    await clearCacheByPrefix('/api/stats');

    await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'CAMPANA', campana.id, {
      motivo: 'Modificación de fecha límite / prioridad',
      fecha_limite_envio: body.fecha_limite_envio,
      prioridad: body.prioridad || campana.prioridad,
    });

    sendSuccess(res, campana, 200);
  } catch (err) {
    next(err);
  }
}

async function obtenerConfig(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, {
    maxAdjuntos: config.maxAdjuntos,
  });
}

export const campanaController = {
  crear,
  actualizar,
  actualizarProgramacion,
  obtenerConfig,
  obtenerPorId,
  cambiarEstado,
  listar,
  detalle,
  eliminar,
  archivar,
  desarchivar,
  eliminarMasivo,
  enviarPrueba,
};
