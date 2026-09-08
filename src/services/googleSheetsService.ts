import { google } from 'googleapis';
import { config } from '../config/env.js';
import { importarContactosJson, type ContactoImportRow } from './contactoService.js';

function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

let isSyncingStatus = false;
let lastSyncResult: { success: boolean; message: string; procesados?: number; insertados_o_actualizados?: number } | null = null;

export function getSyncStatus() {
  return {
    isSyncing: isSyncingStatus,
    lastResult: lastSyncResult
  };
}

export function resetSyncStatus() {
  lastSyncResult = null;
}

export async function syncContactosFromSheets(): Promise<void> {
  if (isSyncingStatus) {
    throw new Error('Ya hay una sincronización en curso.');
  }

  isSyncingStatus = true;
  lastSyncResult = null;

  try {
    const { sheetId, clientEmail, privateKey } = config.google;

    if (!sheetId || !clientEmail || !privateKey) {
      throw new Error('Faltan configuraciones de Google Sheets en las variables de entorno (GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY).');
    }

  // Configurar autenticación de Google con JWT
  const jwtClient = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth: jwtClient });

  // Nombre de la hoja especificado por el usuario
  const sheetName = 'Mails_Normalizados';
  // Columnas: EMPRESA, CUIT, RUBRO, EMAIL, TIPO, ESTADO
  const range = `${sheetName}!A:F`; 

  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });
  } catch (error: any) {
    console.error('Error obteniendo datos de Google Sheets:', error);
    throw new Error(`Error al leer la planilla de Google Sheets: ${error.message}`);
  }

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      lastSyncResult = { success: true, message: 'La planilla está vacía.', procesados: 0, insertados_o_actualizados: 0 };
      return;
    }

    // Buscar índices de las columnas según los encabezados (primera fila)
    const headers = rows[0].map((h: string) => h.trim().toUpperCase());
    
    const empIdx = headers.indexOf('EMPRESA');
    const cuitIdx = headers.indexOf('CUIT');
    const rubroIdx = headers.indexOf('RUBRO');
    const emailIdx = headers.indexOf('EMAIL');
    const tipoIdx = headers.indexOf('TIPO');
    const estadoIdx = headers.indexOf('ESTADO');

    if (emailIdx === -1) {
      throw new Error('No se encontró la columna EMAIL en la hoja.');
    }

    const contactosParaImportar: ContactoImportRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // El valor puede ser undefined si la fila está incompleta
      const email = row[emailIdx]?.trim();
      if (!email) continue;

      const empresa = empIdx !== -1 ? row[empIdx]?.trim() : null;
      const cuit = cuitIdx !== -1 ? row[cuitIdx]?.trim() : null;
      const rubroRaw = rubroIdx !== -1 ? row[rubroIdx]?.trim() : null;
      const tipo = tipoIdx !== -1 ? row[tipoIdx]?.trim() : null;
      const estadoRaw = estadoIdx !== -1 ? row[estadoIdx]?.trim() : null;

      // Normalizar rubro para que coincida con la lista (ej: "Metalmecánica" -> "metalmecanica")
      const rubro_id = rubroRaw ? normalizeString(rubroRaw) : null;
      
      let estado = estadoRaw ? estadoRaw.trim().toLowerCase() : 'funcional';
      if (!['funcional', 'inactivo', 'rebotado'].includes(estado)) {
        estado = 'funcional';
      }

      contactosParaImportar.push({
        email,
        empresa_nombre: empresa || null,
        cuit: cuit || null,
        rubro_id,
        tipo: tipo || null,
        estado,
      });
    }

    // Reutilizamos la función de importación por lote (Upsert)
    const resultados = await importarContactosJson(contactosParaImportar);

    lastSyncResult = { 
      success: true, 
      message: `Sincronización completa. Se procesaron ${resultados.procesados} contactos.`, 
      procesados: resultados.procesados, 
      insertados_o_actualizados: resultados.insertados_o_actualizados 
    };

  } catch (err: any) {
    console.error('Error en syncContactosFromSheets:', err);
    lastSyncResult = { success: false, message: err.message || 'Error desconocido al sincronizar' };
  } finally {
    isSyncingStatus = false;
  }
}
