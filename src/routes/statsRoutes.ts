import { Router } from 'express';
import { getGlobalStats, exportCampanasStats } from '../controllers/statsController.js';

export const statsRouter = Router();

statsRouter.get('/global', getGlobalStats);
statsRouter.get('/export-campanas', exportCampanasStats);
