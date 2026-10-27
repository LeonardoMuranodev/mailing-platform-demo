import { Router } from 'express';
import { handleResendWebhook } from '../controllers/resendWebhookController.js';

const router = Router();

// Endpoint público para webhooks de Resend
router.post('/resend', handleResendWebhook);

export default router;
