import { Router } from 'express';
import { verificarDns } from '../controllers/dnsController.js';
import { requireAuth } from '../middlewares/requireAuth.js';

export const dnsRouter = Router();

// GET /api/dns/verificar/:dominio — Verificar registros DNS
dnsRouter.get('/verificar/:dominio', requireAuth, verificarDns);
