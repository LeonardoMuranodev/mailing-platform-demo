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

export async function notificarCampanaTerminada(campanaId: string, asunto: string, stats: { total: number; enviados: number; fallidos: number }) {
  const { smtpHost, smtpPort, smtpUser, smtpPass, telegramChatId, telegramToken } = config.notifier;

  let msg = `✅ *Campaña Finalizada*\n\n`;
  msg += `*Campaña:* ${asunto}\n`;
  msg += `*Total procesados:* ${stats.total}\n`;
  msg += `*Enviados exitosamente:* ${stats.enviados}\n`;
  msg += `*Fallidos:* ${stats.fallidos}\n`;

  // Enviar Email
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
      
      const htmlMsg = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Campaña Finalizada</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        
        <!-- Contenedor Principal -->
        <table border="0" cellpadding="0" cellspacing="0" width="620" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid #e1e6eb;">
          
          <!-- Banner Superior Institucional (Azul + Acento Naranja) -->
          <tr>
            <td style="background-color: #004578; border-top: 6px solid #E87722; padding: 25px 30px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 11px; font-weight: 700; color: #E87722; text-transform: uppercase; letter-spacing: 1.5px;">SISTEMA DE AUDITORÍA Y CONTROL</span>
                    <h1 style="color: #ffffff; font-size: 21px; font-weight: 600; margin: 6px 0 0 0; line-height: 1.3;">✅ Campaña Finalizada con Éxito</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding: 30px; color: #333333; font-size: 15px; line-height: 1.6;">
              
              <p style="margin-top: 0; font-size: 15px; color: #2d3748;">
                Se ha completado el ciclo de despacho masivo para la siguiente campaña:
              </p>
              
              <!-- Caja Nombre del Evento -->
              <div style="background-color: #f0f4f8; border-left: 4px solid #004578; padding: 14px 18px; border-radius: 4px; margin-bottom: 25px;">
                <span style="font-size: 12px; font-weight: 700; color: #004578; text-transform: uppercase;">Asunto de la Campaña</span>
                <div style="font-size: 16px; font-weight: 700; color: #1a202c; margin-top: 2px;">
                  ${asunto}
                </div>
              </div>

              <!-- Tabla Métrica con Identidad de Marca y Semántica de Errores -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-top: 10px; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;">
                <thead>
                  <tr style="background-color: #004578; color: #ffffff;">
                    <th align="left" style="padding: 12px 16px; font-size: 13px; font-weight: 600;">Métrica de Despacho</th>
                    <th align="right" style="padding: 12px 16px; font-size: 13px; font-weight: 600;">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom: 1px solid #edf2f7; background-color: #ffffff;">
                    <td style="padding: 12px 16px; color: #4a5568; font-weight: 500;">Total de empresas procesadas</td>
                    <td align="right" style="padding: 12px 16px; color: #1a202c; font-weight: 700;">
                      ${stats.total}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #edf2f7; background-color: #f8fafc;">
                    <td style="padding: 12px 16px; color: #10B981; font-weight: 600;">Correos enviados con éxito ✅</td>
                    <td align="right" style="padding: 12px 16px; color: #10B981; font-weight: 700; font-size: 16px;">
                      ${stats.enviados}
                    </td>
                  </tr>
                  <tr style="background-color: #ffffff;">
                    <td style="padding: 12px 16px; color: ${stats.fallidos > 0 ? '#EF4444' : '#718096'}; font-weight: 600;">
                      Correos con error ❌
                    </td>
                    <td align="right" style="padding: 12px 16px; color: ${stats.fallidos > 0 ? '#EF4444' : '#718096'}; font-weight: 700; font-size: 16px;">
                      ${stats.fallidos}
                    </td>
                  </tr>
                </tbody>
              </table>

            </td>
          </tr>

          <!-- Footer Unificado -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #718096; line-height: 1.4;">
                Este es un mensaje automático del sistema de envíos de la Municipalidad de Tres de Febrero
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;

      const mailOptions: any = {
        from: `"Sistema de Correos" <${smtpUser}>`,
        to: smtpUser,
        subject: `Campaña Finalizada: ${asunto}`,
        html: htmlMsg
      };

      await transporter.sendMail(mailOptions);
    } catch (e) {
      console.error('Error enviando email de campaña terminada', e);
    }
  }
}

export async function notificarCuotaGlobalAgotada() {
  const { smtpHost, smtpPort, smtpUser, smtpPass, telegramChatId, telegramToken } = config.notifier;

  const msg = `⚠️ *Cuota Excedida - Sistema de Mails de la municipalidad*\n\nTodas las cuentas llegaron al limite de envio de 500 mails HOY.`;

  // Enviar a Telegram
  if (telegramChatId && telegramToken) {
    try {
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: msg,
          parse_mode: 'Markdown'
        })
      });
    } catch (e) {
      console.error('Error enviando telegram de cuota agotada', e);
    }
  }

  // Enviar Email
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
      
      const htmlMsg = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerta de Sistema - Límite de Cuota Alcanzado</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        
        <!-- Contenedor Principal -->
        <table border="0" cellpadding="0" cellspacing="0" width="620" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid #e1e6eb;">
          
          <!-- Banner Superior Institucional (Azul + Acento Rojo Alerta) -->
          <tr>
            <td style="background-color: #004578; border-top: 6px solid #EF4444; padding: 25px 30px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 11px; font-weight: 700; color: #EF4444; text-transform: uppercase; letter-spacing: 1.5px;">MONITOREO DE INFRAESTRUCTURA</span>
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 6px 0 0 0; line-height: 1.3;">⚠️ Límite de Cuota Diaria Alcanzado</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding: 30px; color: #333333; font-size: 15px; line-height: 1.6;">
              
              <p style="margin-top: 0; font-size: 15px; color: #2d3748;">
                Estimada <strong>Dirección de Producción</strong>,
              </p>
              
              <p style="color: #4a5568; margin-bottom: 20px;">
                Te informamos que la plataforma ha suspendido preventivamente el despacho masivo debido a que se alcanzó la capacidad máxima de envíos de la infraestructura para la jornada de hoy.
              </p>
              
              <!-- Tabla de Estado y Métricas -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;">
                <thead>
                  <tr style="background-color: #004578; color: #ffffff;">
                    <th colspan="2" align="left" style="padding: 12px 16px; font-size: 13px; font-weight: 600;">Estado de la Infraestructura</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom: 1px solid #edf2f7; background-color: #ffffff;">
                    <td style="padding: 12px 16px; color: #004578; font-weight: 700; width: 200px; font-size: 13px;">Límite global alcanzado:</td>
                    <td style="padding: 12px 16px; color: #EF4444; font-weight: 700; font-size: 14px;">100% cuota consumida</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #edf2f7; background-color: #f8fafc;">
                    <td style="padding: 12px 16px; color: #004578; font-weight: 700; font-size: 13px;">Cuentas SMTP activas:</td>
                    <td style="padding: 12px 16px; color: #4a5568; font-size: 14px;">Todos los nodos</td>
                  </tr>
                  <tr style="background-color: #ffffff;">
                    <td style="padding: 12px 16px; color: #004578; font-weight: 700; font-size: 13px;">Circuit Breaker:</td>
                    <td style="padding: 12px 16px; color: #EF4444; font-weight: 700; font-size: 14px;">Activado (Envíos pausados)</td>
                  </tr>
                </tbody>
              </table>

              <!-- Caja de Gestión Operativa (Naranja 3F) -->
              <div style="background-color: #fffaf0; border-left: 4px solid #E87722; padding: 16px 18px; border-radius: 4px; margin-top: 25px;">
                <span style="font-size: 12px; font-weight: 700; color: #E87722; text-transform: uppercase; letter-spacing: 0.5px;">Gestión de Cola Pendiente</span>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #744210; line-height: 1.5;">
                  La cola de destinatarios permanece resguardada en la base de datos bajo el estado <span style="background-color: #edf2f7; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #2d3748;">pendiente</span>. El sistema reanudará automáticamente el despacho mañana a las 09:00 AM al resetearse los límites sin perder ningún registro.
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer Unificado Obligatorio -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #718096; line-height: 1.4;">
                Este es un mensaje automático del sistema de envíos de la Municipalidad de Tres de Febrero
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;

      const mailOptions: any = {
        from: `"Alerta Sistema" <${smtpUser}>`,
        to: smtpUser,
        subject: `⚠️ Límite de Cuota Diaria Alcanzado`,
        html: htmlMsg
      };

      await transporter.sendMail(mailOptions);
    } catch (e) {
      console.error('Error enviando email de cuota agotada', e);
    }
  }
}

export async function notificarCuentaProblema(email: string, tipo: 'agotada' | 'bloqueada', detalle: string) {
  const { telegramChatId, telegramToken } = config.notifier;

  const emoji = tipo === 'agotada' ? '⚠️' : '🚨';
  const accion = tipo === 'agotada' ? 'alcanzó su cuota diaria' : 'fue BLOQUEADA por excesos de rebotes';
  
  const msg = `${emoji} *Atención - Cuenta SMTP*\n\nLa cuenta \`${email}\` ${accion}.\n\n*Detalle:* ${detalle}`;

  if (telegramChatId && telegramToken) {
    try {
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: msg,
          parse_mode: 'Markdown'
        })
      });
    } catch (e) {
      console.error('Error enviando telegram de cuenta problema', e);
    }
  }
}
