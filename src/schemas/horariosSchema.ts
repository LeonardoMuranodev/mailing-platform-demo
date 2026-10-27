import { z } from 'zod';

export const actualizarHorariosSchema = z.object({
  hora_inicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'),
  hora_fin: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'),
  dias_permitidos: z.array(z.number().int().min(1).max(7)).nonempty('Debe seleccionar al menos un día'),
});

export const agregarFechaExcluidaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  motivo: z.string().max(255).optional(),
});
