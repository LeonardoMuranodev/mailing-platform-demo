import { dbPool } from '../config/db.js';

export const soporteService = {
  async crearReporte(data: { tipo: string; descripcion: string; adjunto_url?: string; usuario_id: string }) {
    const result = await dbPool.query(
      `INSERT INTO reportes_soporte (tipo, descripcion, adjunto_url, usuario_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.tipo, data.descripcion, data.adjunto_url || null, data.usuario_id]
    );
    return result.rows[0];
  },

  async obtenerReportes() {
    const result = await dbPool.query(`
      SELECT r.*, u.nombre as usuario_nombre, u.email as usuario_email 
      FROM reportes_soporte r
      JOIN usuarios u ON r.usuario_id = u.id
      ORDER BY r.creado_en DESC
    `);
    return result.rows;
  },

  async marcarResuelto(id: string) {
    const result = await dbPool.query(
      `UPDATE reportes_soporte SET estado = 'resuelto' WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error('Reporte no encontrado');
    }
    return result.rows[0];
  }
};
