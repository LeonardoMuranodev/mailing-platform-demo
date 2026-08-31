import { Request, Response } from 'express';
import { dbPool } from '../config/db.js';

export const getSmtpLogs = async (req: Request, res: Response) => {
  try {
    const result = await dbPool.query(`
      SELECT l.*, c.email as cuenta_email
      FROM smtp_logs l
      LEFT JOIN cuentas_smtp c ON l.cuenta_smtp_id = c.id
      ORDER BY l.creado_en DESC
      LIMIT 100
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching smtp logs:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
