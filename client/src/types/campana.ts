/** Datos del formulario de creación de campaña */
export interface CampanaFormData {
  asunto: string;
  cuerpo_html: string;
  usa_links_multiples: boolean;
  link_inscripcion: string;
  link_nacion: string;
  link_provincia: string;
  flyer_url: string;
  adjunto_url: string;
  adjunto_nombre_original: string;
  adjuntos_extras: Array<{ url: string; nombre_original: string }>;
  fecha_limite_envio: string;
  prioridad: 'alta' | 'media' | 'baja';
  para_todos_rubros: boolean;
  rubros_seleccionados: string[];
  tipo_audiencia: 'rubros' | 'manual';
  destinatarios_manuales: string[];
}

export type EstadoCampana = 'borrador' | 'aprobada' | 'en_proceso' | 'pausada' | 'completada' | 'cancelada';

/** Campaña retornada por el backend */
export interface CampanaResponse {
  id: string;
  asunto: string;
  cuerpo_html: string;
  link_inscripcion: string | null;
  link_nacion: string | null;
  link_provincia: string | null;
  flyer_url: string | null;
  adjunto_url: string | null;
  adjunto_nombre_original: string | null;
  adjuntos_extras: Array<{ url: string; nombre_original: string }> | null;
  fecha_limite_envio: string;
  prioridad: 'alta' | 'media' | 'baja';
  para_todos_rubros: boolean;
  rubros_seleccionados: string[];
  tipo_audiencia?: 'rubros' | 'manual';
  destinatarios_manuales?: string[] | null;
  cuenta_emisor_id?: string | null;
  estado: EstadoCampana;
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
    abiertos: number;
    clicks: number;
    desglose_fallos?: Array<{ categoria: string; cantidad: number; porcentaje: number }>;
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
  fecha_apertura: string | null;
  fecha_click: string | null;
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
  usa_links_multiples: false,
  link_inscripcion: '',
  link_nacion: '',
  link_provincia: '',
  flyer_url: '',
  adjunto_url: '',
  adjunto_nombre_original: '',
  adjuntos_extras: [],
  fecha_limite_envio: '',
  prioridad: 'alta',
  para_todos_rubros: true,
  rubros_seleccionados: [],
  tipo_audiencia: 'rubros',
  destinatarios_manuales: [],
};
