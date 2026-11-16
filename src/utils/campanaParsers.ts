/**
 * Utilidades unificadas para el parseo, normalización y saneamiento de datos de campañas y destinatarios.
 * Centraliza la lógica para evitar discrepancias entre esquemas Zod, servicios y controladores.
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Normaliza una dirección de correo eliminando espacios y convirtiendo a minúsculas.
 */
export function normalizarEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Valida si un string cumple el formato estándar de dirección de email.
 */
export function esEmailValido(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(normalizarEmail(email));
}

/**
 * Parsea y normaliza una lista de destinatarios manuales desde cualquier formato admisible:
 * - Array de strings
 * - String JSON serializado (ej: '["correo@test.com"]')
 * - String delimitado por comas, punto y coma o saltos de línea (ej: 'a@test.com, b@test.com\nc@test.com')
 * 
 * Devuelve un array de emails únicos, en minúsculas y sin elementos vacíos.
 */
export function parsearDestinatariosManuales(val: unknown): string[] {
  if (!val) return [];

  if (Array.isArray(val)) {
    const list = val.map((e) => (typeof e === 'string' ? normalizarEmail(e) : '')).filter(Boolean);
    return Array.from(new Set(list));
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return [];

    // Intento 1: Parsear como JSON
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const list = parsed.map((e) => (typeof e === 'string' ? normalizarEmail(e) : '')).filter(Boolean);
          return Array.from(new Set(list));
        }
      } catch {
        // Fallback a regex si el JSON estaba malformado
      }
    }

    // Intento 2: Separar por comas, punto y coma o saltos de línea
    const parts = trimmed
      .split(/[\r\n,;]+/)
      .map((e) => normalizarEmail(e))
      .filter(Boolean);

    return Array.from(new Set(parts));
  }

  return [];
}

/**
 * Parsea y normaliza la lista de rubros seleccionados:
 * - Array de strings
 * - String JSON serializado (ej: '["metalurgica", "comercio"]')
 */
export function parsearRubrosSeleccionados(val: unknown): string[] {
  if (!val) return [];

  if (Array.isArray(val)) {
    return val.map((r) => String(r).trim()).filter(Boolean);
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((r) => String(r).trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return [];
}

