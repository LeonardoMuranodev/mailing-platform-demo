import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { buscarEmpresas, actualizarEmpresa } from '../services/empresaService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { registrarAccion } from '../services/historialService.js';

export const empresaRouter = Router();

// GET /api/empresas?q=texto → Autocompletado para el frontend
empresaRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const empresas = await buscarEmpresas(q);
    sendSuccess(res, empresas);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/empresas/:id → Editar nombre/cuit de una empresa
empresaRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, cuit } = req.body as { nombre: string; cuit?: string };
    if (!nombre?.trim()) {
      sendError(res, 'VALIDATION_ERROR', 'El nombre es requerido', 400);
      return;
    }
    const empresa = await actualizarEmpresa(String(req.params.id), nombre.trim(), cuit);
    if (!empresa) {
      sendError(res, 'NOT_FOUND', 'Empresa no encontrada', 404);
      return;
    }
    await registrarAccion((req as any).user?.userId || null, 'ACTUALIZAR', 'EMPRESA', empresa.id, { nombre, cuit });
    sendSuccess(res, empresa);
  } catch (err) {
    next(err);
  }
});
