export type RealtimeEventType =
  | 'sync_started'
  | 'sync_finished'
  | 'campaign_started'
  | 'campaign_finished'
  | 'campaign_approved'
  | 'smtp_quota_warning'
  | 'smtp_account_issue'
  | 'test_mail_sent'
  | 'test_mail_error';

export interface RealtimePayload {
  tipo: RealtimeEventType;
  titulo: string;
  mensaje: string;
  detalles?: Record<string, unknown>;
  urlDestino?: string;
  timestamp: string;
}

export interface ToastNotification extends RealtimePayload {
  id: string;
  leida: boolean;
  expiraEn?: number; // timestamp en ms
  indeterminada?: boolean; // si es true no se auto-cierra (ej: sync_started)
}
