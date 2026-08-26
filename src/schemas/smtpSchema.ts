import { z } from 'zod';

// ── Schema: Registrar cuenta SMTP ────────────────────────────
export const crearCuentaSmtpSchema = z.object({
  email: z
    .string({ message: 'El email es obligatorio' })
    .trim()
    .email('Debe ser un email válido'),

  host: z
    .string()
    .trim()
    .min(1, 'El host no puede estar vacío')
    .default('smtp.gmail.com'),

  puerto: z
    .number({ message: 'El puerto debe ser un número' })
    .int()
    .positive('El puerto debe ser positivo')
    .default(465),

  usuario: z
    .string({ message: 'El usuario es obligatorio' })
    .trim()
    .min(1, 'El usuario no puede estar vacío'),

  password_encrypted: z
    .string({ message: 'La contraseña es obligatoria' })
    .trim()
    .min(1, 'La contraseña no puede estar vacía'),

  limite_diario: z
    .number()
    .int()
    .positive('El límite diario debe ser positivo')
    .default(400),
  minimo_por_ejecucion: z
    .number()
    .int()
    .positive()
    .default(5),
  maximo_por_ejecucion: z
    .number()
    .int()
    .positive()
    .default(25),
});

// ── Schema: Actualizar cuenta SMTP (parcial) ─────────────────
export const actualizarCuentaSmtpSchema = z.object({
  email: z.string().trim().email('Debe ser un email válido').optional(),

  host: z.string().trim().min(1).optional(),

  puerto: z.number().int().positive().optional(),

  usuario: z.string().trim().min(1).optional(),

  password_encrypted: z.string().trim().min(1).optional(),

  estado: z
    .enum(['activo', 'agotado', 'bloqueado', 'inactivo'], {
      message: 'Estado inválido. Valores: activo, agotado, bloqueado, inactivo',
    })
    .optional(),

  limite_diario: z.number().int().positive().optional(),
  minimo_por_ejecucion: z.number().int().positive().optional(),
  maximo_por_ejecucion: z.number().int().positive().optional(),
});

// ── Tipos inferidos ──────────────────────────────────────────
export type CrearCuentaSmtpBody = z.infer<typeof crearCuentaSmtpSchema>;
export type ActualizarCuentaSmtpBody = z.infer<typeof actualizarCuentaSmtpSchema>;
