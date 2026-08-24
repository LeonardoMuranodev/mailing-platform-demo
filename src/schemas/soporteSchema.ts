import { z } from 'zod';

export const reporteSchema = z.object({
  tipo: z.enum(['mejora', 'sugerencia', 'error']),
  descripcion: z.string().min(5, 'La descripción debe tener al menos 5 caracteres'),
});
