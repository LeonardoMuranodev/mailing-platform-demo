import { Request, Response } from 'express';
import { dbPool } from '../config/db.js';
import { config } from '../config/env.js';

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    created_at?: string;
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    bounce?: {
      message?: string;
      subType?: string;
      type?: string;
    };
    complaint?: {
      complaintSubType?: string;
    };
    click?: {
      link?: string;
      timestamp?: string;
    };
    tags?: Record<string, string>;
    headers?: Record<string, string>;
    [key: string]: any;
  };
}

/**
 * Controlador para procesar los webhooks oficiales de Resend firmados con Svix.
 * Ruta pública: POST /api/webhooks/resend
 */
export async function handleResendWebhook(req: Request, res: Response): Promise<void> {
  const secret = (process.env.RESEND_WEBHOOK_SECRET || config.resend.webhookSecret || '').replace(/"/g, '').trim();

  if (!secret || secret.startsWith('http')) {
    console.error('[Resend Webhook] RESEND_WEBHOOK_SECRET inválido o no configurado. Debe ser el secret provisto por Resend (inicia con whsec_).');
    res.status(500).json({ error: 'Webhook secret no configurado correctamente en el servidor' });
    return;
  }

  // 1. Obtención de cabeceras Svix
  const svixId = req.headers['svix-id'] as string;
  const svixTimestamp = req.headers['svix-timestamp'] as string;
  const svixSignature = req.headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn('[Resend Webhook] Petición rechazada: Faltan cabeceras de firma Svix.');
    res.status(400).json({ error: 'Faltan cabeceras de firma Svix requeridas' });
    return;
  }

  // 2. Verificación criptográfica con Svix usando rawBody
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const svixHeaders = {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  };

  let payload: ResendWebhookPayload;
  try {
    const { Webhook } = await import('svix');
    const wh = new Webhook(secret);
    wh.verify(rawBody, svixHeaders);
    payload = (typeof req.body === 'object' && req.body !== null && req.body.type)
      ? req.body
      : JSON.parse(rawBody.toString('utf8'));
  } catch (err: any) {
    console.warn('[Resend Webhook] Firma Svix inválida:', err.message || err);
    res.status(401).json({ error: 'Firma de webhook inválida' });
    return;
  }

  // 3. Procesamiento asíncrono seguro del evento
  try {
    const { type, data } = payload;
    const emailId = data?.email_id;
    const recipient = data?.to && data.to.length > 0 ? data.to[0].toLowerCase().trim() : null;

    console.log(`[Resend Webhook] Evento recibido: ${type} | EmailID: ${emailId} | Destinatario: ${recipient}`);

    // Identificar el registro en cola_envios:
    // Prioridad 1: Por tag/header de cola_id si fue enviado
    // Prioridad 2: Por proveedor_message_id (email_id de Resend)
    // Prioridad 3: Por email del destinatario en los envíos más recientes
    let colaId: number | null = null;
    let contactoId: string | null = null;

    const refTag = data?.tags?.cola_id || data?.headers?.['x-entity-ref-id'];
    if (refTag && !isNaN(Number(refTag))) {
      colaId = Number(refTag);
    }

    if (!colaId && emailId) {
      const matchRes = await dbPool.query(
        `SELECT id, contacto_id FROM cola_envios WHERE proveedor_message_id = $1 LIMIT 1`,
        [emailId]
      );
      if (matchRes.rows.length > 0) {
        colaId = matchRes.rows[0].id;
        contactoId = matchRes.rows[0].contacto_id;
      }
    }

    if (!colaId && recipient) {
      const matchContact = await dbPool.query(
        `SELECT ce.id, ce.contacto_id 
         FROM cola_envios ce
         JOIN contactos c ON c.id = ce.contacto_id
         WHERE LOWER(c.email) = $1
         ORDER BY ce.fecha_envio DESC NULLS LAST, ce.id DESC
         LIMIT 1`,
        [recipient]
      );
      if (matchContact.rows.length > 0) {
        colaId = matchContact.rows[0].id;
        contactoId = matchContact.rows[0].contacto_id;
      }
    }

    // Si aún no tenemos contactoId pero tenemos el destinatario, buscar el contacto
    if (!contactoId && recipient) {
      const cRes = await dbPool.query(
        `SELECT id FROM contactos WHERE LOWER(email) = $1 LIMIT 1`,
        [recipient]
      );
      if (cRes.rows.length > 0) {
        contactoId = cRes.rows[0].id;
      }
    }

    switch (type) {
      case 'email.bounced': {
        const rawMessage = data.bounce?.message || data.bounce?.subType || 'Rebote informado por Resend';
        const subType = (data.bounce?.subType || '').toLowerCase();
        
        let estadoContacto = 'rebotado desconocido';
        if (
          subType.includes('suppressed') ||
          subType.includes('permanent') ||
          subType.includes('undeliverable') ||
          subType.includes('does not exist')
        ) {
          estadoContacto = 'rebotado inexistente';
        } else if (subType.includes('full') || subType.includes('quota') || subType.includes('mailbox')) {
          estadoContacto = 'rebotado bandeja llena';
        }

        if (contactoId) {
          await dbPool.query(
            `UPDATE contactos SET estado = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2`,
            [estadoContacto, contactoId]
          );
        }

        if (colaId) {
          await dbPool.query(
            `UPDATE cola_envios 
             SET estado = 'fallido', respuesta_smtp = $1 
             WHERE id = $2`,
            [`[RESEND_BOUNCE] ${rawMessage}`, colaId]
          );
        }
        break;
      }

      case 'email.complained': {
        const reason = data.complaint?.complaintSubType || 'Queja por Spam';
        if (contactoId) {
          await dbPool.query(
            `UPDATE contactos SET estado = 'rebotado spam', actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`,
            [contactoId]
          );
        }
        if (colaId) {
          await dbPool.query(
            `UPDATE cola_envios 
             SET estado = 'fallido', respuesta_smtp = $1 
             WHERE id = $2`,
            [`[RESEND_SPAM_COMPLAINT] ${reason}`, colaId]
          );
        }
        break;
      }

      case 'email.suppressed': {
        if (contactoId) {
          await dbPool.query(
            `UPDATE contactos SET estado = 'inactivo', actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`,
            [contactoId]
          );
        }
        if (colaId) {
          await dbPool.query(
            `UPDATE cola_envios 
             SET estado = 'fallido', respuesta_smtp = '[RESEND_SUPPRESSED]' 
             WHERE id = $2`,
            [colaId]
          );
        }
        break;
      }

      case 'email.delivered': {
        if (colaId) {
          await dbPool.query(
            `UPDATE cola_envios 
             SET estado = 'enviado', fecha_envio = COALESCE(fecha_envio, CURRENT_TIMESTAMP)
             WHERE id = $1`,
            [colaId]
          );
        }
        break;
      }

      case 'email.opened': {
        if (colaId) {
          await dbPool.query(
            `UPDATE cola_envios 
             SET fecha_apertura = COALESCE(fecha_apertura, CURRENT_TIMESTAMP)
             WHERE id = $1`,
            [colaId]
          );
        }
        break;
      }

      case 'email.clicked': {
        if (colaId) {
          await dbPool.query(
            `UPDATE cola_envios 
             SET fecha_click = COALESCE(fecha_click, CURRENT_TIMESTAMP),
                 fecha_apertura = COALESCE(fecha_apertura, CURRENT_TIMESTAMP)
             WHERE id = $1`,
            [colaId]
          );
        }
        break;
      }

      default:
        console.log(`[Resend Webhook] Evento no procesable ignorado: ${type}`);
        break;
    }

    // 4. Confirmación rápida 200 OK para Resend
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Resend Webhook] Error interno procesando evento:', error);
    // Respondemos 200 para evitar saturación de reintentos en errores lógicos,
    // pero registramos el incidente.
    res.status(200).json({ received: true, warning: 'Procesado con advertencia' });
  }
}
