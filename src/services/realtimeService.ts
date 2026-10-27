import type { Response } from 'express';
import { logger } from '../utils/logger.js';

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

interface ClienteSSE {
  id: string;
  usuarioId: string;
  rol: string;
  res: Response;
  conectadoEn: Date;
}

const clientes = new Map<string, ClienteSSE>();

/**
 * Registra un nuevo cliente HTTP conectado a través de SSE.
 */
export function agregarClienteSSE(id: string, usuarioId: string, rol: string, res: Response): void {
  clientes.set(id, {
    id,
    usuarioId,
    rol,
    res,
    conectadoEn: new Date(),
  });

  logger.info(`[Realtime SSE] Cliente conectado: ${usuarioId} (rol: ${rol}, total activos: ${clientes.size})`);
}

/**
 * Remueve un cliente desconectado.
 */
export function removerClienteSSE(id: string): void {
  const cliente = clientes.get(id);
  if (cliente) {
    clientes.delete(id);
    logger.info(`[Realtime SSE] Cliente desconectado: ${cliente.usuarioId} (total activos: ${clientes.size})`);
  }
}

/**
 * Emite un evento en tiempo real a los clientes conectados cuyos roles estén autorizados.
 */
export function emitirAlertaRealtime(
  payload: RealtimePayload,
  rolesPermitidos: string[] = ['desarrollador', 'encargada']
): void {
  const data = JSON.stringify(payload);
  const mensajeSSE = `event: notificacion\ndata: ${data}\n\n`;

  let enviados = 0;
  for (const [id, cliente] of clientes.entries()) {
    if (rolesPermitidos.includes(cliente.rol)) {
      try {
        cliente.res.write(mensajeSSE);
        enviados++;
      } catch (err: unknown) {
        logger.error(`[Realtime SSE] Error enviando mensaje a cliente ${id}:`, err);
        clientes.delete(id);
      }
    }
  }

  logger.info(`[Realtime SSE] Evento '${payload.tipo}' emitido a ${enviados} cliente(s) activo(s).`);
}

/**
 * Heartbeat periódico cada 25 segundos para mantener vivas las conexiones
 * y evitar que proxies o Nginx las cierren por inactividad.
 */
setInterval(() => {
  if (clientes.size === 0) return;

  const ping = `: ping\n\n`;
  for (const [id, cliente] of clientes.entries()) {
    try {
      cliente.res.write(ping);
    } catch {
      clientes.delete(id);
    }
  }
}, 25000);
