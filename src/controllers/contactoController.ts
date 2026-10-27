import type { Request, Response, NextFunction } from 'express';
import {
  crearContacto,
  listarContactos,
  actualizarContacto,
  eliminarContacto,
  eliminarContactosBulk,
  toggleEstadoContacto,
  importarContactosCsv,
  importarContactosJson,
} from '../services/contactoService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { registrarAccion } from '../services/historialService.js';
import type {
  CrearContactoBody,
  ActualizarContactoBody,
  ListarContactosQueryType,
  BulkDeleteBody,
} from '../schemas/contactoSchema.js';
import type { ContactoImportRow } from '../services/contactoService.js';

async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as ListarContactosQueryType;
    const result = await listarContactos(query);
    sendSuccess(res, result);
  } catch (err: any) {
    if (err.message && err.message.includes('El CUIT')) {
      sendError(res, 'BAD_REQUEST', err.message, 400);
      return;
    }
    next(err);
  }
}

async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CrearContactoBody;
    const contacto = await crearContacto(body);
    if (!contacto) {
      sendError(res, 'CONFLICT', 'El contacto ya existe', 409);
      return;
    }
    await registrarAccion(req.user?.userId || null, 'CREAR', 'CONTACTO', contacto.id, { email: contacto.email });
    sendSuccess(res, contacto, 201);
  } catch (err: any) {
    if (err.message && err.message.includes('El CUIT')) {
      sendError(res, 'BAD_REQUEST', err.message, 400);
      return;
    }
    next(err);
  }
}

async function actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const body = req.body as ActualizarContactoBody;

    const contacto = await actualizarContacto(id, body);

    if (!contacto) {
      sendError(res, 'NOT_FOUND', 'Contacto no encontrado', 404);
      return;
    }

    await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'CONTACTO', contacto.id, { email: contacto.email });
    sendSuccess(res, contacto);
  } catch (err: any) {
    if (err.message && err.message.includes('El CUIT')) {
      sendError(res, 'BAD_REQUEST', err.message, 400);
      return;
    }
    next(err);
  }
}

async function eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const contacto = await eliminarContacto(id);

    if (!contacto) {
      sendError(res, 'NOT_FOUND', 'Contacto no encontrado', 404);
      return;
    }

    await registrarAccion(req.user?.userId || null, 'ELIMINAR', 'CONTACTO', contacto.id, { email: contacto.email });
    sendSuccess(res, contacto);
  } catch (err: any) {
    if (err.message && err.message.includes('El CUIT')) {
      sendError(res, 'BAD_REQUEST', err.message, 400);
      return;
    }
    next(err);
  }
}

async function bulkDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as BulkDeleteBody;
    const eliminados = await eliminarContactosBulk(body.ids);
    sendSuccess(res, { count: eliminados });
  } catch (err: any) {
    if (err.message && err.message.includes('El CUIT')) {
      sendError(res, 'BAD_REQUEST', err.message, 400);
      return;
    }
    next(err);
  }
}

async function toggleEstado(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const { estado } = req.body as { estado: string };

    if (!estado || !['funcional', 'inactivo', 'rebotado'].includes(estado)) {
      sendError(res, 'BAD_REQUEST', 'Estado inválido', 400);
      return;
    }

    const contacto = await toggleEstadoContacto(id, estado);

    if (!contacto) {
      sendError(res, 'NOT_FOUND', 'Contacto no encontrado', 404);
      return;
    }

    await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'CONTACTO', contacto.id, { email: contacto.email, nuevo_estado: estado });
    sendSuccess(res, contacto);
  } catch (err: any) {
    if (err.message && err.message.includes('El CUIT')) {
      sendError(res, 'BAD_REQUEST', err.message, 400);
      return;
    }
    next(err);
  }
}

async function importarCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      sendError(res, 'BAD_REQUEST', 'No se proporcionó ningún archivo', 400);
      return;
    }

    const resultado = await importarContactosCsv(req.file.buffer);
    sendSuccess(res, resultado);
  } catch (err: any) {
    if (err.message && err.message.includes('El CUIT')) {
      sendError(res, 'BAD_REQUEST', err.message, 400);
      return;
    }
    next(err);
  }
}

async function importarJson(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { contactos } = req.body as { contactos: ContactoImportRow[] };
    if (!Array.isArray(contactos) || contactos.length === 0) {
      sendError(res, 'BAD_REQUEST', 'El array de contactos está vacío o es inválido', 400);
      return;
    }
    const result = await importarContactosJson(contactos);
    sendSuccess(res, result, 200);
  } catch (err: any) {
    if (err.message && err.message.includes('El CUIT')) {
      sendError(res, 'BAD_REQUEST', err.message, 400);
      return;
    }
    next(err);
  }
}

import { syncContactosFromSheets, getSyncStatus, resetSyncStatus } from '../services/googleSheetsService.js';

async function sincronizarConSheets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = getSyncStatus();
    if (status.isSyncing) {
      sendError(res, 'CONFLICT', 'Ya hay una sincronización en curso.', 409);
      return;
    }
    
    // Iniciar en segundo plano
    syncContactosFromSheets().catch(err => console.error('Fallo asíncrono en syncContactosFromSheets:', err));
    
    sendSuccess(res, {
      message: 'La sincronización se está ejecutando en segundo plano.',
    });
  } catch (err: any) {
    next(err);
  }
}

async function obtenerSyncStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = getSyncStatus();
    sendSuccess(res, status);
  } catch (err: any) {
    next(err);
  }
}

export const contactoController = {
  listar,
  crear,
  actualizar,
  eliminar,
  bulkDelete,
  toggleEstado,
  importarCsv,
  importarJson,
  sincronizarConSheets,
  obtenerSyncStatus
};
