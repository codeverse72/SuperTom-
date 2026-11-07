import { Router } from 'express';
import { AuthController } from './authController.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';

export const authRouter = Router();

// Rate limit auth requests to 30 per minute
const authLimiter = createRateLimiter(60000, 30);

authRouter.post('/telegram', authLimiter, AuthController.authenticateTelegram);
authRouter.post('/logout', requireAuth, AuthController.logout);

