import { Request, Response } from 'express';
import { dbPool } from '../config/db.js';

// GIF transparente de 1x1 pixel (Base64)
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export const trackOpen = async (req: Request, res: Response): Promise<void> => {
  try {
    const { colaId } = req.params;

    // Actualizamos fecha_apertura si no existe.
    // Usamos COALESCE para no sobreescribir la fecha de primera apertura si ya se abrió.
    if (colaId && !isNaN(Number(colaId))) {
      await dbPool.query(
        `UPDATE cola_envios 
         SET fecha_apertura = COALESCE(fecha_apertura, CURRENT_TIMESTAMP)
         WHERE id = $1`,
        [colaId]
      );
    }
  } catch (error) {
    console.error(`[Tracking] Error en trackOpen para colaId ${req.params.colaId}:`, error);
  } finally {
    // Siempre retornamos el pixel transparente
    res.set({
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Content-Length': PIXEL_GIF.length.toString(),
    });
    res.end(PIXEL_GIF);
  }
};

export const trackClick = async (req: Request, res: Response): Promise<void> => {
  try {
    const { colaId } = req.params;
    const redirectUrl = (req.query.url as string) || '#';

    // Si hace click, asumimos que también abrió el correo.
    if (colaId && !isNaN(Number(colaId))) {
      await dbPool.query(
        `UPDATE cola_envios 
         SET fecha_click = COALESCE(fecha_click, CURRENT_TIMESTAMP),
             fecha_apertura = COALESCE(fecha_apertura, CURRENT_TIMESTAMP)
         WHERE id = $1`,
        [colaId]
      );
    }

    // Redirección 302 a la URL de destino
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error(`[Tracking] Error en trackClick para colaId ${req.params.colaId}:`, error);
    res.redirect(302, (req.query.url as string) || '#');
  }
};
