/** Estados posibles de un registro en la cola de envíos */
export type EstadoColaEnvio = 'pendiente' | 'procesando' | 'enviado' | 'fallido';

/** Reflejo 1:1 de la fila en la tabla `cola_envios` */
export interface ColaEnvio {
  id: number;                           // BIGSERIAL
  campana_id: string;
  contacto_id: string;
  cuenta_smtp_id: string | null;
  estado: EstadoColaEnvio;
  respuesta_smtp: string | null;
  intentos: number;
  fecha_programada: string;             // TIMESTAMPTZ
  fecha_envio: string | null;
  creado_en: string;
}

/** Resultado de la operación de poblado de cola */
export interface PoblarColaResult {
  campana_id: string;
  total_insertados: number;
  para_todos_rubros: boolean;
  rubros_filtrados: string[];
}
