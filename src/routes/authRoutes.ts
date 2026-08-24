import { Router } from 'express';
import { validateSchema } from '../middlewares/validateSchema.js';
import { loginSchema } from '../schemas/authSchema.js';
import { authController } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/requireAuth.js';

export const authRouter = Router();

authRouter.post('/login', validateSchema(loginSchema), authController.login);
authRouter.get('/me', requireAuth, authController.me);
