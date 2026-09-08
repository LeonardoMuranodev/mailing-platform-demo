import rateLimit from 'express-rate-limit';

/**
 * Limiter para endpoints de autenticación.
 * Protege contra ataques de fuerza bruta al login.
 *
 * 10 intentos por IP cada 15 minutos.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
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
 * 2000 requests por IP cada 15 minutos.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 2000,
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
 * 5 requests por IP cada minuto.
 */
export const queueLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5,
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
