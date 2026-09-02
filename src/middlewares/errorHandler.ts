import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/responseHandler.js';
import { notifyError } from '../services/telegramNotifier.js';

/**
 * Middleware global de errores.
 * Captura excepciones propagadas con next(err) y responde con el envelope estándar.
 *
 * — ZodError         → 400 con detalles de validación
 * — Error genérico   → 500 (oculta detalles en producción)
 *
 * Los errores 500 se notifican automáticamente por Telegram.
 */
export function errorHandler(
  err: unknown,
  req: Request,
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

  // ── Errores de negocio y fallback ─────────────────
  if (err instanceof Error) {
    const isProduction = process.env.NODE_ENV === 'production';

    // Errores de BD de PostgreSQL: NUNCA se muestran al usuario
    const isPgError = 'code' in err && typeof (err as any).code === 'string' && (err as any).code.match(/^[0-9A-Z]{5}$/);
    if (isPgError) {
      console.error('[DB Error]', err.message, (err as any).code);
      notifyError(`DB Error ${(err as any).code} — ${req.method} ${req.originalUrl}`, err).catch(() => {});
      sendError(res, 'INTERNAL_ERROR', 'Error interno del servidor', 500);
      return;
    }

    // Allow certain specific business errors to pass through even in production
    const isBusinessError = err.message.includes('Contraseña de aplicación') || 
                            err.message.includes('host SMTP') ||
                            err.message.includes('servidor SMTP');
                            
    const message = (isProduction && !isBusinessError) ? 'Error interno del servidor' : err.message;
    const statusCode = isBusinessError ? 400 : 500;

    if (isBusinessError) {
      console.warn(`[BusinessError] ${err.message}`);
    } else {
      console.error('[ErrorHandler]', err.message, isProduction ? '' : err.stack);
      // 🚨 Notificar errores 500 por Telegram (fire-and-forget)
      const route = `${req.method} ${req.originalUrl}`;
      notifyError(`ErrorHandler — ${route}`, err).catch(() => {});
    }

    sendError(
      res,
      isBusinessError ? 'BUSINESS_ERROR' : 'INTERNAL_ERROR',
      message,
      statusCode,
      (isProduction || isBusinessError) ? undefined : { stack: err.stack },
    );
    return;
  }

  // ── Fallback absoluto ────────────────────────────────
  console.error('[ErrorHandler] Unknown error:', err);
  notifyError('ErrorHandler — Unknown error type', new Error(String(err))).catch(() => {});
  sendError(res, 'UNKNOWN_ERROR', 'Error interno del servidor', 500);
}

