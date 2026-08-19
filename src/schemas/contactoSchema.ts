import { z } from 'zod';

export const crearContactoSchema = z.object({
  email: z.string({ message: 'El email es obligatorio' }).trim().email('Email inválido'),
  empresa_nombre: z.string().trim().optional(),
  cuit: z.string().trim().optional(),
  rubro_id: z.string().optional().nullable(),
  tipo: z.string().default('empresa'),
  estado: z.enum(['funcional', 'inactivo', 'rebotado inexistente', 'rebotado bandeja llena', 'rebotado spam', 'rebotado desconocido']).default('funcional'),
});

export const actualizarContactoSchema = crearContactoSchema.partial();

export const listarContactosQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  busqueda: z.string().trim().optional(),
  rubro_id: z.string().optional(),
  estado: z.enum(['funcional', 'inactivo', 'rebotado inexistente', 'rebotado bandeja llena', 'rebotado spam', 'rebotado desconocido']).optional(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid('Cada ID debe ser un UUID válido')).min(1, 'Debe seleccionar al menos un contacto'),
});

export type CrearContactoBody = z.infer<typeof crearContactoSchema>;
export type ActualizarContactoBody = z.infer<typeof actualizarContactoSchema>;
export type ListarContactosQueryType = z.infer<typeof listarContactosQuerySchema>;
export type BulkDeleteBody = z.infer<typeof bulkDeleteSchema>;
