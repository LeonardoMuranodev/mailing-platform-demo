import nodemailer from 'nodemailer';
import { dbPool } from '../config/db.js';
import { obtenerSiguienteSmtpDisponible, incrementarCuotaSmtp } from './queueService.js';
import { notificarCampanaTerminada, notificarCuotaGlobalAgotada } from './notificationService.js';
import { generarHtmlDesdeCampana } from './emailTemplate.js';
import { decrypt } from '../utils/encryption.js';
import type { Campana } from '../types/campana.js';

let isWorkerRunning = false;
let cuotaAgotadaHoy = false;
let fechaAgotamiento = '';

const EJECUCIONES_DIARIAS = 9;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function procesarCola(): Promise<void> {
  if (isWorkerRunning) return;

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
      WHERE c.estado = 'en_proceso'
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

      if (campana.fecha_limite_envio) {
        const fechaEvento = new Date(campana.fecha_limite_envio);
        if (!isNaN(fechaEvento.getTime())) {
          const hoyDate = new Date();
          const diffTiempo = fechaEvento.getTime() - hoyDate.getTime();
          const diasRestantes = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));
          const diasEfectivos = diasRestantes <= 0 ? 1 : diasRestantes;

          objetivoGlobalHora = Math.ceil(totalPendientes / (diasEfectivos * EJECUCIONES_DIARIAS));
        }
      }
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
             c.asunto, c.cuerpo_html, c.link_inscripcion, c.flyer_url, c.estado as campana_estado,
             ce.intentos
      FROM cola_envios ce
      JOIN contactos co ON ce.contacto_id = co.id
      JOIN campanas c ON ce.campana_id = c.id
      WHERE ce.estado = 'pendiente' AND c.estado = 'en_proceso'
      ORDER BY 
        CASE WHEN c.prioridad = 'alta' THEN 1 ELSE 2 END ASC,
        ce.id ASC
      LIMIT $1
      FOR UPDATE OF ce SKIP LOCKED;
    `;

    const { rows: lote } = await dbPool.query(queryPendientes, [objetivoGlobalHora]);

    if (lote.length === 0) {
      await verificarCampanasCompletadas();
      return;
    }

    // 4. Procesar el lote
    for (const item of lote) {
      // Intentar enviar con hasta `cantidadCuentas` cuentas distintas si fallan
      let enviadoExitoso = false;
      let estadoNuevo = 'fallido';
      let respuestaSmtp = '';
      let cuentaIdUsada = null;
      let nuevosIntentos = item.intentos + 1;
      let intentosCirculares = 0;

      while (intentosCirculares < Math.max(1, cantidadCuentas) && !enviadoExitoso) {
        const cuentaSmtp = await obtenerSiguienteSmtpDisponible();
        
        if (!cuentaSmtp) {
          console.warn('Worker SMTP: No hay cuentas SMTP con cuota disponible en absoluto.');
          cuotaAgotadaHoy = true;
          fechaAgotamiento = hoy;
          await notificarCuotaGlobalAgotada();
          break; // Salir del while de reintentos
        }

        cuentaIdUsada = cuentaSmtp.id;

        const campanaMock: Campana = {
          id: item.campana_id,
          asunto: item.asunto,
          cuerpo_html: item.cuerpo_html,
          link_inscripcion: item.link_inscripcion,
          flyer_url: item.flyer_url,
          estado: item.campana_estado,
          fecha_limite_envio: '',
          prioridad: 'media',
          para_todos_rubros: true,
          rubros_seleccionados: [],
          creado_en: '',
          actualizado_en: ''
        };

        const html = generarHtmlDesdeCampana(campanaMock);
        const pass = decrypt(cuentaSmtp.password_encrypted);

        const transporter = nodemailer.createTransport({
          host: cuentaSmtp.host,
          port: cuentaSmtp.puerto,
          secure: cuentaSmtp.puerto === 465,
          auth: {
            user: cuentaSmtp.usuario,
            pass,
          },
        });

        try {
          const info = await transporter.sendMail({
            from: `"Dirección de Producción - 3F" <${cuentaSmtp.email}>`,
            to: item.contacto_email,
            subject: item.asunto,
            html,
          });
          
          respuestaSmtp = info.response;
          estadoNuevo = 'enviado';
          enviadoExitoso = true;
          
          await incrementarCuotaSmtp(cuentaSmtp.id);

          // Sleep Anti-Spam entre envíos exitosos
          await sleep(5000);

        } catch (err: any) {
          respuestaSmtp = err.message || 'Error desconocido';
          console.error(`Error enviando correo a ${item.contacto_email} con ${cuentaSmtp.email}:`, respuestaSmtp);
          
          const lowerMsg = respuestaSmtp.toLowerCase();
          const cuotaAgotadaMsg = lowerMsg.includes('quota exceeded') || 
                                  lowerMsg.includes('rate limit') || 
                                  lowerMsg.includes('daily sending limit');
                                  
          if (cuotaAgotadaMsg) {
            // Forzar actualización de estado a agotado para esta cuenta para que obtenerSiguienteSmtpDisponible no la devuelva
            await dbPool.query(`UPDATE cuentas_smtp SET estado = 'agotado', actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`, [cuentaSmtp.id]);
          }

          intentosCirculares++;
        }
      } // fin while intentosCirculares

      if (!enviadoExitoso) {
        if (cuotaAgotadaHoy) {
           estadoNuevo = 'pendiente'; // Devolver a la cola intacto si se agotó la cuota global, se procesará mañana
        } else if (nuevosIntentos < 3) {
           estadoNuevo = 'pendiente';
        } else {
           estadoNuevo = 'fallido';
        }
      }

      await dbPool.query(`
        UPDATE cola_envios
        SET estado = $1, respuesta_smtp = $2, fecha_envio = CURRENT_TIMESTAMP, 
            cuenta_smtp_id = $3, intentos = $4
        WHERE id = $5
      `, [estadoNuevo, respuestaSmtp, cuentaIdUsada, nuevosIntentos, item.id]);

      // Si se agotó la cuota global durante el procesamiento de un correo, detenemos el procesamiento del lote
      if (cuotaAgotadaHoy) {
        break;
      }
    }

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
    WHERE c.estado = 'en_proceso'
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
  }
}
