import { Request, Response, NextFunction } from 'express';
import { dbPool } from '../config/db.js';
import { sendSuccess } from '../utils/responseHandler.js';

export const getSmtpLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawDias = req.query.dias as string;
    const dias = rawDias ? Math.max(1, Math.min(90, parseInt(rawDias, 10) || 7)) : 7;

    const result = await dbPool.query(`
      SELECT l.*, c.email as cuenta_email
      FROM smtp_logs l
      LEFT JOIN cuentas_smtp c ON l.cuenta_smtp_id = c.id
      WHERE l.creado_en >= NOW() - ($1 || ' days')::interval
      ORDER BY l.creado_en DESC
      LIMIT 100
    `, [dias]);

    sendSuccess(res, result.rows, 200, { dias_consultados: dias });
  } catch (error) {
    next(error);
  }
};
