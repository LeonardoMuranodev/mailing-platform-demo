export type EstadoContacto = 'funcional' | 'inactivo' | 'rebotado inexistente' | 'rebotado bandeja llena' | 'rebotado spam' | 'rebotado desconocido';

export interface Contacto {
  id: string;
  empresa_nombre: string | null;
  email: string;
  tipo: string | null;
  estado: EstadoContacto;
  rubro_id: string | null;
  cuit: string | null;
  creado_en: string;
  actualizado_en: string | null;
}

export interface ContactoConRubro extends Contacto {
  rubro_nombre: string | null;
}

export interface CrearContactoInput {
  email: string;
  empresa_nombre?: string;
  cuit?: string;
  rubro_id?: string | null;
  tipo?: string;
  estado?: EstadoContacto;
}

export interface ActualizarContactoInput {
  email?: string;
  empresa_nombre?: string;
  cuit?: string;
  rubro_id?: string | null;
  tipo?: string;
  estado?: EstadoContacto;
}

export interface ListarContactosQuery {
  page?: number;
  limit?: number;
  busqueda?: string;
  rubro_id?: string;
  estado?: EstadoContacto;
}

export interface ContactosResponse {
  data: ContactoConRubro[];
  total: number;
  page: number;
  limit: number;
}
