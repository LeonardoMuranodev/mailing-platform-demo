export type Rol = 'desarrollador' | 'encargada' | 'invitado';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  password_hash: string;
  rol: Rol;
  creado_en: string;
  actualizado_en: string;
}

/** Datos del usuario sin el hash (seguros para enviar al cliente) */
export interface UsuarioPublico {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

/** Payload embebido en el JWT */
export interface JwtPayload {
  userId: string;
  email: string;
  rol: Rol;
}
