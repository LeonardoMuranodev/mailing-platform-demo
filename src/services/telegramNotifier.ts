import { config } from '../config/env.js';

/** Intervalo mínimo entre mensajes de Telegram (ms) para evitar flood */
const THROTTLE_MS = 30_000;

/** Timestamp del último mensaje enviado */
let lastSentAt = 0;

/** Cola de mensajes pendientes que fueron throttleados */
let pendingCount = 0;

/**
 * Envía una alerta de error crítico al chat de Telegram configurado.
 * Incluye throttling interno: máximo 1 mensaje cada 30 segundos.
 *
 * Si se reciben múltiples errores durante el throttle, se acumulan
 * y se menciona la cantidad en el próximo mensaje.
 */
export async function notifyError(context: string, error: Error | string): Promise<void> {
  const { telegramToken, telegramChatId } = config.notifier;

  if (!telegramToken || !telegramChatId) {
    return; // Telegram no configurado — silenciar
  }

  const now = Date.now();
  const elapsed = now - lastSentAt;

  if (elapsed < THROTTLE_MS) {
    pendingCount++;
    return;
  }

  lastSentAt = now;

  const errorMessage = error instanceof Error ? error.message : error;
  const stack = error instanceof Error && error.stack
    ? error.stack.substring(0, 1000)
    : 'N/A';

  const timestamp = new Date().toISOString();
  const pendingNote = pendingCount > 0
    ? `\n⚠️ +${pendingCount} error(es) suprimidos por throttle`
    : '';

  pendingCount = 0;

  const text = [
    `🚨 *ERROR CRÍTICO — 3F Mailer*`,
    ``,
    `📍 *Contexto:* ${escapeMarkdown(context)}`,
    `⏰ *Fecha:* ${timestamp}`,
    ``,
    `❌ *Mensaje:*`,
    `\`${escapeMarkdown(errorMessage)}\``,
    ``,
    `📋 *Stack:*`,
    `\`\`\``,
    escapeMarkdown(stack),
    `\`\`\``,
    pendingNote,
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (sendErr) {
    // Fallo al enviar la alerta — log local para no generar recursión
    console.error('[TelegramNotifier] Error enviando alerta:', sendErr);
  }
}

/**
 * Notifica que el pool de BD tuvo un error de conexión.
 */
export async function notifyDbError(error: Error): Promise<void> {
  await notifyError('Database Pool — Conexión perdida', error);
}

/**
 * Notifica una excepción no capturada (uncaughtException).
 */
export async function notifyUncaughtException(error: Error): Promise<void> {
  await notifyError('Uncaught Exception — El proceso se cerrará', error);
}

/**
 * Notifica una promesa rechazada sin manejar (unhandledRejection).
 */
export async function notifyUnhandledRejection(reason: unknown): Promise<void> {
  const err = reason instanceof Error
    ? reason
    : new Error(String(reason));
  await notifyError('Unhandled Promise Rejection', err);
}

/** Escapa caracteres especiales de Markdown v1 de Telegram */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
