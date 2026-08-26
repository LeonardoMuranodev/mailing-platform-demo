import type { Request, Response, NextFunction } from 'express';
import dns from 'node:dns/promises';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

export async function verificarDns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dominio = String(req.params.dominio);

    if (!req.params.dominio) {
      sendError(res, 'BAD_REQUEST', 'Debe especificar un dominio', 400);
      return;
    }

    const resultados = {
      dominio,
      mx: false,
      spf: false,
      dmarc: false,
      registros: {
        mx: [] as any[],
        txt: [] as string[],
      }
    };

    try {
      const mxRecords = await dns.resolveMx(dominio);
      resultados.mx = mxRecords.length > 0;
      resultados.registros.mx = mxRecords;
    } catch (err: any) {
      if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') {
        console.error(`Error resolviendo MX para ${dominio}:`, err);
      }
    }

    try {
      const txtRecords = await dns.resolveTxt(dominio);
      const flatTxtRecords = txtRecords.map(r => r.join(''));
      resultados.registros.txt = flatTxtRecords;
      
      resultados.spf = flatTxtRecords.some(r => r.startsWith('v=spf1'));
    } catch (err: any) {
      if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') {
        console.error(`Error resolviendo TXT para ${dominio}:`, err);
      }
    }

    try {
      const dmarcRecords = await dns.resolveTxt(`_dmarc.${dominio}`);
      const flatDmarcRecords = dmarcRecords.map(r => r.join(''));
      resultados.dmarc = flatDmarcRecords.some(r => r.startsWith('v=DMARC1'));
    } catch (err: any) {
      if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') {
        console.error(`Error resolviendo DMARC para _dmarc.${dominio}:`, err);
      }
    }

    sendSuccess(res, resultados);
  } catch (err) {
    next(err);
  }
}
