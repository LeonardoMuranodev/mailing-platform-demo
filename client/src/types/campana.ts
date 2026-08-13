/** Datos del formulario de creación de campaña */
export interface CampanaFormData {
  asunto: string;
  cuerpo_html: string;
  link_inscripcion: string;
  flyer_url: string;
  fecha_limite_envio: string;
  prioridad: 'alta' | 'media' | 'baja';
  para_todos_rubros: boolean;
  rubros_seleccionados: string[];
}

/** Campaña retornada por el backend */
export interface CampanaResponse {
  id: string;
  asunto: string;
  cuerpo_html: string;
  link_inscripcion: string | null;
  flyer_url: string | null;
  fecha_limite_envio: string;
  prioridad: 'alta' | 'media' | 'baja';
  para_todos_rubros: boolean;
  rubros_seleccionados: string[];
  estado: 'borrador' | 'aprobada' | 'en_proceso' | 'completada' | 'cancelada';
  creado_en: string;
  actualizado_en: string;
}

/** Campaña con estadísticas de cola agregadas */
export interface CampanaConStats extends CampanaResponse {
  stats: {
    total: number;
    pendientes: number;
    enviados: number;
    fallidos: number;
  };
}

/** Item de la cola de envíos (vista del frontend) */
export interface ColaEnvioItem {
  id: number;
  contacto_email: string;
  estado: 'pendiente' | 'procesando' | 'enviado' | 'fallido';
  respuesta_smtp: string | null;
  intentos: number;
  fecha_envio: string | null;
  cuenta_smtp_email: string | null;
  creado_en: string;
}

/** Envelope estándar de la API */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
  meta?: Record<string, unknown>;
}

/** Estado inicial vacío del formulario */
export const CAMPANA_FORM_INITIAL: CampanaFormData = {
  asunto: '',
  cuerpo_html: '',
  link_inscripcion: '',
  flyer_url: '',
  fecha_limite_envio: '',
  prioridad: 'alta',
  para_todos_rubros: true,
  rubros_seleccionados: [],
};
