import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware que agrega headers de seguridad HTTP a todas las respuestas.
 * Equivalente ligero de `helmet` sin dependencia externa.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Evitar que el navegador interprete archivos como un tipo MIME diferente
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevenir que la página sea embebida en iframes (clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');

  // Deshabilitado por recomendación moderna — se confía en CSP
  res.setHeader('X-XSS-Protection', '0');

  // HSTS — forzar HTTPS (solo efectivo detrás de proxy TLS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Controlar qué información de referrer se envía
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Ocultar Express del header X-Powered-By
  res.removeHeader('X-Powered-By');

  next();
}
