import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';

/**
 * Middleware para cachear respuestas GET en Redis.
 * @param ttl Segundos que durará la caché
 */
export const cache = (ttl: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Solo cacheamos peticiones GET con estado exitoso (lo filtramos al interceptar send/json)
    if (req.method !== 'GET') {
      return next();
    }

    const key = req.originalUrl;

    try {
      const cachedResponse = await redis.get(key);
      if (cachedResponse) {
        return res.json(JSON.parse(cachedResponse));
      }
    } catch (error) {
      console.error('Redis cache GET error:', error);
      // Fallback: si Redis falla, seguimos sin caché
      return next();
    }

    // Interceptamos la respuesta para guardarla en Redis
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Solo guardamos respuestas exitosas (200, 201)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          redis.setex(key, ttl, JSON.stringify(body)).catch(err => {
            console.error('Redis cache SET error:', err);
          });
        } catch (error) {
          console.error('Error caching response:', error);
        }
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Borra todas las keys de Redis que comiencen con un prefijo determinado.
 * Usado para invalidación al crear, actualizar o borrar datos.
 * @param prefix El inicio de la ruta a invalidar (ej: '/api/campanas')
 */
export const clearCacheByPrefix = async (prefix: string) => {
  try {
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = result[0];
      const keys = result[1];
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    console.error(`Error al limpiar cache con prefijo ${prefix}:`, error);
  }
};
