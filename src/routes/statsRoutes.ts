import { Router } from 'express';
import { getGlobalStats, exportCampanasStats } from '../controllers/statsController.js';
import { cache } from '../middlewares/cache.js';

export const statsRouter = Router();

statsRouter.get('/global', cache(30), getGlobalStats);
statsRouter.get('/export-campanas', exportCampanasStats);
