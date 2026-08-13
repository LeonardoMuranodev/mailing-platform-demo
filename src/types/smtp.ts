/** Estados posibles de una cuenta SMTP en el pool */
export type EstadoCuentaSmtp = 'activo' | 'agotado' | 'bloqueado';

/** Reflejo 1:1 de la fila en la tabla `cuentas_smtp` */
export interface CuentaSmtp {
  id: string;
  email: string;
  host: string;
  puerto: number;
  usuario: string;
  password_encrypted: string;
  estado: EstadoCuentaSmtp;
  enviados_hoy: number;
  limite_diario: number;
  ultimo_uso: string | null;          // TIMESTAMPTZ serializado como ISO string
  creado_en: string;
  actualizado_en: string;
}

/** Payload para registrar una nueva cuenta SMTP */
export interface CrearCuentaSmtpInput {
  email: string;
  host?: string;
  puerto?: number;
  usuario: string;
  password_encrypted: string;
  limite_diario?: number;
}

/** Payload parcial para actualizar una cuenta SMTP */
export interface ActualizarCuentaSmtpInput {
  email?: string;
  host?: string;
  puerto?: number;
  usuario?: string;
  password_encrypted?: string;
  estado?: EstadoCuentaSmtp;
  limite_diario?: number;
}
