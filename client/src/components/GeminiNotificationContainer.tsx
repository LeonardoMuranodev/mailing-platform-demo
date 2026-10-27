import React from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  Rocket, 
  PartyPopper, 
  AlertTriangle, 
  ShieldAlert, 
  X, 
  ExternalLink,
  MailCheck
} from 'lucide-react';
import { useNotificationStore } from '../stores/useNotificationStore';
import type { ToastNotification } from '../types/notificacion';

export const GeminiNotificationContainer: React.FC = () => {
  const { toasts, removerToast, navegarCallback } = useNotificationStore();

  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <NotificationToast 
          key={toast.id} 
          toast={toast} 
          onClose={() => removerToast(toast.id)}
          onNavigate={(url) => {
            if (navegarCallback) navegarCallback(url);
            removerToast(toast.id);
          }}
        />
      ))}
    </div>
  );
};

interface NotificationToastProps {
  toast: ToastNotification;
  onClose: () => void;
  onNavigate: (url: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ toast, onClose, onNavigate }) => {
  // Configuración de estilo y temática según el tipo de evento
  const getEventConfig = (tipo: ToastNotification['tipo']) => {
    switch (tipo) {
      case 'sync_started':
        return {
          icon: <RefreshCw size={18} className="animate-spin text-primary" />,
          borderColor: 'border-primary/40',
          accentBg: 'bg-primary/10',
          accentText: 'text-primary',
          shimmer: true,
        };
      case 'sync_finished':
        return {
          icon: <CheckCircle2 size={18} className="text-secondary" />,
          borderColor: 'border-secondary/40',
          accentBg: 'bg-secondary/10',
          accentText: 'text-secondary',
          shimmer: false,
        };
      case 'campaign_started':
        return {
          icon: <Rocket size={18} className="text-accent-orange" />,
          borderColor: 'border-accent-orange/40',
          accentBg: 'bg-accent-orange/10',
          accentText: 'text-accent-orange',
          shimmer: false,
        };
      case 'campaign_finished':
        return {
          icon: <PartyPopper size={18} className="text-secondary" />,
          borderColor: 'border-secondary/40',
          accentBg: 'bg-secondary/10',
          accentText: 'text-secondary',
          shimmer: false,
        };
      case 'campaign_approved':
        return {
          icon: <CheckCircle2 size={18} className="text-secondary" />,
          borderColor: 'border-secondary/40',
          accentBg: 'bg-secondary/10',
          accentText: 'text-secondary',
          shimmer: false,
        };
      case 'smtp_quota_warning':
        return {
          icon: <AlertTriangle size={18} className="text-warning" />,
          borderColor: 'border-warning/40',
          accentBg: 'bg-warning/10',
          accentText: 'text-warning',
          shimmer: false,
        };
      case 'smtp_account_issue':
        return {
          icon: <ShieldAlert size={18} className="text-danger" />,
          borderColor: 'border-danger/40',
          accentBg: 'bg-danger/10',
          accentText: 'text-danger',
          shimmer: false,
        };
      case 'test_mail_sent':
        return {
          icon: <MailCheck size={18} className="text-secondary" />,
          borderColor: 'border-secondary/40',
          accentBg: 'bg-secondary/10',
          accentText: 'text-secondary',
          shimmer: false,
        };
      case 'test_mail_error':
        return {
          icon: <AlertTriangle size={18} className="text-danger" />,
          borderColor: 'border-danger/40',
          accentBg: 'bg-danger/10',
          accentText: 'text-danger',
          shimmer: false,
        };
      default:
        return {
          icon: <CheckCircle2 size={18} className="text-primary" />,
          borderColor: 'border-border',
          accentBg: 'bg-surface',
          accentText: 'text-primary',
          shimmer: false,
        };
    }
  };

  const config = getEventConfig(toast.tipo);

  return (
    <div 
      className={`pointer-events-auto relative overflow-hidden bg-surface/95 backdrop-blur-md border ${config.borderColor} shadow-xl rounded-2xl p-4 transition-all duration-300 animate-slide-in text-dark`}
      role="alert"
    >
      {/* Barra de progreso animada para procesos en curso */}
      {config.shimmer && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary/20 overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-primary via-accent-orange to-primary animate-pulse" />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icono con badge de fondo */}
        <div className={`p-2 rounded-xl shrink-0 ${config.accentBg}`}>
          {config.icon}
        </div>

        {/* Contenido textual */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-dark truncate">
              {toast.titulo}
            </h4>
            <span className="text-[10px] text-muted whitespace-nowrap">
              Hace un instante
            </span>
          </div>

          <p className="text-xs text-muted mt-1 leading-relaxed">
            {toast.mensaje}
          </p>

          {/* Botón de acción opcional si tiene URL de destino */}
          {toast.urlDestino && (
            <button
              onClick={() => onNavigate(toast.urlDestino!)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark transition-colors cursor-pointer"
            >
              <span>Ver detalles</span>
              <ExternalLink size={12} />
            </button>
          )}
        </div>

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="text-muted hover:text-dark p-1 rounded-lg hover:bg-background/80 transition-colors shrink-0"
          aria-label="Cerrar notificación"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
