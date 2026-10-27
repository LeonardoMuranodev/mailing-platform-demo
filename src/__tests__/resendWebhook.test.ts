import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { handleResendWebhook } from '../controllers/resendWebhookController.js';
import { dbPool } from '../config/db.js';

// Clave sintética para mock de tests generada en runtime (evita falsos positivos de GitHub Secret Scanning)
const TEST_SECRET = ['whsec', Buffer.from('test_mock_signing_key_demo').toString('base64')].join('_');

describe('Resend Webhook Controller', () => {
  let app: express.Application;
  let WebhookClass: any;

  beforeAll(async () => {
    const svix = await import('svix');
    WebhookClass = svix.Webhook;
  });

  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = TEST_SECRET;
    app = express();
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    app.post('/api/webhooks/resend', handleResendWebhook);
    vi.clearAllMocks();
  });

  const createSignedPayload = (payloadObj: any) => {
    const rawPayload = JSON.stringify(payloadObj);
    const wh = new WebhookClass(TEST_SECRET);
    const timestamp = new Date();
    const msgId = 'msg_test_' + Math.random().toString(36).substring(7);
    const signature = wh.sign(msgId, timestamp, rawPayload);

    return {
      rawPayload,
      headers: {
        'svix-id': msgId,
        'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
        'svix-signature': signature,
        'Content-Type': 'application/json',
      },
    };
  };

  it('1. Debe rechazar peticiones sin cabeceras Svix con 400', async () => {
    const res = await request(app)
      .post('/api/webhooks/resend')
      .send({ type: 'email.delivered' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Faltan cabeceras de firma');
  });

  it('2. Debe rechazar peticiones con firma inválida con 401', async () => {
    const res = await request(app)
      .post('/api/webhooks/resend')
      .set('svix-id', 'msg_123')
      .set('svix-timestamp', Math.floor(Date.now() / 1000).toString())
      .set('svix-signature', 'v1,firma_invalida_totalmente')
      .send({ type: 'email.delivered' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Firma de webhook inválida');
  });

  it('3. Debe procesar email.bounced y marcar contacto y cola como rebotado/fallido', async () => {
    const querySpy = vi.spyOn(dbPool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM cola_envios')) {
        return { rows: [{ id: 42, contacto_id: 'uuid-contacto-123' }] } as any;
      }
      return { rows: [] } as any;
    });

    const event = {
      type: 'email.bounced',
      created_at: new Date().toISOString(),
      data: {
        email_id: 'resend_email_abc123',
        to: ['destinatario@empresa.com'],
        bounce: {
          message: '550 5.1.1 User unknown',
          subType: 'permanent_does_not_exist',
        },
      },
    };

    const { rawPayload, headers } = createSignedPayload(event);

    const res = await request(app)
      .post('/api/webhooks/resend')
      .set(headers)
      .send(rawPayload);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    // Verificar actualización de contacto a rebotado inexistente
    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE contactos SET estado = $1'),
      expect.arrayContaining(['rebotado inexistente', 'uuid-contacto-123'])
    );

    // Verificar actualización de cola a fallido
    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE cola_envios \n             SET estado = \'fallido\''),
      expect.arrayContaining([expect.stringContaining('[RESEND_BOUNCE]'), 42])
    );
  });

  it('4. Debe procesar email.complained y marcar contacto como rebotado spam', async () => {
    const querySpy = vi.spyOn(dbPool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM cola_envios')) {
        return { rows: [{ id: 99, contacto_id: 'uuid-contacto-456' }] } as any;
      }
      return { rows: [] } as any;
    });

    const event = {
      type: 'email.complained',
      created_at: new Date().toISOString(),
      data: {
        email_id: 'resend_email_spam123',
        to: ['quejoso@empresa.com'],
        complaint: {
          complaintSubType: 'abuse',
        },
      },
    };

    const { rawPayload, headers } = createSignedPayload(event);

    const res = await request(app)
      .post('/api/webhooks/resend')
      .set(headers)
      .send(rawPayload);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE contactos SET estado = \'rebotado spam\''),
      expect.arrayContaining(['uuid-contacto-456'])
    );
  });

  it('5. Debe procesar email.opened y registrar fecha_apertura', async () => {
    const querySpy = vi.spyOn(dbPool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM cola_envios') && sql.includes('SELECT')) {
        return { rows: [{ id: 88, contacto_id: 'uuid-789' }] } as any;
      }
      return { rows: [] } as any;
    });

    const event = {
      type: 'email.opened',
      created_at: new Date().toISOString(),
      data: {
        email_id: 'resend_opened_123',
        to: ['abridor@empresa.com'],
      },
    };

    const { rawPayload, headers } = createSignedPayload(event);

    const res = await request(app)
      .post('/api/webhooks/resend')
      .set(headers)
      .send(rawPayload);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE cola_envios \n             SET fecha_apertura = COALESCE(fecha_apertura, CURRENT_TIMESTAMP)'),
      expect.arrayContaining([88])
    );
  });

  it('6. Debe procesar email.clicked y registrar fecha_click y fecha_apertura', async () => {
    const querySpy = vi.spyOn(dbPool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM cola_envios') && sql.includes('SELECT')) {
        return { rows: [{ id: 77, contacto_id: 'uuid-clicker' }] } as any;
      }
      return { rows: [] } as any;
    });

    const event = {
      type: 'email.clicked',
      created_at: new Date().toISOString(),
      data: {
        email_id: 'resend_clicked_123',
        to: ['clicker@empresa.com'],
        click: {
          link: 'https://empresa.com/tramite',
        },
      },
    };

    const { rawPayload, headers } = createSignedPayload(event);

    const res = await request(app)
      .post('/api/webhooks/resend')
      .set(headers)
      .send(rawPayload);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining('SET fecha_click = COALESCE(fecha_click, CURRENT_TIMESTAMP)'),
      expect.arrayContaining([77])
    );
  });
});
