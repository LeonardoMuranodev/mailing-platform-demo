import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/responseHandler.js';

/**
 * Middleware global de errores.
 * Captura excepciones propagadas con next(err) y responde con el envelope estándar.
 *
 * — ZodError         → 400 con detalles de validación
 * — Error genérico   → 500 (oculta detalles en producción)
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ── Errores de validación Zod ────────────────────────
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    sendError(res, 'VALIDATION_ERROR', 'Error de validación en los datos enviados', 400, details);
    return;
  }

  // ── Errores de Multer ────────────────────────────────
  if (err instanceof Error && 'code' in err) {
    const multerErr = err as Error & { code: string };
    if (multerErr.code === 'LIMIT_FILE_SIZE') {
      sendError(res, 'FILE_TOO_LARGE', 'El archivo excede el tamaño máximo de 5 MB', 400);
      return;
    }
    if (multerErr.code === 'LIMIT_UNEXPECTED_FILE') {
      sendError(res, 'UNEXPECTED_FILE', 'Campo de archivo inesperado', 400);
      return;
    }
  }

  // ── Errores de negocio conocidos ─────────────────────
  if (err instanceof Error) {
    const isProduction = process.env.NODE_ENV === 'production';

    console.error('[ErrorHandler]', err.message, isProduction ? '' : err.stack);

    sendError(
      res,
      'INTERNAL_ERROR',
      isProduction ? 'Error interno del servidor' : err.message,
      500,
      isProduction ? undefined : { stack: err.stack },
    );
    return;
  }

  // ── Fallback absoluto ────────────────────────────────
  console.error('[ErrorHandler] Unknown error:', err);
  sendError(res, 'UNKNOWN_ERROR', 'Error interno del servidor', 500);
}
