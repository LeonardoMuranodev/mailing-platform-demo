import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { dbPool } from '../config/db.js';
import { obtenerSiguienteSmtpDisponible, incrementarCuotaSmtp } from './queueService.js';
import { notificarCampanaTerminada, notificarCuotaGlobalAgotada } from './notificationService.js';
import { emitirAlertaRealtime } from './realtimeService.js';
import { generarHtmlDesdeCampana } from './emailTemplate.js';
import { limpiarHistorialAntiguo } from './historialService.js';
import { decrypt } from '../utils/encryption.js';
import { config } from '../config/env.js';
import type { Campana } from '../types/campana.js';
import { calcularObjetivoHora } from './dosificadorService.js';
import {
  obtenerDemoraAleatoria,
  obtenerDemoraError,
  generarMessageId,
  inyectarEntropiaHtml,
} from './antispamService.js';
import { esCuentaOAuth, enviarConGmailApi } from './gmailApiService.js';
import crypto from 'node:crypto';

let isWorkerRunning = false;
let cuotaAgotadaHoy = false;
let fechaAgotamiento = '';

const EJECUCIONES_DIARIAS = 9;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function verificarHorarioPermitido(): Promise<boolean> {
  const { rows: config } = await dbPool.query('SELECT * FROM configuracion_horarios WHERE id = 1');
  if (config.length === 0) return true; // Si no hay config, permite (fallback)
  
  const { hora_inicio, hora_fin, dias_permitidos } = config[0];
  
  // Date in Buenos Aires timezone
  const now = new Date();
  const bsasTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  
  const currentDay = bsasTime.getDay() === 0 ? 7 : bsasTime.getDay(); // 1=Lunes, 7=Domingo
  if (!dias_permitidos.includes(currentDay)) {
    return false;
  }
  
  const currentTime = bsasTime.getHours().toString().padStart(2, '0') + ':' + bsasTime.getMinutes().toString().padStart(2, '0');
  if (currentTime < hora_inicio || currentTime > hora_fin) {
    return false;
  }

  const hoyStr = bsasTime.getFullYear() + '-' + String(bsasTime.getMonth() + 1).padStart(2, '0') + '-' + String(bsasTime.getDate()).padStart(2, '0');
  const { rows: feriados } = await dbPool.query('SELECT 1 FROM fechas_excluidas WHERE fecha = $1', [hoyStr]);
  if (feriados.length > 0) {
    return false;
  }

  return true;
}

export async function procesarCola(esForzado: boolean = false): Promise<void> {
  if (isWorkerRunning) return;

  try {
    if (!esForzado) {
      const permitido = await verificarHorarioPermitido();
      if (!permitido) {
        console.log('Worker SMTP: Ejecución omitida. Fuera del horario permitido o día excluido.');
        return;
      }
    } else {
      console.log('Worker SMTP: Ejecución forzada manual. Ignorando restricciones de horario.');
    }
  } catch (error) {
    console.error('Error al verificar horario permitido, procediendo con precaución:', error);
  }

  // Verificar si la cuota global del día está agotada
  const hoy = new Date().toISOString().split('T')[0];
  if (cuotaAgotadaHoy && fechaAgotamiento === hoy) {
    console.log('Worker SMTP: Ejecución omitida. Cuota global agotada para hoy.');
    return;
  }
  if (fechaAgotamiento !== hoy) {
    // Reset diario
    cuotaAgotadaHoy = false;
    fechaAgotamiento = '';
    
    // Mantenimiento diario: limpiar historial más antiguo de 1 año
    limpiarHistorialAntiguo().catch(err => console.error('Error limpiando historial:', err));
  }

  isWorkerRunning = true;

  try {
    // 1. Obtener cantidad de cuentas activas y límites globales
    const { rows: cuentasActivas } = await dbPool.query(`
      SELECT 
        count(*) as count, 
        sum(minimo_por_ejecucion) as min_total, 
        sum(maximo_por_ejecucion) as max_total 
      FROM cuentas_smtp WHERE estado = 'activo'
    `);
    const cantidadCuentas = Number(cuentasActivas[0].count) || 1;
    const minGlobalPorHora = Number(cuentasActivas[0].min_total) || 5;
    const maxGlobalPorHora = Number(cuentasActivas[0].max_total) || 25;

    // 2. Obtener la campaña más prioritaria para calcular dosificación dinámica
    const { rows: campanas } = await dbPool.query(`
      SELECT c.*, 
             (SELECT count(*) FROM cola_envios ce WHERE ce.campana_id = c.id AND ce.estado = 'pendiente') as pendientes
      FROM campanas c
      WHERE c.estado IN ('en_proceso', 'aprobada')
        AND c.eliminado_en IS NULL
        AND EXISTS (SELECT 1 FROM cola_envios ce WHERE ce.campana_id = c.id AND ce.estado = 'pendiente')
      ORDER BY c.prioridad ASC, c.creado_en ASC
      LIMIT 1
    `);

    let objetivoGlobalHora = minGlobalPorHora;

    if (campanas.length > 0) {
      const campana = campanas[0];
      const totalPendientes = Number(campana.pendientes);
      
      if (totalPendientes === 0) {
        await verificarCampanasCompletadas();
        return; // Nada que hacer
      }

      // Consultar configuración de horarios y fechas excluidas para el cálculo operativo
      const { rows: cfgRows } = await dbPool.query('SELECT hora_inicio, hora_fin, dias_permitidos FROM configuracion_horarios WHERE id = 1');
      const cfg = cfgRows[0] || {};
      const { rows: excluidasRows } = await dbPool.query('SELECT fecha FROM fechas_excluidas');
      const fechasExcluidas = excluidasRows.map((r: { fecha: string | Date }) => {
        if (typeof r.fecha === 'string') return r.fecha.split('T')[0];
        return r.fecha.toISOString().split('T')[0];
      });

      const dosificador = calcularObjetivoHora({
        totalPendientes,
        fechaLimite: campana.fecha_limite_envio,
        fechaActual: new Date(),
        diasPermitidos: cfg.dias_permitidos || [1, 2, 3, 4, 5],
        fechasExcluidas,
        horaInicio: cfg.hora_inicio || '09:00',
        horaFin: cfg.hora_fin || '17:00',
        minGlobalPorHora,
        maxGlobalPorHora,
      });

      objetivoGlobalHora = dosificador.objetivoHora;

      console.log(`Worker SMTP: Dosificador calculado: ${objetivoGlobalHora}/hora (pendientes: ${totalPendientes}, días operativos: ${dosificador.diasOperativos}, ejecuciones diarias: ${dosificador.ejecucionesDiarias}, ejecuciones totales: ${dosificador.ejecucionesTotales}, teórico: ${dosificador.calculoTeorico})`);
    } else {
      await verificarCampanasCompletadas();
      return;
    }

    // Limitar el objetivo entre MIN y MAX global
    if (objetivoGlobalHora < minGlobalPorHora) objetivoGlobalHora = minGlobalPorHora;
    if (objetivoGlobalHora > maxGlobalPorHora) objetivoGlobalHora = maxGlobalPorHora;

    console.log(`Worker SMTP: Objetivo global por hora calculado: ${objetivoGlobalHora}`);

    // 3. Obtener el lote con el objetivo calculado usando FOR UPDATE SKIP LOCKED
    const queryPendientes = `
      SELECT ce.id, ce.contacto_id, ce.campana_id, co.email as contacto_email,
             c.asunto, c.cuerpo_html, c.link_inscripcion, c.link_nacion, c.link_provincia, c.flyer_url, c.adjunto_url, c.adjuntos_extras, c.estado as campana_estado,
             ce.intentos
      FROM cola_envios ce
      JOIN contactos co ON ce.contacto_id = co.id
      JOIN campanas c ON ce.campana_id = c.id
      WHERE ce.estado = 'pendiente' AND c.estado IN ('en_proceso', 'aprobada')
      ORDER BY 
        CASE WHEN c.prioridad = 'alta' THEN 1 ELSE 2 END ASC,
        c.fecha_limite_envio ASC NULLS LAST,
        ce.id ASC
      LIMIT $1
      FOR UPDATE OF ce SKIP LOCKED;
    `;

    const { rows: lote } = await dbPool.query(queryPendientes, [objetivoGlobalHora]);

    if (lote.length === 0) {
      await verificarCampanasCompletadas();
      return;
    }

    const campanasTransicionadas = new Set<string>();
    let indiceLote = 0;

    // 4. Procesar el lote
    for (const item of lote) {
      indiceLote++;
      // Si la campaña estaba en "aprobada", la pasamos a "en_proceso" al enviar el primer mail
      if (item.campana_estado === 'aprobada' && !campanasTransicionadas.has(item.campana_id)) {
        await dbPool.query(`UPDATE campanas SET estado = 'en_proceso', actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`, [item.campana_id]);
        campanasTransicionadas.add(item.campana_id);

        emitirAlertaRealtime({
          tipo: 'campaign_started',
          titulo: 'Campaña iniciada',
          mensaje: `El despacho de "${item.asunto}" ha comenzado.`,
          detalles: { campanaId: item.campana_id, asunto: item.asunto },
          urlDestino: `/campanas/${item.campana_id}`,
          timestamp: new Date().toISOString(),
        });
      }

      // Intentar enviar con hasta `cantidadCuentas` cuentas distintas si fallan
      let enviadoExitoso = false;
      let estadoNuevo = 'fallido';
      let respuestaSmtp = '';
      let cuentaIdUsada = null;
      let nuevosIntentos = item.intentos;
      let intentosCirculares = 0;
      let huboFalloEmisor = false;
      let proveedorMessageId: string | null = null;

      while (intentosCirculares < Math.max(1, cantidadCuentas) && !enviadoExitoso) {
        const cuentaSmtp = await obtenerSiguienteSmtpDisponible();
        
        if (!cuentaSmtp) {
          console.warn('Worker SMTP: No hay cuentas SMTP con cuota disponible en absoluto.');
          cuotaAgotadaHoy = true;
          fechaAgotamiento = hoy;
          await notificarCuotaGlobalAgotada();

          emitirAlertaRealtime({
            tipo: 'smtp_quota_warning',
            titulo: 'Límite de cuota diaria alcanzado',
            mensaje: 'Todas las cuentas SMTP alcanzaron su límite de hoy. Los envíos se reanudarán mañana a las 09:00.',
            timestamp: new Date().toISOString(),
          });
          break; // Salir del while de reintentos
        }

        cuentaIdUsada = cuentaSmtp.id;

        const trackBase = config.publicApiUrl || 'http://localhost:3000';
        
        // Determinar flyer para template y attachments
        const attachments: any[] = [];
        let flyerParaTemplate = item.flyer_url;

        if (item.flyer_url) {
          const cleanFlyerPath = item.flyer_url.startsWith('/') ? item.flyer_url.slice(1) : item.flyer_url;
          const localFlyerPath = path.resolve(process.cwd(), cleanFlyerPath);
          if (fs.existsSync(localFlyerPath)) {
            attachments.push({
              filename: path.basename(item.flyer_url),
              path: localFlyerPath,
              cid: 'flyer_campana',
              contentDisposition: 'inline'
            });
            // Al asignar 'cid:flyer_campana', el template genera <img src="cid:flyer_campana">
            // y la imagen viaja incrustada dentro del mensaje MIME
            flyerParaTemplate = 'cid:flyer_campana';
          } else if (item.flyer_url.startsWith('/uploads/')) {
            flyerParaTemplate = `${trackBase}${item.flyer_url}`;
          }
        }

        const campanaMock: Campana = {
          id: item.campana_id,
          asunto: item.asunto,
          cuerpo_html: item.cuerpo_html,
          link_inscripcion: item.link_inscripcion,
          link_nacion: item.link_nacion,
          link_provincia: item.link_provincia,
          flyer_url: flyerParaTemplate,
          adjunto_url: null,
          adjunto_nombre_original: null,
          adjuntos_extras: item.adjuntos_extras || null,
          estado: item.campana_estado,
          fecha_limite_envio: '',
          prioridad: 'media',
          para_todos_rubros: true,
          rubros_seleccionados: [],
          creado_en: '',
          actualizado_en: ''
        };

        let html = generarHtmlDesdeCampana(campanaMock);
        
        // ── TRACKING INJECTION ──
        
        // 1. Reemplazar enlaces para Click Tracking (solo http/https)
        html = html.replace(/<a\s+(?:[^>]*?\s+)?href=["'](https?:\/\/[^"']+)["']/gi, (match, url) => {
          const encoded = encodeURIComponent(url);
          return match.replace(url, `${trackBase}/api/track/click/${item.id}?url=${encoded}`);
        });

        // 2. Open Tracking Pixel (antes de </body> o al final)
        const pixelHtml = `<img src="${trackBase}/api/track/open/${item.id}" width="1" height="1" style="display:none;max-height:0px;max-width:0px;opacity:0;overflow:hidden;" alt="" />`;
        
        // 3. Variabilidad Anti-Spam (comentario HTML para no contaminar el snippet/preheader en Gmail/Outlook)
        const hashHtml = `<!-- Ref: ${item.id}-${Date.now().toString(36)} -->`;

        if (html.includes('</body>')) {
          html = html.replace('</body>', `${pixelHtml}\n${hashHtml}\n</body>`);
        } else {
          html += `\n${pixelHtml}\n${hashHtml}`;
        }
        // ────────────────────────
        let transporter: nodemailer.Transporter | null = null;
        if (!esCuentaOAuth(cuentaSmtp.email)) {
          const pass = decrypt(cuentaSmtp.password_encrypted);
          transporter = nodemailer.createTransport({
            host: cuentaSmtp.host,
            port: cuentaSmtp.puerto,
            secure: cuentaSmtp.puerto === 465,
            auth: {
              user: cuentaSmtp.usuario,
              pass,
            },
          });
        }

        try {
          let mailHtml = html;

          if (item.adjunto_url) {
            const filename = item.adjunto_nombre_original || item.adjunto_url.split('/').pop() || 'adjunto';
            const cleanAdjuntoPath = item.adjunto_url.startsWith('/') ? item.adjunto_url.slice(1) : item.adjunto_url;
            const filepath = path.resolve(process.cwd(), cleanAdjuntoPath);
            if (fs.existsSync(filepath)) {
              attachments.push({
                filename,
                path: filepath
              });
            }
          }

          // Adjuntos extras (múltiples): iterar sobre el array JSONB
          const adjuntosExtras: Array<{ url: string; nombre_original: string }> = item.adjuntos_extras || [];
          for (const adj of adjuntosExtras) {
            // Saltear si ya fue cargado como adjunto_url (retrocompatibilidad sin duplicar)
            if (adj.url === item.adjunto_url) continue;
            const cleanPath = adj.url.startsWith('/') ? adj.url.slice(1) : adj.url;
            const adjFilepath = path.resolve(process.cwd(), cleanPath);
            if (fs.existsSync(adjFilepath)) {
              attachments.push({
                filename: adj.nombre_original,
                path: adjFilepath
              });
            }
          }

          const mailOptions: any = {
            from: `"${process.env.SENDER_NAME || 'Equipo de Envíos'}" <${cuentaSmtp.email}>`,
            replyTo: process.env.REPLY_TO_EMAIL || cuentaSmtp.email,
            to: item.contacto_email,
            subject: item.asunto,
            html: inyectarEntropiaHtml(mailHtml, item.id),
            messageId: generarMessageId(cuentaSmtp.email),
            attachments,
            headers: {
              'X-Entity-Ref-ID': item.id.toString(),
            }
          };

          if (esCuentaOAuth(cuentaSmtp.email)) {
            const apiResult = await enviarConGmailApi(mailOptions);
            respuestaSmtp = apiResult.response;
            proveedorMessageId = apiResult.messageId || null;
          } else {
            const info = await transporter!.sendMail(mailOptions);
            respuestaSmtp = info.response;
            if (info.messageId) {
              proveedorMessageId = info.messageId.replace(/[<>]/g, '').trim();
            }
          }
          
          estadoNuevo = 'enviado';
          enviadoExitoso = true;
          nuevosIntentos = item.intentos + 1;
          
          await incrementarCuotaSmtp(cuentaSmtp.id);

          // Cadencia Anti-Spam: Delay aleatorio no lineal con micro-pausas humanas
          const demora = obtenerDemoraAleatoria(esForzado, indiceLote);
          console.log(`[ANTI-SPAM] ${demora.descripcion} (destinatario: ${item.contacto_email}, emisor: ${cuentaSmtp.email})`);
          await sleep(demora.ms);

        } catch (err: any) {
          respuestaSmtp = err.message || 'Error desconocido';
          console.error(`Error enviando correo a ${item.contacto_email} con ${cuentaSmtp.email}:`, respuestaSmtp);

          // Cooldown de seguridad ante error de transporte para no congestionar el canal SMTP
          const demoraErr = obtenerDemoraError();
          console.warn(`[ANTI-SPAM] Cooldown por error de transporte (${(demoraErr / 1000).toFixed(1)}s): ${respuestaSmtp}`);
          await sleep(demoraErr);
          
          const lowerMsg = respuestaSmtp.toLowerCase();
          const errCode = ((err.code || '') + '').toUpperCase();
          const responseCode = err.responseCode || err.status || err.code;

          // Detección de Bloqueo / Verificación web / Fallo de credenciales en Google SMTP o OAuth
          const esBloqueoOVerificacion =
            errCode === 'EAUTH' ||
            responseCode === 535 ||
            responseCode === 534 ||
            responseCode === 401 ||
            lowerMsg.includes('invalid_grant') ||
            lowerMsg.includes('invalid_client') ||
            lowerMsg.includes('unauthorized') ||
            lowerMsg.includes('username and password not accepted') ||
            lowerMsg.includes('please log in with your web browser') ||
            lowerMsg.includes('web login required') ||
            lowerMsg.includes('application-specific password required') ||
            lowerMsg.includes('invalid login') ||
            lowerMsg.includes('badcredentials') ||
            lowerMsg.includes('checkpoint') ||
            lowerMsg.includes('challenge') ||
            lowerMsg.includes('suspicious activity') ||
            lowerMsg.includes('account suspended') ||
            lowerMsg.includes('less secure app') ||
            lowerMsg.includes('5.7.8') ||
            lowerMsg.includes('5.7.9');

          const cuotaAgotadaMsg = 
            lowerMsg.includes('quota exceeded') || 
            lowerMsg.includes('rate limit') || 
            lowerMsg.includes('user rate limit') || 
            lowerMsg.includes('daily sending limit') ||
            responseCode === 429;
                                  
          const malEscritoMsg = 
            lowerMsg.includes('555 5.5.2') || 
            lowerMsg.includes('555-5.5.2') || 
            lowerMsg.includes('syntax error');
          
          if (esBloqueoOVerificacion) {
            huboFalloEmisor = true;
            console.warn(`[CIRCUIT BREAKER] Cuenta ${cuentaSmtp.email} BLOQUEADA por Google (requiere verificación o falló login). Desactivando cuenta...`);
            
            // 1. Desactivar la cuenta para que obtenerSiguienteSmtpDisponible() no la use más
            await dbPool.query(`UPDATE cuentas_smtp SET estado = 'bloqueado', actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`, [cuentaSmtp.id]);
            await dbPool.query(`INSERT INTO smtp_logs (cuenta_smtp_id, tipo, mensaje) VALUES ($1, 'bloqueada', $2)`, [cuentaSmtp.id, respuestaSmtp]);
            
            // 2. Notificar por Telegram al desarrollador con el detalle del bloqueo
            const { notificarCuentaProblema } = await import('./notificationService.js');
            await notificarCuentaProblema(
              cuentaSmtp.email, 
              'bloqueada', 
              `Google solicitó verificación web o rechazó autenticación (EAUTH/535).\nLa cuenta fue DESACTIVADA para evitar fallos.\nDetalle: ${respuestaSmtp}`
            );

            // 3. NO penalizar al contacto: este envío se saltea y se reintenta con la siguiente cuenta en la próxima vuelta del bucle
          } else if (cuotaAgotadaMsg) {
            huboFalloEmisor = true;
            await dbPool.query(`UPDATE cuentas_smtp SET estado = 'agotado', actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`, [cuentaSmtp.id]);
            await dbPool.query(`INSERT INTO smtp_logs (cuenta_smtp_id, tipo, mensaje) VALUES ($1, 'agotada', $2)`, [cuentaSmtp.id, respuestaSmtp]);
            const { notificarCuentaProblema } = await import('./notificationService.js');
            await notificarCuentaProblema(cuentaSmtp.email, 'agotada', respuestaSmtp);
          } else if (malEscritoMsg) {
            respuestaSmtp = `[MAIL_MAL_ESCRITO] ${respuestaSmtp}`;
            await dbPool.query(`UPDATE contactos SET estado = 'mal_escrito' WHERE id = $1`, [item.contacto_id]);
            nuevosIntentos = item.intentos + 1;
            break; // Dirección con error de sintaxis, no reintentar con otra cuenta
          } else {
            // Error atribuible al destinatario o servidor receptor (ej. buzón lleno, host inalcanzable)
            nuevosIntentos = item.intentos + 1;
            await dbPool.query(`UPDATE cuentas_smtp SET ultimo_uso = CURRENT_TIMESTAMP WHERE id = $1`, [cuentaSmtp.id]);
          }
        } finally {
          if (transporter) {
            transporter.close();
          }
        }

        intentosCirculares++;
      } // fin while intentosCirculares

      if (!enviadoExitoso) {
        if (cuotaAgotadaHoy || huboFalloEmisor) {
          // Si el fallo fue porque se agotaron o bloquearon las cuentas emisoras,
          // preservamos el estado en 'pendiente' para no marcar falsamente al contacto como fallido
          estadoNuevo = 'pendiente';
        } else if (nuevosIntentos < 3) {
          estadoNuevo = 'pendiente';
        } else {
          estadoNuevo = 'fallido';
        }
      }


      await dbPool.query(`
        UPDATE cola_envios
        SET estado = $1, respuesta_smtp = $2, fecha_envio = CURRENT_TIMESTAMP, 
            cuenta_smtp_id = $3, intentos = $4, proveedor_message_id = COALESCE($5, proveedor_message_id)
        WHERE id = $6
      `, [estadoNuevo, respuestaSmtp, cuentaIdUsada, nuevosIntentos, proveedorMessageId, item.id]);

      // Si se agotó la cuota global durante el procesamiento de un correo, detenemos el procesamiento del lote
      if (cuotaAgotadaHoy) {
        break;
      }
    }

    // 5. Verificar completadas una vez finalizado el lote
    await verificarCampanasCompletadas();

  } catch (error) {
    console.error('Error en procesarCola:', error);
  } finally {
    isWorkerRunning = false;
  }
}

/**
 * Verifica si hay campañas en estado 'en_proceso' que ya no tienen pendientes ni procesando.
 * Si las hay, las pasa a 'completada' y envía notificación.
 */
async function verificarCampanasCompletadas() {
  const query = `
    SELECT c.id, c.asunto
    FROM campanas c
    WHERE c.estado IN ('en_proceso', 'aprobada')
      AND EXISTS (
        SELECT 1 FROM cola_envios ce WHERE ce.campana_id = c.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM cola_envios ce 
        WHERE ce.campana_id = c.id AND ce.estado = 'pendiente'
      );
  `;

  const { rows } = await dbPool.query(query);

  for (const campana of rows) {
    await dbPool.query(`UPDATE campanas SET estado = 'completada', actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`, [campana.id]);

    const { rows: statsRows } = await dbPool.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE estado = 'enviado')::int as enviados,
        COUNT(*) FILTER (WHERE estado = 'fallido')::int as fallidos
      FROM cola_envios 
      WHERE campana_id = $1
    `, [campana.id]);

    const stats = statsRows[0] || { total: 0, enviados: 0, fallidos: 0 };
    await notificarCampanaTerminada(campana.id, campana.asunto, stats);

    emitirAlertaRealtime({
      tipo: 'campaign_finished',
      titulo: 'Campaña completada',
      mensaje: `"${campana.asunto}" finalizó con éxito (${stats.enviados} enviados${stats.fallidos > 0 ? `, ${stats.fallidos} fallidos` : ''}).`,
      detalles: {
        campanaId: campana.id,
        asunto: campana.asunto,
        stats,
      },
      urlDestino: `/campanas/${campana.id}`,
      timestamp: new Date().toISOString(),
    });
  }
}
