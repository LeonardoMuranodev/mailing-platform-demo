import { dbPool as pool } from '../config/db.js';

export const registrarAccion = async (
    usuarioId: string | null,
    accion: 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR' | 'ENVIAR',
    entidad: string,
    entidadId: string | null = null,
    detalles: any = null
) => {
    try {
        await pool.query(
            `INSERT INTO historial_cambios (usuario_id, accion, entidad, entidad_id, detalles)
             VALUES ($1, $2, $3, $4, $5)`,
            [usuarioId, accion, entidad, entidadId, detalles]
        );
    } catch (error) {
        console.error('Error al registrar historial:', error);
    }
};

export const obtenerHistorial = async (usuarioId?: string, limite = 100) => {
    let query = `
        SELECT h.*, u.nombre as usuario_nombre, u.email as usuario_email, u.rol as usuario_rol
        FROM historial_cambios h
        LEFT JOIN usuarios u ON h.usuario_id = u.id
    `;
    const params: any[] = [];

    if (usuarioId) {
        query += ` WHERE h.usuario_id = $1`;
        params.push(usuarioId);
    }

    query += ` ORDER BY h.creado_en DESC LIMIT $${params.length + 1}`;
    params.push(limite);

    const result = await pool.query(query, params);
    return result.rows;
};

// Cleanup old history (e.g. older than 1 year)
export const limpiarHistorialAntiguo = async () => {
    try {
        await pool.query(
            `DELETE FROM historial_cambios WHERE creado_en < NOW() - INTERVAL '1 year'`
        );
    } catch (error) {
        console.error('Error al limpiar historial antiguo:', error);
    }
};
