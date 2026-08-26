export type EstadoCuentaSmtp = 'activo' | 'agotado' | 'bloqueado' | 'inactivo';

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
  historial_despachado?: number;
  ultimo_uso: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface CrearCuentaSmtpInput {
  email: string;
  host?: string;
  puerto?: number;
  usuario: string;
  password_encrypted: string;
  limite_diario?: number;
  minimo_por_ejecucion?: number;
  maximo_por_ejecucion?: number;
}

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
}
