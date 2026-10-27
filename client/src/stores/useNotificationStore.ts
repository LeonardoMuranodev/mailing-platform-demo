import { create } from 'zustand';
import type { RealtimePayload, ToastNotification } from '../types/notificacion';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface NotificationState {
  toasts: ToastNotification[];
  historial: ToastNotification[];
  isConnected: boolean;
  permission: NotificationPermission;
  conectarSSE: (token: string) => void;
  desconectarSSE: () => void;
  pedirPermisoDesktop: () => Promise<NotificationPermission>;
  removerToast: (id: string) => void;
  marcarLeidas: () => void;
  limpiarHistorial: () => void;
  navegarCallback?: (url: string) => void;
  setNavegarCallback: (cb: (url: string) => void) => void;
  agregarNotificacion: (payload: RealtimePayload) => void;
}

let eventSourceInstance: EventSource | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  historial: [],
  isConnected: false,
  permission: typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default',
  navegarCallback: undefined,

  setNavegarCallback: (cb) => {
    set({ navegarCallback: cb });
  },

  pedirPermisoDesktop: async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      const perm = await Notification.requestPermission();
      set({ permission: perm });
      return perm;
    } catch {
      return 'denied';
    }
  },

  agregarNotificacion: (payload: RealtimePayload) => {
    // Evitar notificaciones duplicadas idénticas en una ventana de 3.5 segundos (ej: disparada localmente y recibida por SSE)
    const yaExiste = get().toasts.some(
      (t) => t.tipo === payload.tipo && t.titulo === payload.titulo && Math.abs(Date.now() - new Date(t.timestamp).getTime()) < 3500
    );
    if (yaExiste) return;

    const { permission, navegarCallback } = get();

    // 1. Notificación nativa de escritorio (Chrome / Windows Web Notification API)
    // Se dispara cuando hay permisos concedidos y la app está en segundo plano (otra pestaña o ventana)
    const permisoActual = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : permission;
    if (permisoActual === 'granted') {
      const enSegundoPlano = typeof document !== 'undefined' && (
        document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus())
      );

      if (enSegundoPlano) {
        try {
          const notif = new Notification(`GenMailer: ${payload.titulo}`, {
            body: payload.mensaje,
            icon: '/favicon.ico',
            tag: `3f-${payload.tipo}-${payload.timestamp}`,
          });

          notif.onclick = () => {
            window.focus();
            if (payload.urlDestino && navegarCallback) {
              navegarCallback(payload.urlDestino);
            }
            notif.close();
          };
        } catch (err) {
          console.error('[Web Notification] Error al lanzar notificación de escritorio:', err);
        }
      }
    }

    // 2. Gestionar Toasts en la aplicación
    const nuevoId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const esIndeterminada = payload.tipo === 'sync_started';

    set((state) => {
      let nuevosToasts = [...state.toasts];

      // Si terminó la sincronización, reemplazamos o removemos el toast de "sync_started"
      if (payload.tipo === 'sync_finished') {
        nuevosToasts = nuevosToasts.filter((t) => t.tipo !== 'sync_started');
      }

      const nuevoToast: ToastNotification = {
        ...payload,
        id: nuevoId,
        leida: false,
        indeterminada: esIndeterminada,
      };

      return {
        toasts: [nuevoToast, ...nuevosToasts].slice(0, 5), // Máximo 5 toasts visibles
        historial: [nuevoToast, ...state.historial].slice(0, 30), // Máximo 30 en historial
      };
    });

    // 3. Auto-remover tras 7 segundos (a menos que sea una tarea indeterminada activa)
    if (!esIndeterminada) {
      setTimeout(() => {
        get().removerToast(nuevoId);
      }, 7000);
    }
  },

  conectarSSE: (token: string) => {
    if (!token) return;

    // Evitar duplicar conexiones
    if (eventSourceInstance) {
      eventSourceInstance.close();
      eventSourceInstance = null;
    }

    const streamUrl = `${API_BASE}/api/notificaciones/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(streamUrl);
    eventSourceInstance = es;

    es.onopen = () => {
      set({ isConnected: true });
    };

    es.onerror = () => {
      set({ isConnected: false });
    };

    es.addEventListener('notificacion', (event: MessageEvent) => {
      try {
        const payload: RealtimePayload = JSON.parse(event.data);
        get().agregarNotificacion(payload);
      } catch (err) {
        console.error('[Realtime SSE] Error procesando mensaje de notificación:', err);
      }
    });
  },

  desconectarSSE: () => {
    if (eventSourceInstance) {
      eventSourceInstance.close();
      eventSourceInstance = null;
    }
    set({ isConnected: false });
  },

  removerToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  marcarLeidas: () => {
    set((state) => ({
      historial: state.historial.map((item) => ({ ...item, leida: true })),
    }));
  },

  limpiarHistorial: () => {
    set({ historial: [] });
  },
}));
