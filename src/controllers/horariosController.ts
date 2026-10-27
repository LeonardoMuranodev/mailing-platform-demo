import { Request, Response, NextFunction } from 'express';
import { dbPool } from '../config/db.js';
import { registrarAccion } from '../services/historialService.js';

export const horariosController = {
  async obtenerConfiguracion(req: Request, res: Response, next: NextFunction) {
    try {
      const configRes = await dbPool.query('SELECT * FROM configuracion_horarios WHERE id = 1');
      const excepcionesRes = await dbPool.query('SELECT * FROM fechas_excluidas ORDER BY fecha ASC');

      res.json({
        success: true,
        data: {
          configuracion: configRes.rows[0],
          fechas_excluidas: excepcionesRes.rows
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async actualizarConfiguracion(req: Request, res: Response, next: NextFunction) {
    try {
      const { hora_inicio, hora_fin, dias_permitidos } = req.body;
      const result = await dbPool.query(
        `UPDATE configuracion_horarios 
         SET hora_inicio = $1, hora_fin = $2, dias_permitidos = $3::jsonb 
         WHERE id = 1 RETURNING *`,
        [hora_inicio, hora_fin, JSON.stringify(dias_permitidos)]
      );

      await registrarAccion(req.user?.userId || null, 'ACTUALIZAR', 'HORARIOS', '1', { hora_inicio, hora_fin, dias_permitidos });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },

  async agregarFechaExcluida(req: Request, res: Response, next: NextFunction) {
    try {
      const { fecha, motivo } = req.body;
      const result = await dbPool.query(
        `INSERT INTO fechas_excluidas (fecha, motivo) 
         VALUES ($1, $2) RETURNING *`,
        [fecha, motivo || null]
      );

      await registrarAccion(req.user?.userId || null, 'CREAR', 'HORARIOS', null, { fecha_excluida: fecha, motivo });
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ success: false, error: { code: 'DUPLICATE', message: 'La fecha ya se encuentra excluida' } });
      }
      next(error);
    }
  },

  async eliminarFechaExcluida(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await dbPool.query('DELETE FROM fechas_excluidas WHERE id = $1 RETURNING *', [id]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Fecha excluida no encontrada' } });
      }

      await registrarAccion(req.user?.userId || null, 'ELIMINAR', 'HORARIOS', id, { fecha_eliminada: result.rows[0].fecha });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
};
