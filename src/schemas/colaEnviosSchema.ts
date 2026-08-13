import { z } from 'zod';

// ── Schema: Validación de params para poblar cola ────────────
export const poblarColaParamsSchema = z.object({
  campanaId: z.string().uuid('El campanaId debe ser un UUID válido'),
});

// ── Tipos inferidos ──────────────────────────────────────────
export type PoblarColaParams = z.infer<typeof poblarColaParamsSchema>;
