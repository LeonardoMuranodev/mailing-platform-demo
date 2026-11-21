/** Estados posibles de una cuenta SMTP en el pool */
export type EstadoCuentaSmtp = 'activo' | 'agotado' | 'bloqueado' | 'inactivo';

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
  minimo_por_ejecucion: number;
  maximo_por_ejecucion: number;
  ultimo_uso: string | null;
  bloqueada_hasta?: string | null;
  umbral_errores?: number;          // TIMESTAMPTZ serializado como ISO string
  es_oauth?: boolean;
  es_exclusiva?: boolean;
  es_principal?: boolean;
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
  minimo_por_ejecucion?: number;
  maximo_por_ejecucion?: number;
  umbral_errores?: number;
  es_exclusiva?: boolean;
  es_principal?: boolean;
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
  minimo_por_ejecucion?: number;
  maximo_por_ejecucion?: number;
  umbral_errores?: number;
  es_exclusiva?: boolean;
  es_principal?: boolean;
}
