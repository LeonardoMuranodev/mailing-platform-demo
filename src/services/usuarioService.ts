import { dbPool } from '../config/db.js';
import bcrypt from 'bcrypt';
import type { Usuario } from '../types/usuario.js';

export class UsuarioService {
  async obtenerUsuarios(): Promise<Omit<Usuario, 'password_hash'>[]> {
    const result = await dbPool.query(
      `SELECT id, nombre, email, rol, creado_en, actualizado_en 
       FROM usuarios 
       ORDER BY creado_en DESC`
    );
    return result.rows;
  }

  async crearUsuario(data: { nombre: string; email: string; password_hash: string; rol: string }) {
    if (data.rol === 'desarrollador') {
      const devs = await dbPool.query('SELECT id FROM usuarios WHERE rol = $1', ['desarrollador']);
      if (devs.rows.length > 0) {
        throw new Error('Ya existe un desarrollador en el sistema. Sólo puede haber uno.');
      }
    }
    
    // Verificar si el email ya existe
    const existing = await dbPool.query('SELECT id FROM usuarios WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      throw new Error('El email ya está registrado.');
    }

    const result = await dbPool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, email, rol, creado_en`,
      [data.nombre, data.email, data.password_hash, data.rol]
    );

    return result.rows[0];
  }

  async actualizarUsuario(id: string, data: { nombre: string; email: string; password_hash?: string; rol: string }) {
    if (data.rol === 'desarrollador') {
      const devs = await dbPool.query('SELECT id FROM usuarios WHERE rol = $1 AND id != $2', ['desarrollador', id]);
      if (devs.rows.length > 0) {
        throw new Error('Ya existe un desarrollador en el sistema. Sólo puede haber uno.');
      }
    }
    
    // Verificar si el email ya existe y pertenece a otro usuario
    const existing = await dbPool.query('SELECT id FROM usuarios WHERE email = $1 AND id != $2', [data.email, id]);
    if (existing.rows.length > 0) {
      throw new Error('El email ya está registrado en otra cuenta.');
    }

    let query = '';
    let values = [];

    if (data.password_hash) {
      query = `
        UPDATE usuarios 
        SET nombre = $1, email = $2, password_hash = $3, rol = $4, actualizado_en = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING id, nombre, email, rol, actualizado_en
      `;
      values = [data.nombre, data.email, data.password_hash, data.rol, id];
    } else {
      query = `
        UPDATE usuarios 
        SET nombre = $1, email = $2, rol = $3, actualizado_en = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, nombre, email, rol, actualizado_en
      `;
      values = [data.nombre, data.email, data.rol, id];
    }

    const result = await dbPool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado.');
    }

    return result.rows[0];
  }

  async eliminarUsuario(id: string, adminId: string) {
    if (id === adminId) {
      throw new Error('No puedes eliminar tu propia cuenta.');
    }

    const userToDelete = await dbPool.query('SELECT rol FROM usuarios WHERE id = $1', [id]);
    if (userToDelete.rows.length > 0 && userToDelete.rows[0].rol === 'desarrollador') {
      throw new Error('No puedes eliminar al único desarrollador del sistema.');
    }

    const result = await dbPool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado.');
    }
    
    return true;
  }
}
