import type { Campana } from '../types/campana.js';
import DOMPurify from 'isomorphic-dompurify';

/** URLs de assets estáticos */
const HEADER_URL =
  'https://via.placeholder.com/600x150/f0f4f8/333333?text=Banner+Institucional';
const WHATSAPP_ICON = 'https://cdn-icons-png.flaticon.com/512/733/733585.png';
const MAIL_ICON = 'https://cdn-icons-png.flaticon.com/512/732/732200.png';

/** Datos de contacto */
const WHATSAPP_NUMBER = '5491100000000';
const CONTACT_EMAIL = 'contacto@organizacion.com';

interface EmailTemplateData {
  cuerpo_html: string;
  link_inscripcion: string | null;
  flyer_url: string | null;
}

/**
 * Genera el HTML completo del email listo para envío SMTP.
 * Replica el maquetado institucional predeterminado.
 *
 * Todos los estilos están inline para máxima compatibilidad con clientes de correo
 * (Gmail, Outlook, Yahoo, Apple Mail, etc.).
 */
export function generarHtmlEmail(data: EmailTemplateData): string {
  const { link_inscripcion, flyer_url } = data;
  // Defense in depth: sanitizar HTML incluso si ya fue sanitizado al crear la campaña
  const cuerpo_html = DOMPurify.sanitize(data.cuerpo_html);

  // ── Sección botón CTA (condicional) ──
  const botonHtml = link_inscripcion
    ? `
    <div style="text-align:center;margin:10px 0 35px 0;background:#ffffff;">
      <a href="${escapeHtml(link_inscripcion)}" style="background-color:#d85c37;color:#ffffff !important;padding:16px 40px;text-decoration:none;font-weight:bold;border-radius:6px;display:inline-block;font-size:20px;box-shadow:0 3px 6px rgba(0,0,0,0.15);">¡Inscribite!</a>
    </div>`
    : '';

  // ── Sección flyer (condicional) ──
  const flyerHtml = flyer_url
    ? `
    <div style="background-color:#f0f4f8;padding:20px;">
      <div>
        <img src="${escapeHtml(flyer_url)}" alt="Flyer del Evento" style="width:100%;display:block;border-radius:4px;border:none;">
      </div>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #e9ecef; margin: 0; padding: 20px; }
    .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    .header img { width: 100%; display: block; border: none; }
    .content { padding: 30px; font-size: 17px; line-height: 1.6; color: #333333; background: #ffffff; }
    .button-container { text-align: center; margin: 10px 0 35px 0; background: #ffffff; }
    .button { background-color: #d85c37; color: #ffffff !important; padding: 16px 40px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 20px; box-shadow: 0 3px 6px rgba(0,0,0,0.15); }
    .flyer-wrapper { background-color: #f0f4f8; padding: 20px; }
    .flyer img { width: 100%; display: block; border-radius: 4px; }
    .footer { background-color: #b1cde4; width: 100%; display: table; padding: 15px 0; }
    .footer-cell-text { display: table-cell; padding-left: 30px; vertical-align: middle; font-weight: bold; font-size: 16px; color: #000000; line-height: 1.4; }
    .footer-cell-icons { display: table-cell; padding-right: 30px; text-align: right; vertical-align: middle; width: 100px; white-space: nowrap; }
    .footer-icon { width: 42px; height: 42px; margin-left: 10px; display: inline-block; vertical-align: middle; }
  </style>
</head>
<body>
  <div class="container">

    <div class="header">
      <img src="${HEADER_URL}" alt="Banner Institucional">
    </div>

    <div class="content">
      <div style="white-space: pre-wrap;">${cuerpo_html}</div>
    </div>

    ${botonHtml}

    ${flyerHtml}

    <div class="footer">
      <div class="footer-cell-text">
        Comunicate con nosotros:<br>
      </div>
      <div class="footer-cell-icons" style="white-space: nowrap;">
        <a href="https://wa.me/${WHATSAPP_NUMBER}"><img class="footer-icon" src="${WHATSAPP_ICON}" alt="WhatsApp"></a><a href="mailto: ${CONTACT_EMAIL}"><img class="footer-icon" src="${MAIL_ICON}" alt="Mail"></a>
      </div>
    </div>

  </div>
</body>
</html>`;
}

/**
 * Genera el HTML del email a partir de un objeto Campana completo.
 */
export function generarHtmlDesdeCampana(campana: Campana): string {
  return generarHtmlEmail({
    cuerpo_html: campana.cuerpo_html,
    link_inscripcion: campana.link_inscripcion,
    flyer_url: campana.flyer_url,
  });
}

/** Escapa caracteres HTML peligrosos en URLs/textos interpolados */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
