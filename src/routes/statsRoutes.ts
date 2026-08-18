import { Router } from 'express';
import { getGlobalStats } from '../controllers/statsController.js';

export const statsRouter = Router();

statsRouter.get('/global', getGlobalStats);
