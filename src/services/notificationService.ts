import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import fs from 'node:fs';
import path from 'node:path';

export async function notificarSoporte(tipo: string, descripcion: string, usuario: { nombre: string; email: string }, adjuntoUrl?: string) {
  const { smtpHost, smtpPort, smtpUser, smtpPass, telegramChatId, telegramToken } = config.notifier;

  let msg = `🛠 *Nuevo Reporte de Soporte*\n\n`;
  msg += `*Usuario:* ${usuario.nombre} (${usuario.email})\n`;
  msg += `*Tipo:* ${tipo.toUpperCase()}\n`;
  msg += `*Descripción:* ${descripcion}\n`;

  // Enviar a Telegram si está configurado
  if (telegramChatId && telegramToken) {
    try {
      if (adjuntoUrl) {
        const filePath = path.join(process.cwd(), adjuntoUrl);
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          const blob = new Blob([buffer]);
          const formData = new FormData();
          formData.append('chat_id', telegramChatId);
          formData.append('caption', msg);
          formData.append('parse_mode', 'Markdown');
          formData.append('document', blob, path.basename(filePath));

          await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, {
            method: 'POST',
            body: formData,
          });
        }
      } else {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: msg,
            parse_mode: 'Markdown'
          })
        });
      }
    } catch (e) {
      console.error('Error enviando telegram', e);
    }
  }

  // Enviar Email si está configurado
  if (smtpHost && smtpUser) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        }
      });
      
      const htmlMsg = `
        <h2>Nuevo Reporte de Soporte</h2>
        <p><strong>Usuario:</strong> ${usuario.nombre} (${usuario.email})</p>
        <p><strong>Tipo:</strong> ${tipo.toUpperCase()}</p>
        <p><strong>Descripción:</strong><br/>${descripcion.replace(/\\n/g, '<br/>')}</p>
        ${adjuntoUrl ? `<p><strong>Adjunto:</strong> <a href="${adjuntoUrl}">${adjuntoUrl}</a></p>` : ''}
      `;

      const mailOptions: any = {
        from: `"Soporte Sistema" <${smtpUser}>`,
        to: smtpUser, // Enviarlo al mismo destino
        subject: `Nuevo Ticket: ${tipo.toUpperCase()} de ${usuario.nombre}`,
        html: htmlMsg
      };

      if (adjuntoUrl) {
        const filePath = path.join(process.cwd(), adjuntoUrl);
        if (fs.existsSync(filePath)) {
          mailOptions.attachments = [
            {
              filename: path.basename(filePath),
              path: filePath
            }
          ];
        }
      }

      await transporter.sendMail(mailOptions);
    } catch (e) {
      console.error('Error enviando email de soporte', e);
    }
  }
}
