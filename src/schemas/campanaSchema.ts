import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// ── Helpers de coerción para multipart/form-data ─────────

/** Coerción segura: acepta boolean, string 'true'/'false', y lo normaliza a boolean */
const booleanCoerce = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0' || val === undefined || val === null) return false;
  return val;
}, z.boolean());

/** Parseo seguro: acepta JSON string o array nativo y lo normaliza a string[] */
const rubrosCoerce = z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed: unknown = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}, z.array(z.string({ message: 'Cada rubro debe ser texto' })));

// ── Schemas ──────────────────────────────────────────────

export const crearCampanaSchema = z.object({
  asunto: z
    .string({ message: 'El asunto es obligatorio' })
    .trim()
    .min(1, 'El asunto no puede estar vacío')
    .max(255, 'El asunto no puede exceder 255 caracteres'),

  cuerpo_html: z
    .string({ message: 'El cuerpo HTML es obligatorio' })
    .trim()
    .min(1, 'El cuerpo HTML no puede estar vacío')
    .transform((html) => DOMPurify.sanitize(html)),

  link_inscripcion: z
    .string()
    .trim()
    .url('El link de inscripción debe ser una URL válida')
    .optional()
    .or(z.literal('')),

  flyer_url: z
    .string()
    .trim()
    .optional(),

  fecha_limite_envio: z
    .string({ message: 'La fecha límite de envío es obligatoria' })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD'),

  prioridad: z
    .enum(['alta', 'media', 'baja'], {
      message: 'La prioridad debe ser: alta, media o baja',
    })
    .default('alta'),

  para_todos_rubros: booleanCoerce.default(true),

  rubros_seleccionados: rubrosCoerce.default([]),
});

export const cambiarEstadoSchema = z.object({
  estado: z.enum(['borrador', 'aprobada', 'en_proceso', 'pausada', 'completada', 'cancelada'], {
    message: 'Estado inválido. Valores permitidos: borrador, aprobada, en_proceso, pausada, completada, cancelada',
  }),
});

export const actualizarCampanaSchema = crearCampanaSchema.partial();

/** Esquema para validar params con UUID */
export const uuidParamSchema = z.object({
  id: z.string().uuid('El ID debe ser un UUID válido'),
});

// ── Tipos inferidos desde Zod ────────────────────────────
export type CrearCampanaBody = z.infer<typeof crearCampanaSchema>;
export type CambiarEstadoBody = z.infer<typeof cambiarEstadoSchema>;
export type ActualizarCampanaBody = z.infer<typeof actualizarCampanaSchema>;
