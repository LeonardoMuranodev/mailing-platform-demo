export type Rol = 'desarrollador' | 'encargada' | 'invitado';

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
