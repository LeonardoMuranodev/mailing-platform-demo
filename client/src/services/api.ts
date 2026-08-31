import type { ApiResponse, CampanaResponse, CampanaConStats, ColaEnvioItem } from '../types/campana';
import type { GlobalStatsResult } from '../types/stats';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Wrapper de fetch para manejar errores de red o caídas del backend de forma amigable.
 */
async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem('auth_token');
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.reload();
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Sesión expirada o inválida. Por favor, inicie sesión nuevamente.' }
      };
    }

    const contentType = res.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      return { 
        success: false, 
        error: { code: 'SERVER_ERROR', message: 'El servidor respondió con un formato inválido. Por favor, intente nuevamente más tarde.' } 
      };
    }
    
    return (await res.json()) as ApiResponse<T>;
  } catch (error) {
    return { 
      success: false, 
      error: { code: 'NETWORK_ERROR', message: 'No se pudo conectar con el servidor. Verifique su conexión y vuelva a intentar.' } 
    };
  }
}

/**
 * Crea una campaña en estado 'borrador'.
 * Envía multipart/form-data para soportar upload de flyer.
 */
export async function crearCampana(
  formData: FormData,
): Promise<ApiResponse<CampanaResponse>> {
  return fetchApi<CampanaResponse>(`${API_BASE}/api/campanas`, {
    method: 'POST',
    body: formData,
  });
}

/**
 * Cambia el estado de una campaña existente.
 */
export async function cambiarEstadoCampana(
  id: string,
  estado: string,
): Promise<ApiResponse<CampanaResponse>> {
  return fetchApi<CampanaResponse>(`${API_BASE}/api/campanas/${id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  });
}

/**
 * Elimina una campaña.
 */
export async function eliminarCampana(
  id: string,
): Promise<ApiResponse<{ message: string }>> {
  return fetchApi<{ message: string }>(`${API_BASE}/api/campanas/${id}`, {
    method: 'DELETE',
  });
}

export interface CampanasPaginatedResponse {
  data: CampanaResponse[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Lista campañas con filtros opcionales.
 */
export async function listarCampanas(filtros?: {
  asunto?: string;
  estado?: string;
  rubro?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<CampanasPaginatedResponse>> {
  const query = new URLSearchParams();
  if (filtros?.asunto) query.append('asunto', filtros.asunto);
  if (filtros?.estado) query.append('estado', filtros.estado);
  if (filtros?.rubro) query.append('rubro', filtros.rubro);
  if (filtros?.fecha_desde) query.append('fecha_desde', filtros.fecha_desde);
  if (filtros?.fecha_hasta) query.append('fecha_hasta', filtros.fecha_hasta);
  if (filtros?.page) query.append('page', filtros.page.toString());
  if (filtros?.limit) query.append('limit', filtros.limit.toString());

  return fetchApi<CampanasPaginatedResponse>(`${API_BASE}/api/campanas?${query.toString()}`);
}

/**
 * Obtiene el detalle de una campaña con estadísticas.
 */
export async function obtenerCampanaDetalle(
  id: string,
): Promise<ApiResponse<CampanaConStats>> {
  return fetchApi<CampanaConStats>(`${API_BASE}/api/campanas/${id}/detalle`);
}

/**
 * Obtiene la cola de envíos de una campaña con filtros opcionales.
 */
export async function obtenerColaCampana(
  campanaId: string,
  filtros?: {
    estado?: string;
    email?: string;
    cuenta_smtp_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
  },
): Promise<ApiResponse<ColaEnvioItem[]>> {
  const query = new URLSearchParams();
  if (filtros?.estado) query.append('estado', filtros.estado);
  if (filtros?.email) query.append('email', filtros.email);
  if (filtros?.cuenta_smtp_id) query.append('cuenta_smtp_id', filtros.cuenta_smtp_id);
  if (filtros?.fecha_desde) query.append('fecha_desde', filtros.fecha_desde);
  if (filtros?.fecha_hasta) query.append('fecha_hasta', filtros.fecha_hasta);

  return fetchApi<ColaEnvioItem[]>(`${API_BASE}/api/queue/${campanaId}?${query.toString()}`);
}

/**
 * Fuerza el procesamiento inmediato de la cola de envíos.
 */
export async function forzarEnvioCola(): Promise<ApiResponse<{ message: string }>> {
  return fetchApi<{ message: string }>(`${API_BASE}/api/queue/procesar-ahora`, {
    method: 'POST',
  });
}

/**
 * Obtiene las estadísticas globales del sistema de mailing.
 */
export async function obtenerEstadisticasGlobales(): Promise<ApiResponse<GlobalStatsResult>> {
  return fetchApi<GlobalStatsResult>(`${API_BASE}/api/stats/global`);
}

/**
 * Obtiene la lista de campañas con sus estadísticas para exportar.
 */
export async function exportarEstadisticasCampanas(): Promise<ApiResponse<any[]>> {
  return fetchApi<any[]>(`${API_BASE}/api/stats/export-campanas`);
}

// ── Cuentas SMTP ─────────────────────────────────────────────────────────────

import type { CuentaSmtp, CrearCuentaSmtpInput, ActualizarCuentaSmtpInput } from '../types/smtp';

export async function obtenerCuentasSmtp(): Promise<ApiResponse<CuentaSmtp[]>> {
  return fetchApi<CuentaSmtp[]>(`${API_BASE}/api/smtp`);
}

export async function crearCuentaSmtp(data: CrearCuentaSmtpInput): Promise<ApiResponse<CuentaSmtp>> {
  return fetchApi<CuentaSmtp>(`${API_BASE}/api/smtp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function actualizarCuentaSmtp(id: string, data: ActualizarCuentaSmtpInput): Promise<ApiResponse<CuentaSmtp>> {
  return fetchApi<CuentaSmtp>(`${API_BASE}/api/smtp/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function toggleEstadoSmtp(id: string, estado: 'activo' | 'inactivo'): Promise<ApiResponse<CuentaSmtp>> {
  return fetchApi<CuentaSmtp>(`${API_BASE}/api/smtp/${id}/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  });
}

export async function eliminarCuentaSmtp(id: string): Promise<ApiResponse<CuentaSmtp>> {
  return fetchApi<CuentaSmtp>(`${API_BASE}/api/smtp/${id}`, {
    method: 'DELETE',
  });
}

// ── Directorio de Contactos ──────────────────────────────────────────────────

import type {
  ContactoConRubro,
  CrearContactoInput,
  ActualizarContactoInput,
  ContactosResponse
} from '../types/contacto';

export async function obtenerContactos(filtros?: {
  page?: number;
  limit?: number;
  busqueda?: string;
  estado?: string;
  rubro_id?: string;
}): Promise<ApiResponse<ContactosResponse>> {
  const query = new URLSearchParams();
  if (filtros?.page) query.append('page', filtros.page.toString());
  if (filtros?.limit) query.append('limit', filtros.limit.toString());
  if (filtros?.busqueda) query.append('busqueda', filtros.busqueda);
  if (filtros?.estado) query.append('estado', filtros.estado);
  if (filtros?.rubro_id) query.append('rubro_id', filtros.rubro_id);

  return fetchApi<ContactosResponse>(`${API_BASE}/api/contactos?${query.toString()}`);
}

export async function crearContacto(data: CrearContactoInput): Promise<ApiResponse<ContactoConRubro>> {
  return fetchApi<ContactoConRubro>(`${API_BASE}/api/contactos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function actualizarContacto(id: string, data: ActualizarContactoInput): Promise<ApiResponse<ContactoConRubro>> {
  return fetchApi<ContactoConRubro>(`${API_BASE}/api/contactos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function toggleEstadoContacto(id: string, estado: 'funcional' | 'inactivo' | 'rebotado'): Promise<ApiResponse<ContactoConRubro>> {
  return fetchApi<ContactoConRubro>(`${API_BASE}/api/contactos/${id}/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  });
}

export async function eliminarContacto(id: string): Promise<ApiResponse<ContactoConRubro>> {
  return fetchApi<ContactoConRubro>(`${API_BASE}/api/contactos/${id}`, {
    method: 'DELETE',
  });
}

export async function eliminarContactosBulk(ids: string[]): Promise<ApiResponse<{ count: number }>> {
  return fetchApi<{ count: number }>(`${API_BASE}/api/contactos/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

export async function importarContactosCsv(formData: FormData): Promise<ApiResponse<{ procesados: number; insertados_o_actualizados: number }>> {
  return fetchApi<{ procesados: number; insertados_o_actualizados: number }>(`${API_BASE}/api/contactos/importar-csv`, {
    method: 'POST',
    body: formData,
  });
}

// ── USUARIOS ───────────────────────────────────────────────

export async function obtenerUsuarios(): Promise<ApiResponse<any>> {
  return fetchApi(`${API_BASE}/api/usuarios`);
}

export async function crearUsuario(data: any): Promise<ApiResponse<any>> {
  return fetchApi(`${API_BASE}/api/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function actualizarUsuario(id: string, data: any): Promise<ApiResponse<any>> {
  return fetchApi(`${API_BASE}/api/usuarios/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function eliminarUsuario(id: string): Promise<ApiResponse<any>> {
  return fetchApi(`${API_BASE}/api/usuarios/${id}`, {
    method: 'DELETE',
  });
}

// ── SOPORTE ───────────────────────────────────────────────

export async function obtenerReportesSoporte(): Promise<ApiResponse<any>> {
  return fetchApi(`${API_BASE}/api/soporte`);
}

export async function crearReporteSoporte(formData: FormData): Promise<ApiResponse<any>> {
  return fetchApi(`${API_BASE}/api/soporte`, {
    method: 'POST',
    body: formData,
  });
}

export async function marcarReporteResuelto(id: string): Promise<ApiResponse<any>> {
  return fetchApi(`${API_BASE}/api/soporte/${id}/resuelto`, {
    method: 'PATCH',
  });
}

