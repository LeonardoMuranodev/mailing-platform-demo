import type { ApiResponse, CampanaResponse } from '../types/campana';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Crea una campaña en estado 'borrador'.
 * Envía multipart/form-data para soportar upload de flyer.
 */
export async function crearCampana(
  formData: FormData,
): Promise<ApiResponse<CampanaResponse>> {
  const res = await fetch(`${API_BASE}/api/campanas`, {
    method: 'POST',
    body: formData,
    // No setear Content-Type — el browser lo agrega con el boundary de multipart
  });

  const json = (await res.json()) as ApiResponse<CampanaResponse>;
  return json;
}

/**
 * Cambia el estado de una campaña existente.
 */
export async function cambiarEstadoCampana(
  id: string,
  estado: string,
): Promise<ApiResponse<CampanaResponse>> {
  const res = await fetch(`${API_BASE}/api/campanas/${id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  });

  const json = (await res.json()) as ApiResponse<CampanaResponse>;
  return json;
}
