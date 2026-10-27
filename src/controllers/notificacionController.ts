import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { agregarClienteSSE, removerClienteSSE } from '../services/realtimeService.js';
import { sendError } from '../utils/responseHandler.js';

export function streamNotificaciones(req: Request, res: Response): void {
  const user = req.user;
  if (!user) {
    sendError(res, 'UNAUTHORIZED', 'Usuario no autenticado para el canal de notificaciones', 401);
    return;
  }

  // Establecer cabeceras estándar para Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Evita el buffering en Nginx
  });

  const clienteId = randomUUID();
  agregarClienteSSE(clienteId, user.userId, user.rol, res);

  // Enviar evento inicial de confirmación de conexión
  res.write(`event: conectado\ndata: ${JSON.stringify({ status: 'ok', clienteId, timestamp: new Date().toISOString() })}\n\n`);

  // Detectar desconexión del cliente y limpiar recursos
  req.on('close', () => {
    removerClienteSSE(clienteId);
  });
}
