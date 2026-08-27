import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { config } from '../config/env.js';
import { dbPool } from '../config/db.js';
import nodemailer from 'nodemailer';

export const MODO_PRUEBA = false; // Igual que en tu n8n

// Emails a ignorar al extraer el destinatario rebotado
const IGNORAR_MAILS = [
  'mailer-daemon@googlemail.com',
  'mailer-daemon@gmail.com',
  'postmaster@',
  'leomellimurano@gmail.com',
  'claseiatecno@gmail.com',
  'dpim3f@gmail.com',
];

interface ReboteProcesado {
  email_fallido: string;
  estado_nuevo: string;
  motivo_error: string;
  subject_original: string;
  empresa_nombre: string;
  cuit: string;
  contacto_id: string;
}

/**
 * Función principal que lee IMAP, procesa rebotes, actualiza BD y envía alerta consolidada.
 */
export async function procesarRebotes() {
  const cuentasImap = MODO_PRUEBA ? config.imapTest : config.imapProd;

  if (!cuentasImap || cuentasImap.length === 0) {
    console.log('BounceService: No hay cuentas IMAP configuradas para el modo actual, saltando procesamiento de rebotes.');
    return;
  }

  const rebotadosGlobales: ReboteProcesado[] = [];

  for (const cuenta of cuentasImap) {
    console.log(`BounceService: Procesando rebotes para la cuenta ${cuenta.user}...`);
    const rebotesCuenta = await procesarCuenta(cuenta);
    if (rebotesCuenta.length > 0) {
      rebotadosGlobales.push(...rebotesCuenta);
    }
  }

  if (rebotadosGlobales.length > 0) {
    // 1. Deduplicación por email_fallido (priorizando 'Failure' sobre 'Delay')
    const rebotadosUnicosMap = new Map<string, ReboteProcesado>();
    
    for (const item of rebotadosGlobales) {
      const email = item.email_fallido;
      const subjectNuevo = item.subject_original.toLowerCase();

      if (!rebotadosUnicosMap.has(email)) {
        rebotadosUnicosMap.set(email, item);
      } else {
        const existente = rebotadosUnicosMap.get(email)!;
        const subjectExistente = existente.subject_original.toLowerCase();

        if (subjectNuevo.includes('failure') && !subjectExistente.includes('failure')) {
          rebotadosUnicosMap.set(email, item);
        }
      }
    }

    const rebotadosUnicos = Array.from(rebotadosUnicosMap.values());

    // 2. Actualizar la BD
    for (const rebote of rebotadosUnicos) {
      if (rebote.contacto_id) {
        // Actualizar estado del contacto
        await dbPool.query(`UPDATE contactos SET estado = $1 WHERE id = $2`, [rebote.estado_nuevo, rebote.contacto_id]);
        
        // Actualizar la cola de envíos para reflejar el error
        await dbPool.query(`
          UPDATE cola_envios
          SET estado = 'fallido', respuesta_smtp = $1
          WHERE contacto_id = $2 AND estado IN ('pendiente', 'procesando', 'enviado')
        `, [rebote.motivo_error, rebote.contacto_id]);
      }
    }

    console.log(`BounceService: ${rebotadosUnicos.length} rebotes totales procesados y BBDD actualizada.`);

    // 3. Enviar notificación HTML
    await enviarAvisoConsolidado(rebotadosUnicos);
  } else {
    console.log('BounceService: No se encontraron rebotes en ninguna de las cuentas.');
  }
}

async function procesarCuenta(cuenta: any): Promise<ReboteProcesado[]> {
  const { host, port, user, pass, tls } = cuenta;
  const rebotados: ReboteProcesado[] = [];

  const client = new ImapFlow({
    host,
    port,
    secure: tls,
    auth: {
      user,
      pass,
    },
    logger: false, // Desactivar logs verbose de imapflow
  });

  try {
    console.log(`BounceService [${user}]: Conectando a IMAP...`);
    await client.connect();
    
    let mailbox;
    try {
      mailbox = await client.mailboxOpen('rebotes');
    } catch (e) {
      console.log(`BounceService [${user}]: Carpeta 'rebotes' no encontrada, intentando con 'INBOX'...`);
      mailbox = await client.mailboxOpen('INBOX');
    }
    console.log(`BounceService [${user}]: Bandeja abierta. Mensajes totales: ${mailbox.exists}`);
    
    const fetchQuery = { seen: false };
    const searchResult = await client.search(fetchQuery);
    
    if (searchResult === false || searchResult.length === 0) {
      console.log(`BounceService [${user}]: No hay correos no leídos.`);
      return [];
    }
    
    console.log(`BounceService [${user}]: Procesando ${searchResult.length} correos no leídos...`);
    
    for await (const message of client.fetch(searchResult, { source: true, flags: true })) {
      if (!message.source) continue;
      
      const parsed: ParsedMail = await simpleParser(message.source);
      
      const body = parsed.html || parsed.textAsHtml || parsed.text || '';
      const bodyLower = body.toLowerCase();
      const subjectLower = (parsed.subject || '').toLowerCase();
      const fullText = `${subjectLower} ${bodyLower}`;

      let nuevoEstado = 'rebotado_desconocido';
      let razon = 'Motivo de rebote no categorizado';

      // 1. EVALUACIÓN: BANDEJA LLENA / OVER QUOTA
      if (
        fullText.includes('bandeja de entrada del destinatario está llena') ||
        fullText.includes('bandeja de entrada esté llena') ||
        fullText.includes('recibiendo demasiados mensajes') ||
        fullText.includes('over quota') ||
        fullText.includes('mailbox is full') ||
        fullText.includes('storage limit') ||
        fullText.includes('espacio insuficiente') ||
        fullText.includes('quota exceeded')
      ) {
        nuevoEstado = 'rebotado_bandeja_llena';
        razon = 'Bandeja de entrada llena / Cuota excedida';
      }
      // 2. EVALUACIÓN: DIRECCIÓN / CUENTA INEXISTENTE
      else if (
        fullText.includes('does not exist') ||
        fullText.includes('not found') ||
        fullText.includes('user unknown') ||
        fullText.includes('no se ha encontrado') ||
        fullText.includes('no encontramos el dominio') ||
        fullText.includes('address rejected') ||
        fullText.includes('no existe la cuenta') ||
        fullText.includes('unknown user') ||
        fullText.includes('550 5.1.1')
      ) {
        nuevoEstado = 'rebotado_inexistente';
        razon = 'El correo o dominio no existe';
      }
      // 3. EVALUACIÓN: SPAM / POLÍTICA / RECHAZO
      else if (
        fullText.includes('spam') ||
        fullText.includes('rejected') ||
        fullText.includes('policy') ||
        fullText.includes('bloqueado') ||
        fullText.includes('blacklisted') ||
        fullText.includes('554 5.7.1')
      ) {
        nuevoEstado = 'rebotado_spam';
        razon = 'Bloqueado por reglas de Spam / Política del servidor';
      }

      // Extracción de dirección de correo afectada
      const regex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
      const matches = body.match(regex);
      
      let emailFallido: string | null = null;
      if (matches) {
        emailFallido = matches.find((m: string) => {
          const mailClean = m.toLowerCase().trim();
          return !IGNORAR_MAILS.some(ignorado => mailClean.includes(ignorado));
        }) || null;
      }

      if (emailFallido) {
        emailFallido = emailFallido.toLowerCase().trim();
        
        // Buscar contacto en la BD para enriquecer
        const contactoResult = await dbPool.query(
          `SELECT id, empresa_nombre, cuit FROM contactos WHERE LOWER(email) = $1 LIMIT 1`, 
          [emailFallido]
        );

        let empresaNombre = 'Sin Especificar';
        let cuit = 'Sin CUIT';
        let contactoId = '';

        if (contactoResult.rows.length > 0) {
          empresaNombre = contactoResult.rows[0].empresa_nombre || 'Sin Especificar';
          cuit = contactoResult.rows[0].cuit || 'Sin CUIT';
          contactoId = contactoResult.rows[0].id;
        }

        rebotados.push({
          email_fallido: emailFallido,
          estado_nuevo: nuevoEstado,
          motivo_error: razon,
          subject_original: parsed.subject || '',
          empresa_nombre: empresaNombre,
          cuit: cuit,
          contacto_id: contactoId
        });
      }

      // Marcar como leído
      await client.messageFlagsAdd(message.seq.toString(), ['\\Seen'], { uid: false });
    }
  } catch (error) {
    console.error(`BounceService [${user}]: Error procesando rebotes`, error);
  } finally {
    try { await client.logout(); } catch(e) {}
    console.log(`BounceService [${user}]: Conexión IMAP cerrada.`);
  }
  
  return rebotados;
}

/**
 * Genera el HTML y envía el email consolidado a los administradores.
 */
export async function enviarAvisoConsolidado(rebotes: ReboteProcesado[]) {
  const destinatario = MODO_PRUEBA ? "claseiatecno@gmail.com" : "dpim3f@gmail.com";
  const cantidad = rebotes.length;
  const esPlural = cantidad > 1;

  const asunto = esPlural
    ? `⚠️ Aviso: Contactos con Emails Inválidos (${cantidad})`
    : `⚠️ Aviso: Contacto con Email Inválido - ${rebotes[0].email_fallido}`;

  const tituloHeader = esPlural
    ? `⚠️ Aviso: Contactos con Emails Inválidos (${cantidad})`
    : `⚠️ Aviso: Contacto con Email Inválido`;

  const bloquesRebotados = rebotes.map((item, index) => {
    return `
      <div style="margin-bottom: 25px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #004578; color: #ffffff; padding: 10px 16px; font-size: 13px; font-weight: 700; border-bottom: 2px solid #EF4444;">
          Registro #${index + 1} — ${item.empresa_nombre}
        </div>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
          <tbody>
            <tr style="border-bottom: 1px solid #edf2f7; background-color: #ffffff;">
              <td style="padding: 10px 16px; color: #004578; font-weight: 700; width: 160px; font-size: 13px;">Empresa:</td>
              <td style="padding: 10px 16px; color: #1a202c; font-weight: 600; font-size: 14px;">${item.empresa_nombre}</td>
            </tr>
            <tr style="border-bottom: 1px solid #edf2f7; background-color: #f8fafc;">
              <td style="padding: 10px 16px; color: #004578; font-weight: 700; font-size: 13px;">CUIT:</td>
              <td style="padding: 10px 16px; color: #4a5568; font-weight: 500; font-size: 14px;">${item.cuit}</td>
            </tr>
            <tr style="border-bottom: 1px solid #edf2f7; background-color: #ffffff;">
              <td style="padding: 10px 16px; color: #004578; font-weight: 700; font-size: 13px;">Email fallido:</td>
              <td style="padding: 10px 16px; color: #EF4444; font-weight: 700; font-size: 14px; font-family: monospace;">${item.email_fallido}</td>
            </tr>
            <tr style="border-bottom: 1px solid #edf2f7; background-color: #f8fafc;">
              <td style="padding: 10px 16px; color: #004578; font-weight: 700; font-size: 13px;">Estado BBDD:</td>
              <td style="padding: 10px 16px; color: #E87722; font-weight: 700; font-size: 14px; font-family: monospace;">${item.estado_nuevo}</td>
            </tr>
            <tr style="background-color: #ffffff;">
              <td style="padding: 10px 16px; color: #004578; font-weight: 700; font-size: 13px;">Motivo:</td>
              <td style="padding: 10px 16px; color: #718096; font-size: 13px;">${item.motivo_error}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  const htmlCompleto = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aviso de Emails Rebotados</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        
        <table border="0" cellpadding="0" cellspacing="0" width="620" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid #e1e6eb;">
          
          <!-- Banner Superior Institucional (Azul + Acento Rojo Alerta) -->
          <tr>
            <td style="background-color: #004578; border-top: 6px solid #EF4444; padding: 25px 30px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 11px; font-weight: 700; color: #EF4444; text-transform: uppercase; letter-spacing: 1.5px;">SISTEMA DE GESTIÓN Y DETECCIÓN DE REBOTES</span>
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 6px 0 0 0; line-height: 1.3;">${tituloHeader}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding: 30px; color: #333333; font-size: 15px; line-height: 1.6;">
              
              <p style="margin-top: 0; font-size: 15px; color: #2d3748;">
                Hola,
              </p>
              
              <p style="color: #4a5568; margin-bottom: 20px;">
                El sistema automático ha detectado ${esPlural ? `<strong>${cantidad} rebotes</strong> (emails inexistentes o fallidos)` : `un rebote (email inexistente o fallido)`} al intentar comunicarse con empresas. Los registros ya han sido actualizados en la base de datos.
              </p>
              
              <!-- Tablas con los detalles de cada rebote -->
              ${bloquesRebotados}

              <!-- Caja de Acción Sugerida (Destacado Naranja Institucional) -->
              <div style="background-color: #fffaf0; border-left: 4px solid #E87722; padding: 16px 18px; border-radius: 4px; margin-top: 25px;">
                <span style="font-size: 12px; font-weight: 700; color: #E87722; text-transform: uppercase; letter-spacing: 0.5px;">Acción Sugerida</span>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #744210; line-height: 1.5;">
                  Por favor, ubica los registros en la base de datos de Contactos, contacta a las empresas por vía telefónica o redes sociales para obtener direcciones de correo actualizadas y modifícalas.
                </p>
              </div>

              <p style="margin-top: 25px; margin-bottom: 0; color: #2d3748;">
                Saludos,<br>
                <strong style="color: #004578;">Equipo de Gestión — Dirección de Producción</strong>
              </p>

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

  const { smtpHost, smtpPort, smtpUser, smtpPass } = config.notifier;

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
      
      const mailOptions = {
        from: `"Sistema de Rebotes" <${smtpUser}>`,
        to: destinatario,
        subject: asunto,
        html: htmlCompleto
      };

      await transporter.sendMail(mailOptions);
      console.log('BounceService: Notificación de rebotes enviada a ' + destinatario);
    } catch (e) {
      console.error('BounceService: Error enviando email de notificación de rebotes', e);
    }
  }
}
