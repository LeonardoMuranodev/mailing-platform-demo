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
  } catch (err) {
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
    sendSuccess(res, contacto, 201);
  } catch (err) {
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

    sendSuccess(res, contacto);
  } catch (err) {
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

    sendSuccess(res, contacto);
  } catch (err) {
    next(err);
  }
}

async function bulkDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as BulkDeleteBody;
    const eliminados = await eliminarContactosBulk(body.ids);
    sendSuccess(res, { count: eliminados });
  } catch (err) {
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

    sendSuccess(res, contacto);
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
};
