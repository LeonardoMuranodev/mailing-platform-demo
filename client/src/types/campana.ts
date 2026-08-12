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
