import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { config } from '../config/env.js';

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
    .string()
    .trim()
    .transform((html) => DOMPurify.sanitize(html))
    .optional()
    .or(z.literal('')),

  link_inscripcion: z
    .string()
    .trim()
    .url('El link de inscripción debe ser una URL válida')
    .optional()
    .or(z.literal('')),

  link_nacion: z
    .string()
    .trim()
    .url('El link de Nación debe ser una URL válida')
    .optional()
    .or(z.literal('')),

  link_provincia: z
    .string()
    .trim()
    .url('El link de Provincia debe ser una URL válida')
    .optional()
    .or(z.literal('')),

  flyer_url: z
    .string()
    .trim()
    .optional(),

  adjunto_url: z
    .string()
    .trim()
    .optional(),

  adjuntos_extras: z.preprocess((val) => {
    if (!val) return [];
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return Array.isArray(val) ? val : [];
  }, z.array(z.object({
    url: z.string(),
    nombre_original: z.string(),
  })).max(config.maxAdjuntos, `No se pueden adjuntar más de ${config.maxAdjuntos} archivos`).optional().default([])),

  fecha_limite_envio: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((val) => {
      if (!val) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
      const hoy = new Date();
      // Ajustar por zona horaria de Argentina (-03:00)
      hoy.setHours(hoy.getHours() - 3);
      const hoyStr = hoy.toISOString().split('T')[0];
      return val > hoyStr;
    }, 'La fecha debe tener formato YYYY-MM-DD y ser posterior al día de hoy'),

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

/** Esquema para modificar fecha límite y prioridad de campañas activas o en borrador */
export const actualizarProgramacionSchema = z.object({
  fecha_limite_envio: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  prioridad: z.enum(['alta', 'media', 'baja']).optional(),
});

/** Esquema para validar params con UUID */
export const uuidParamSchema = z.object({
  id: z.string().uuid('El ID debe ser un UUID válido'),
});

// ── Tipos inferidos desde Zod ────────────────────────────
export type CrearCampanaBody = z.infer<typeof crearCampanaSchema>;
export type CambiarEstadoBody = z.infer<typeof cambiarEstadoSchema>;
export type ActualizarCampanaBody = z.infer<typeof actualizarCampanaSchema>;
export type ActualizarProgramacionBody = z.infer<typeof actualizarProgramacionSchema>;
