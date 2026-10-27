import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  Trash2, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  Rocket, 
  PartyPopper, 
  AlertTriangle, 
  ShieldAlert, 
  ExternalLink,
  MailCheck
} from 'lucide-react';
import { useNotificationStore } from '../stores/useNotificationStore';
import type { ToastNotification } from '../types/notificacion';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';

dayjs.extend(relativeTime);
dayjs.locale('es');

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { 
    historial, 
    permission, 
    pedirPermisoDesktop, 
    marcarLeidas, 
    limpiarHistorial,
    navegarCallback 
  } = useNotificationStore();

  const noLeidas = historial.filter((item) => !item.leida).length;

  // Cerrar al hacer clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen && noLeidas > 0) {
      marcarLeidas();
    }
    setIsOpen(!isOpen);
  };

  const getEventIcon = (tipo: ToastNotification['tipo']) => {
    switch (tipo) {
      case 'sync_started':
        return <RefreshCw size={16} className="text-primary animate-spin" />;
      case 'sync_finished':
        return <CheckCircle2 size={16} className="text-secondary" />;
      case 'campaign_started':
        return <Rocket size={16} className="text-accent-orange" />;
      case 'campaign_finished':
        return <PartyPopper size={16} className="text-secondary" />;
      case 'campaign_approved':
        return <CheckCircle2 size={16} className="text-secondary" />;
      case 'smtp_quota_warning':
        return <AlertTriangle size={16} className="text-warning" />;
      case 'smtp_account_issue':
        return <ShieldAlert size={16} className="text-danger" />;
      case 'test_mail_sent':
        return <MailCheck size={16} className="text-secondary" />;
      case 'test_mail_error':
        return <AlertTriangle size={16} className="text-danger" />;
      default:
        return <Sparkles size={16} className="text-primary" />;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Botón Campana con Badge */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-muted hover:text-dark hover:bg-background rounded-lg transition-colors focus:outline-none"
        title="Centro de Notificaciones"
        aria-label="Notificaciones"
      >
        <Bell size={19} />
        {noLeidas > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-orange text-[10px] font-bold text-white shadow-sm animate-pulse">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {/* Popover Desplegable */}
      {isOpen && (
        <>
          {/* Backdrop para móvil */}
          <div 
            className="fixed inset-0 bg-black/25 backdrop-blur-[1px] z-40 sm:hidden animate-fade-in"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-surface border border-border shadow-2xl rounded-2xl z-50 overflow-hidden animate-fade-in text-dark flex flex-col max-h-[calc(100vh-5rem)] sm:max-h-[32rem]">
            {/* Header */}
            <div className="p-3.5 border-b border-border flex items-center justify-between bg-surface shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Notificaciones</span>
                {historial.length > 0 && (
                  <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {historial.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {noLeidas > 0 && (
                  <button
                    onClick={marcarLeidas}
                    className="p-1.5 text-xs text-muted hover:text-primary rounded-md transition-colors"
                    title="Marcar todas como leídas"
                  >
                    <Check size={14} />
                  </button>
                )}
                {historial.length > 0 && (
                  <button
                    onClick={limpiarHistorial}
                    className="p-1.5 text-xs text-muted hover:text-danger rounded-md transition-colors"
                    title="Limpiar historial"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Banner de Solicitud de Permisos Web Notification */}
            {permission !== 'granted' && (
              <div className="bg-primary/10 border-b border-primary/20 p-3 flex items-start gap-2.5 shrink-0">
                <Bell size={16} className="text-primary shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <p className="text-dark font-medium leading-snug">
                    ¿Querés recibir alertas en Windows/Chrome mientras estás en Google Docs?
                  </p>
                  <button
                    onClick={pedirPermisoDesktop}
                    className="mt-1.5 px-2.5 py-1 bg-primary text-white rounded-md text-[11px] font-semibold hover:bg-primary-dark transition-colors cursor-pointer"
                  >
                    Activar alertas de escritorio
                  </button>
                </div>
              </div>
            )}

            {/* Lista de Notificaciones */}
            <div className="max-h-80 sm:max-h-96 overflow-y-auto divide-y divide-border flex-1">
            {historial.length === 0 ? (
              <div className="p-8 text-center text-muted">
                <Bell size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No hay notificaciones recientes</p>
              </div>
            ) : (
              historial.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 hover:bg-background/60 transition-colors flex items-start gap-3 ${
                    !item.leida ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="p-2 rounded-xl bg-surface border border-border shrink-0 mt-0.5">
                    {getEventIcon(item.tipo)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-dark truncate">
                        {item.titulo}
                      </span>
                      <span className="text-[10px] text-muted whitespace-nowrap">
                        {dayjs(item.timestamp).fromNow()}
                      </span>
                    </div>

                    <p className="text-xs text-muted mt-0.5 leading-relaxed">
                      {item.mensaje}
                    </p>

                    {item.urlDestino && (
                      <button
                        onClick={() => {
                          if (navegarCallback) navegarCallback(item.urlDestino!);
                          setIsOpen(false);
                        }}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-dark transition-colors cursor-pointer"
                      >
                        <span>Ver más</span>
                        <ExternalLink size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
};
