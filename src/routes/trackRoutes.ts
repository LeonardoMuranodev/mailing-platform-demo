import { Router } from 'express';
import { trackOpen, trackClick } from '../controllers/trackController.js';

export const trackRouter = Router();

// /api/track/open/:colaId
trackRouter.get('/open/:colaId', trackOpen);

// /api/track/click/:colaId
trackRouter.get('/click/:colaId', trackClick);
