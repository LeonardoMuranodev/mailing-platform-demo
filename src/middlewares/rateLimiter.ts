import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

/**
 * Generador de identificador para Rate Limiting:
 * Prioriza el ID de usuario autenticado sobre la IP de red.
 * Esto evita que múltiples encargadas o usuarios en la misma oficina
 * o detrás de proxies inversos (Nginx / Docker) compitan por el mismo límite.
 */
export function getClientIdentifier(req: Request): string {
  // 1. Si req.user ya fue adjuntado por requireAuth
  const user = (req as any).user;
  if (user?.userId || user?.id) {
    return `user:${user.userId || user.id}`;
  }

  // 2. Si viene el header Authorization Bearer, extraer userId rápidamente
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.decode(token) as { userId?: string; id?: string } | null;
      if (decoded?.userId || decoded?.id) {
        return `user:${decoded.userId || decoded.id}`;
      }
    } catch {
      // Si falla la decodificación, fallback a IP
    }
  }

  // 3. Fallback a IP (tomando en cuenta proxies)
  return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}

/**
 * Limiter para endpoints de autenticación.
 * Protege contra ataques de fuerza bruta al login.
 *
 * 10 intentos por IP cada 15 minutos.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  validate: { trustProxy: false, keyGeneratorIpFallback: false },
  standardHeaders: true,    // Retorna rate limit info en `RateLimit-*` headers
  legacyHeaders: false,     // Desactiva `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.',
    },
  },
});

/**
 * Limiter general para todas las rutas de API.
 * Previene abuso masivo de cualquier endpoint.
 *
 * 3000 requests por usuario/IP cada 15 minutos.
 * Excluye endpoints de polling ligero (sync-status, health) para no agotar cuotas.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3000,
  keyGenerator: getClientIdentifier,
  validate: { trustProxy: false, keyGeneratorIpFallback: false },
  skip: (req) => {
    // Excluir endpoints de polling recurrente, streaming SSE y health checks
    return req.path.endsWith('/sync-status') || req.path.endsWith('/stream') || req.path.endsWith('/health');
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
    },
  },
});

/**
 * Limiter para operaciones costosas de cola de envíos.
 * Poblar la cola genera queries masivas — limitar fuertemente.
 *
 * 10 requests por usuario/IP cada minuto.
 */
export const queueLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  keyGenerator: getClientIdentifier,
  validate: { trustProxy: false, keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas operaciones de cola. Espera un momento antes de reintentar.',
    },
  },
});

/**
 * Limiter específico para la sincronización con Google Sheets.
 * Previene clics compulsivos sin bloquear el uso normal de la app.
 *
 * Máximo 5 solicitudes por minuto por usuario.
 */
export const syncSheetsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5,
  keyGenerator: getClientIdentifier,
  validate: { trustProxy: false, keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'SYNC_RATE_LIMIT',
      message: 'Se ha solicitado la sincronización recientemente. Por favor, espere un momento antes de volver a intentar.',
    },
  },
});


