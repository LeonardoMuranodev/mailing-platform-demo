import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UsuarioService } from '../services/usuarioService.js';
import { sendSuccess } from '../utils/responseHandler.js';

const usuarioService = new UsuarioService();

export class UsuarioController {
  async obtenerUsuarios(_req: Request, res: Response) {
    const usuarios = await usuarioService.obtenerUsuarios();
    sendSuccess(res, usuarios);
  }

  async crearUsuario(req: Request, res: Response) {
    const { nombre, email, password, rol } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    
    const nuevoUsuario = await usuarioService.crearUsuario({
      nombre,
      email,
      password_hash,
      rol
    });

    sendSuccess(res, nuevoUsuario, 201);
  }

  async actualizarUsuario(req: Request, res: Response) {
    const id = req.params.id as string;
    const { nombre, email, password, rol } = req.body;

    let password_hash: string | undefined = undefined;
    if (password && password.trim() !== '') {
      password_hash = await bcrypt.hash(password, 10);
    }

    const usuario = await usuarioService.actualizarUsuario(id, {
      nombre,
      email,
      password_hash,
      rol
    });

    sendSuccess(res, usuario);
  }

  async eliminarUsuario(req: Request, res: Response) {
    const id = req.params.id as string;
    const adminId = (req as any).user.id; // User from requireAuth middleware

    await usuarioService.eliminarUsuario(id, adminId);
    sendSuccess(res, { deleted: true });
  }
}
