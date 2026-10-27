import { Router } from 'express';
import { validateSchema } from '../middlewares/validateSchema.js';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from '../schemas/authSchema.js';
import { authController } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Límite de 5 intentos de login por IP cada 15 min
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos de login fallidos, intente de nuevo en 15 minutos' } },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validateSchema(loginSchema), authController.login);
authRouter.post('/forgot-password', loginLimiter, validateSchema(forgotPasswordSchema), authController.forgotPassword);
authRouter.post('/reset-password', validateSchema(resetPasswordSchema), authController.resetPassword);
authRouter.post('/change-password', requireAuth, validateSchema(changePasswordSchema), authController.changePassword);
authRouter.get('/me', requireAuth, authController.me);
