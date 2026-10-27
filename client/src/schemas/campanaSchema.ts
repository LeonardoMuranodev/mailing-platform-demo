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

  usa_links_multiples: z.boolean().default(false),

  link_inscripcion: z
    .string()
    .refine(val => val === '' || z.string().url().safeParse(val).success, 'Ingresá una URL válida')
    .optional().default(''),
    
  link_nacion: z
    .string()
    .refine(val => val === '' || z.string().url().safeParse(val).success, 'Ingresá una URL válida')
    .optional().default(''),

  link_provincia: z
    .string()
    .refine(val => val === '' || z.string().url().safeParse(val).success, 'Ingresá una URL válida')
    .optional().default(''),

  fecha_limite_envio: z
    .string({ message: 'La fecha límite es obligatoria' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD'),

  prioridad: z.enum(['alta', 'media', 'baja'], {
    message: 'Seleccioná una prioridad válida',
  }),

  para_todos_rubros: z.boolean(),

  rubros_seleccionados: z.array(z.string()).default([]),
}).refine(data => {
  if (data.usa_links_multiples) {
    return data.link_nacion && data.link_nacion.length > 0 && data.link_provincia && data.link_provincia.length > 0;
  }
  return data.link_inscripcion && data.link_inscripcion.length > 0;
}, {
  message: "Debes completar el/los links de inscripción requeridos",
  path: ["link_inscripcion"]
});

/** Schema LAXO para guardar borrador (solo exige asunto con al menos 1 caracter) */
export const borradorCampanaSchema = z.object({
  asunto: z
    .string({ message: 'El asunto es obligatorio' })
    .min(1, 'El asunto no puede estar vacío')
    .max(255, 'El asunto no puede exceder 255 caracteres'),

  cuerpo_html: z.string().optional().default(''),
  usa_links_multiples: z.boolean().optional().default(false),
  link_inscripcion: z
    .string()
    .refine(
      (val) => val === '' || z.string().url().safeParse(val).success,
      'El link de inscripción no es una URL válida',
    )
    .optional()
    .default(''),
  link_nacion: z
    .string()
    .refine(
      (val) => val === '' || z.string().url().safeParse(val).success,
      'El link de Nación no es una URL válida',
    )
    .optional()
    .default(''),
  link_provincia: z
    .string()
    .refine(
      (val) => val === '' || z.string().url().safeParse(val).success,
      'El link de Provincia no es una URL válida',
    )
    .optional()
    .default(''),
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
