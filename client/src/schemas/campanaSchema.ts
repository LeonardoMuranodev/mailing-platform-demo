import { z } from 'zod';

/** Schema de validación ESTRICTO para aprobar una campaña (todos los campos obligatorios) */
export const crearCampanaSchema = z.object({
  asunto: z
    .string({ message: 'El asunto es obligatorio' })
    .min(1, 'El asunto no puede estar vacío')
    .max(255, 'El asunto no puede exceder 255 caracteres'),

  cuerpo_html: z
    .string({ message: 'El contenido del correo es obligatorio' })
    .min(1, 'Debés escribir el contenido del correo'),

  link_inscripcion: z
    .string()
    .url('Ingresá una URL válida (ej: https://ejemplo.com)')
    .or(z.literal(''))
    .optional(),

  fecha_limite_envio: z
    .string({ message: 'La fecha límite es obligatoria' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD'),

  prioridad: z.enum(['alta', 'media', 'baja'], {
    message: 'Seleccioná una prioridad válida',
  }),

  para_todos_rubros: z.boolean(),

  rubros_seleccionados: z.array(z.string()).default([]),
});

/** Schema LAXO para guardar borrador (solo exige asunto con al menos 1 caracter) */
export const borradorCampanaSchema = z.object({
  asunto: z
    .string({ message: 'El asunto es obligatorio' })
    .min(1, 'El asunto no puede estar vacío')
    .max(255, 'El asunto no puede exceder 255 caracteres'),

  cuerpo_html: z.string().optional().default(''),
  link_inscripcion: z.string().optional().default(''),
  fecha_limite_envio: z.string().optional().default(''),
  prioridad: z.enum(['alta', 'media', 'baja']).optional().default('alta'),
  para_todos_rubros: z.boolean().optional().default(true),
  rubros_seleccionados: z.array(z.string()).optional().default([]),
});

/** Tipo inferido desde Zod */
export type CampanaFormSchema = z.infer<typeof crearCampanaSchema>;

/**
 * Valida los datos del formulario con el schema ESTRICTO.
 * Retorna null si es válido.
 */
export function validarFormulario(
  data: unknown,
): Record<string, string> | null {
  const result = crearCampanaSchema.safeParse(data);

  if (result.success) return null;

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

/**
 * Valida los datos del formulario con el schema LAXO (borrador).
 * Retorna null si es válido.
 */
export function validarBorrador(
  data: unknown,
): Record<string, string> | null {
  const result = borradorCampanaSchema.safeParse(data);

  if (result.success) return null;

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
