import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';

type ValidationTarget = 'body' | 'params' | 'query';

/**
 * Middleware factory que valida una porción del request contra un ZodSchema.
 * Si la validación falla, retorna HTTP 400 con los detalles formateados.
 * Si pasa, sobreescribe `req[target]` con el valor parseado (ya transformado/coercionado).
 */
export function validateSchema(
  schema: ZodSchema,
  target: ValidationTarget = 'body',
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const zodError = result.error;
      // Delegamos al errorHandler global para que formatee la ZodError
      next(zodError);
      return;
    }

    // Sobreescribimos con los datos parseados y transformados
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
}
