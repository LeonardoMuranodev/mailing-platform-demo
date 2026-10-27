import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { config } from '../config/env.js';

interface OAuthConfig {
  user: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Obtiene la configuración OAuth2 correspondiente a un email dado
 */
export function obtenerConfiguracionOAuth(email: string): OAuthConfig | null {
  if (!email) return null;
  const currentEmail = email.toLowerCase().trim();

  const { clientId, clientSecret, cuentas } = config.oauth;
  if (!clientId || !clientSecret || !Array.isArray(cuentas)) {
    return null;
  }

  const cuenta = cuentas.find(
    c => c.user && c.user.toLowerCase().trim() === currentEmail && Boolean(c.refreshToken)
  );

  if (cuenta) {
    return {
      user: cuenta.user,
      clientId,
      clientSecret,
      refreshToken: cuenta.refreshToken,
    };
  }

  return null;
}

/**
 * Verifica si una cuenta de correo está configurada para despachar
 * a través de la API oficial de Gmail con OAuth 2.0.
 */
export function esCuentaOAuth(email: string): boolean {
  return Boolean(obtenerConfiguracionOAuth(email));
}

/**
 * Cliente OAuth2 para Gmail API según la cuenta emisora.
 */
function getOAuth2Client(email: string) {
  const oauthConfig = obtenerConfiguracionOAuth(email);
  if (!oauthConfig) {
    throw new Error(`Credenciales OAuth2 de Gmail API no configuradas para ${email}`);
  }

  const oauth2Client = new google.auth.OAuth2(oauthConfig.clientId, oauthConfig.clientSecret);
  oauth2Client.setCredentials({ refresh_token: oauthConfig.refreshToken });
  return oauth2Client;
}

/**
 * Compila un mensaje con Nodemailer (respetando HTML, adjuntos, tracking pixel y Reply-To)
 * y lo transmite de forma nativa a través de la API REST de Gmail (users.messages.send).
 */
export async function enviarConGmailApi(
  mailOptions: nodemailer.SendMailOptions,
  emailEmisor?: string
): Promise<{ response: string; messageId: string }> {
  let emisor = emailEmisor || '';
  if (!emisor && mailOptions.from) {
    const fromStr = typeof mailOptions.from === 'string' ? mailOptions.from : (mailOptions.from as any).address || '';
    const match = fromStr.match(/<([^>]+)>/) || [null, fromStr];
    emisor = match[1] || fromStr;
  }

  const oauth2Client = getOAuth2Client(emisor);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // 1. Compilar el mensaje MIME completo en memoria usando Nodemailer
  const memoryTransporter = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  });

  const compiled = await memoryTransporter.sendMail(mailOptions);
  const rawMimeBuffer = compiled.message as Buffer;

  // 2. Codificar en Base64URL según los requisitos de Google API
  const base64Url = rawMimeBuffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // 3. Enviar vía Gmail REST API
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: base64Url,
    },
  });

  const messageId = res.data.id || '';
  const response = `Gmail API 200 OK (id: ${messageId}, threadId: ${res.data.threadId})`;

  return {
    response,
    messageId,
  };
}
