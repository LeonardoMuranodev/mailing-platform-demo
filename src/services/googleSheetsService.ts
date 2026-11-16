import { google } from 'googleapis';
import { config } from '../config/env.js';
import { dbPool } from '../config/db.js';
import { importarContactosJson, type ContactoImportRow } from './contactoService.js';
import { emitirAlertaRealtime } from './realtimeService.js';

function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/**
 * Convierte un índice numérico de columna (0-based) a notación de letra A1 (ej: 0->A, 5->F, 26->AA)
 */
function colIndexToA1(colIndex: number): string {
  let temp = colIndex + 1;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/**
 * Extrae y normaliza todas las direcciones de email válidas de una celda de texto.
 * Soporta separadores como pipe (|), punto y coma (;), coma (,), barra (/), saltos de línea y notas.
 */
export function splitEmails(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const matches = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (!matches) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const lower = m.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(m);
    }
  }
  return result;
}

const ESTADOS_VALIDOS = new Set([
  'funcional',
  'inactivo',
  'rebotado inexistente',
  'rebotado bandeja llena',
  'rebotado spam',
  'rebotado desconocido',
  'mal_escrito',
]);

function normalizarEstado(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const limpio = raw.trim().toLowerCase();
  if (limpio === 'rebotado') return 'rebotado desconocido';
  if (limpio === 'baja' || limpio === 'desuscripto') return 'inactivo';
  if (ESTADOS_VALIDOS.has(limpio)) return limpio;
  return null;
}

function esEstadoNegativo(estado: string | null | undefined): boolean {
  if (!estado) return false;
  return estado.startsWith('rebotado') || estado === 'inactivo' || estado === 'mal_escrito';
}

function getSheetsClient() {
  const { sheetId, clientEmail, privateKey } = config.google;

  if (!sheetId || !clientEmail || !privateKey) {
    throw new Error('Faltan configuraciones de Google Sheets en el backend.');
  }

  // Las claves privadas en variables de entorno a menudo tienen los \n escapados
  const formattedKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: formattedKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return { sheets, sheetId };
}

export interface SyncStatus {
  isSyncing: boolean;
  lastResult: {
    success: boolean;
    message: string;
    procesados?: number;
    insertados_o_actualizados?: number;
    estados_actualizados_en_sheets?: number;
  } | null;
}

let isSyncingStatus = false;
let lastSyncResult: SyncStatus['lastResult'] = null;

export function getSyncStatus(): SyncStatus {
  return {
    isSyncing: isSyncingStatus,
    lastResult: lastSyncResult,
  };
}

export function resetSyncStatus() {
  lastSyncResult = null;
}

/**
 * Sincroniza estados específicos de contactos hacia Google Sheets (Proceso Inverso).
 * Si no se especifica lista, se comparan todos los contactos de la BD contra la planilla.
 */
export async function sincronizarEstadosHaciaSheets(
  contactosParaActualizar?: Array<{ email: string; estado: string }>
): Promise<{ actualizados: number }> {
  try {
    const { sheets, sheetId } = getSheetsClient();
    const sheetName = 'Mails_Normalizados';

    // Leer encabezados y columnas de EMAIL y ESTADO
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return { actualizados: 0 };
    }

    const headers = rows[0].map((h: string) => (h ? h.trim().toUpperCase() : ''));
    const emailIdx = headers.indexOf('EMAIL');
    const estadoIdx = headers.indexOf('ESTADO');

    if (emailIdx === -1 || estadoIdx === -1) {
      console.warn('[GoogleSheets] No se encontraron las columnas EMAIL o ESTADO para sincronizar hacia Sheets.');
      return { actualizados: 0 };
    }

    const estadoColLetter = colIndexToA1(estadoIdx);

    // Mapear qué estado debe tener cada email
    const estadoPorEmail = new Map<string, string>();
    if (contactosParaActualizar && contactosParaActualizar.length > 0) {
      for (const c of contactosParaActualizar) {
        if (c.email) estadoPorEmail.set(c.email.trim().toLowerCase(), c.estado);
      }
    } else {
      // Si no se pasaron contactos específicos, cargar todos los contactos con estado de la BD
      const dbRes = await dbPool.query<{ email: string; estado: string }>('SELECT email, estado FROM contactos');
      for (const row of dbRes.rows) {
        estadoPorEmail.set(row.email.trim().toLowerCase(), row.estado);
      }
    }

    const sheetUpdates: Array<{ range: string; values: string[][] }> = [];
    const updatedRowNumbers = new Set<number>();

    // Recorrer filas de la planilla buscando coincidencias (soporta multi-email por celda)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawEmail = row[emailIdx]?.trim();
      if (!rawEmail) continue;

      const emails = splitEmails(rawEmail);
      if (emails.length === 0) continue;

      const rowNumber = i + 1;
      for (const email of emails) {
        const emailLower = email.toLowerCase();
        if (estadoPorEmail.has(emailLower)) {
          const nuevoEstado = estadoPorEmail.get(emailLower)!;
          const estadoActualSheet = row[estadoIdx]?.trim()?.toLowerCase() || '';

          // Solo actualizar si difiere y no se actualizó ya esta fila
          if (nuevoEstado.toLowerCase() !== estadoActualSheet && !updatedRowNumbers.has(rowNumber)) {
            sheetUpdates.push({
              range: `${sheetName}!${estadoColLetter}${rowNumber}`,
              values: [[nuevoEstado]],
            });
            updatedRowNumbers.add(rowNumber);
            break;
          }
        }
      }
    }

    if (sheetUpdates.length > 0) {
      // Enviar en bloques de 500 para evitar límites de tamaño de payload
      const chunkSize = 500;
      for (let c = 0; c < sheetUpdates.length; c += chunkSize) {
        const chunk = sheetUpdates.slice(c, c + chunkSize);
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: chunk,
          },
        });
      }
      console.log(`[GoogleSheets] Proceso inverso: se actualizaron ${sheetUpdates.length} estados en la planilla.`);
    }

    return { actualizados: sheetUpdates.length };
  } catch (err: any) {
    console.error('[GoogleSheets] Error en sincronizarEstadosHaciaSheets:', err?.message || err);
    return { actualizados: 0 };
  }
}

/**
 * Sincronización bidireccional completa:
 * 1. Lee Google Sheets (Mails_Normalizados).
 * 2. Soporta celdas con correos múltiples (separados por |, ;, ,, /, saltos de línea).
 * 3. Compara con la Base de Datos PostgreSQL.
 * 4. Proceso Inverso: Actualiza en Google Sheets aquellos correos que en la BD rebotaron o cambiaron de estado.
 * 5. Protege la BD: NUNCA pisa un rebote/inactivo previo con un valor vacío o "funcional" del Sheet.
 * 6. Importa novedades y actualizaciones de empresas, CUIT y rubros a la BD asegurando es_contacto_base = true.
 */
export async function syncContactosFromSheets(): Promise<void> {
  if (isSyncingStatus) {
    throw new Error('Ya hay una sincronización en curso');
  }

  isSyncingStatus = true;
  lastSyncResult = null;

  try {
    const { sheets, sheetId } = getSheetsClient();
    const sheetName = 'Mails_Normalizados';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      lastSyncResult = { success: true, message: 'La hoja está vacía o solo contiene encabezados.' };
      return;
    }

    const headers = rows[0].map((h: string) => (h ? h.trim().toUpperCase() : ''));

    const emailIdx = headers.indexOf('EMAIL');
    const empIdx = headers.indexOf('EMPRESA');
    const cuitIdx = headers.indexOf('CUIT');
    const rubroIdx = headers.indexOf('RUBRO');
    const tipoIdx = headers.indexOf('TIPO');
    const estadoIdx = headers.indexOf('ESTADO');

    if (emailIdx === -1) {
      throw new Error('No se encontró la columna EMAIL en la planilla.');
    }

    const estadoColLetter = estadoIdx !== -1 ? colIndexToA1(estadoIdx) : null;

    // Cargar todos los contactos existentes en la Base de Datos para comparación precisa
    const dbRes = await dbPool.query<{ email: string; estado: string }>(
      'SELECT email, estado FROM contactos'
    );
    const dbContactMap = new Map<string, string>();
    for (const r of dbRes.rows) {
      dbContactMap.set(r.email.trim().toLowerCase(), r.estado);
    }

    const sheetUpdates: Array<{ range: string; values: string[][] }> = [];
    const contactosParaImportar: ContactoImportRow[] = [];
    let estadosActualizadosEnSheets = 0;
    const updatedRowNumbers = new Set<number>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawEmailCell = row[emailIdx]?.trim();
      if (!rawEmailCell) continue;

      const emails = splitEmails(rawEmailCell);
      if (emails.length === 0) continue;

      const rowNumber = i + 1;

      const empresa = empIdx !== -1 ? row[empIdx]?.trim() : null;
      const cuit = cuitIdx !== -1 ? row[cuitIdx]?.trim() : null;
      const rubroRaw = rubroIdx !== -1 ? row[rubroIdx]?.trim() : null;
      const tipo = tipoIdx !== -1 ? row[tipoIdx]?.trim() : null;
      const estadoRaw = estadoIdx !== -1 ? row[estadoIdx]?.trim() : null;

      const rubro_id = rubroRaw ? normalizeString(rubroRaw) : null;
      const estadoSheetNormalizado = normalizarEstado(estadoRaw);

      for (const email of emails) {
        const emailLower = email.toLowerCase();
        const estadoEnDb = dbContactMap.get(emailLower);

        if (estadoEnDb) {
          // CASO 1: El contacto ya existe en la Base de Datos
          if (esEstadoNegativo(estadoEnDb) && (!estadoSheetNormalizado || estadoSheetNormalizado === 'funcional')) {
            // PROCESO INVERSO: En la BD rebotó o está inactivo, pero en el Sheet no figura
            // -> Programar actualización del Sheet para que refleje la realidad
            if (estadoColLetter && !updatedRowNumbers.has(rowNumber)) {
              sheetUpdates.push({
                range: `${sheetName}!${estadoColLetter}${rowNumber}`,
                values: [[estadoEnDb]],
              });
              updatedRowNumbers.add(rowNumber);
              estadosActualizadosEnSheets++;
            }
            // -> En la importación, PRESERVAR el estado de la BD (no revivirlo a funcional)
            contactosParaImportar.push({
              email,
              empresa_nombre: empresa || null,
              cuit: cuit || null,
              rubro_id,
              tipo: tipo || null,
              estado: estadoEnDb,
              es_contacto_base: true,
            });
          } else if (estadoSheetNormalizado && estadoSheetNormalizado !== estadoEnDb) {
            // El Sheet tiene un estado explícito válido diferente a la BD (ej. alguien lo desactivó manualmente en el Sheet)
            contactosParaImportar.push({
              email,
              empresa_nombre: empresa || null,
              cuit: cuit || null,
              rubro_id,
              tipo: tipo || null,
              estado: estadoSheetNormalizado,
              es_contacto_base: true,
            });
          } else {
            // Los estados coinciden o no hay discrepancia negativa: actualizar metadatos preservando estado de BD
            contactosParaImportar.push({
              email,
              empresa_nombre: empresa || null,
              cuit: cuit || null,
              rubro_id,
              tipo: tipo || null,
              estado: estadoEnDb,
              es_contacto_base: true,
            });
          }
        } else {
          // CASO 2: Contacto nuevo (está en el Sheet pero aún no en la BD)
          const estadoFinal = estadoSheetNormalizado || 'funcional';

          if (!estadoRaw && estadoColLetter && !updatedRowNumbers.has(rowNumber)) {
            // Si la celda de estado en el Sheet estaba vacía, escribir 'funcional' para que quede documentado
            sheetUpdates.push({
              range: `${sheetName}!${estadoColLetter}${rowNumber}`,
              values: [['funcional']],
            });
            updatedRowNumbers.add(rowNumber);
            estadosActualizadosEnSheets++;
          }

          contactosParaImportar.push({
            email,
            empresa_nombre: empresa || null,
            cuit: cuit || null,
            rubro_id,
            tipo: tipo || null,
            estado: estadoFinal,
            es_contacto_base: true,
          });
        }
      }
    }

    // 1. Ejecutar actualizaciones hacia Google Sheets (Proceso Inverso)
    if (sheetUpdates.length > 0) {
      const chunkSize = 500;
      for (let c = 0; c < sheetUpdates.length; c += chunkSize) {
        const chunk = sheetUpdates.slice(c, c + chunkSize);
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: chunk,
          },
        });
      }
      console.log(`[GoogleSheets] Sincronización hacia Sheet: ${sheetUpdates.length} celdas de estado actualizadas.`);
    }

    // 2. Importar o actualizar contactos en la Base de Datos
    const resultados = await importarContactosJson(contactosParaImportar);

    const omitidosText = resultados.omitidos > 0 ? ` Se omitieron ${resultados.omitidos} filas por errores.` : '';
    const sheetText = estadosActualizadosEnSheets > 0 ? ` Se pasaron ${estadosActualizadosEnSheets} estados actualizados a Google Sheets.` : '';

    lastSyncResult = {
      success: true,
      message: `Sincronización bidireccional completa. Se procesaron ${resultados.procesados} contactos.${sheetText}${omitidosText}`,
      procesados: resultados.procesados,
      insertados_o_actualizados: resultados.insertados_o_actualizados,
      estados_actualizados_en_sheets: estadosActualizadosEnSheets,
    };
  } catch (err: any) {
    console.error('Error en syncContactosFromSheets:', err);
    let msg = 'Error al leer la planilla de Google Sheets';
    if (err?.message) {
      if (err.message.includes('No se encontró la columna EMAIL')) {
        msg = 'No se encontró la columna EMAIL en la hoja de Google Sheets.';
      } else if (err.message.includes('Faltan configuraciones de Google Sheets')) {
        msg = 'Faltan configuraciones de Google Sheets en el servidor.';
      } else if (!err.message.includes('DECODER') && !err.message.includes('error:')) {
        msg = err.message;
      }
    }
    lastSyncResult = { success: false, message: msg };
  } finally {
    isSyncingStatus = false;

    if (lastSyncResult) {
      const exito = lastSyncResult.success;
      emitirAlertaRealtime({
        tipo: 'sync_finished',
        titulo: exito ? 'Sincronización finalizada' : 'Error en sincronización',
        mensaje: lastSyncResult.message,
        detalles: {
          procesados: lastSyncResult.procesados,
          insertados_o_actualizados: lastSyncResult.insertados_o_actualizados,
          estados_actualizados_en_sheets: lastSyncResult.estados_actualizados_en_sheets,
          exito,
        },
        urlDestino: '/contactos',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/**
 * Ejecución periódica para cron en segundo plano.
 * No arroja excepciones no controladas si faltan variables o si ya hay una sync en curso.
 */
export async function syncContactosFromSheetsCron(): Promise<void> {
  const { sheetId, clientEmail, privateKey } = config.google;
  if (!sheetId || !clientEmail || !privateKey) {
    return;
  }
  if (isSyncingStatus) {
    console.log('[Sheets Cron] Sincronización omitida: ya hay una en curso.');
    return;
  }
  console.log('[Sheets Cron] Iniciando sincronización automática periódica con Google Sheets...');
  try {
    await syncContactosFromSheets();
    console.log('[Sheets Cron] Sincronización automática finalizada exitosamente.');
  } catch (err: any) {
    console.error('[Sheets Cron] Error en sincronización automática:', err?.message || err);
  }
}
