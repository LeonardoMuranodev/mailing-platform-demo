import { z } from 'zod';

/** Schema de validación para el formulario de campaña (frontend) */
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

/** Tipo inferido desde Zod */
export type CampanaFormSchema = z.infer<typeof crearCampanaSchema>;

/**
 * Valida los datos del formulario y retorna los errores por campo.
 * Retorna null si es válido.
 */
export function validarFormulario(
  data: Record<string, unknown>,
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
