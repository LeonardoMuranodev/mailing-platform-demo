/** Estados válidos de una campaña según CHECK constraint en DB */
export type EstadoCampana =
  | 'borrador'
  | 'aprobada'
  | 'en_proceso'
  | 'pausada'
  | 'completada'
  | 'cancelada';

/** Prioridad de la campaña */
export type PrioridadCampana = 'alta' | 'media' | 'baja';

/** Reflejo 1:1 de la fila en la tabla `campanas` */
export interface Campana {
  id: string;
  asunto: string;
  cuerpo_html: string;
  link_inscripcion: string | null;
  flyer_url: string | null;
  fecha_limite_envio: string;          // DATE serializado como ISO string
  prioridad: PrioridadCampana;
  para_todos_rubros: boolean;
  rubros_seleccionados: string[];      // UUID[] de rubros
  estado: EstadoCampana;
  creado_en: string;                   // TIMESTAMPTZ
  actualizado_en: string;             // TIMESTAMPTZ
}

/** Payload para crear una campaña (campos obligatorios del INSERT) */
export interface CrearCampanaInput {
  asunto: string;
  cuerpo_html: string;
  link_inscripcion?: string;
  flyer_url?: string;
  fecha_limite_envio: string;
  prioridad?: PrioridadCampana;
  para_todos_rubros?: boolean;
  rubros_seleccionados?: string[];
}

/** Payload para cambiar el estado de una campaña */
export interface CambiarEstadoInput {
  estado: EstadoCampana;
}
