import { Router } from 'express';
import { SpinController } from './spinController.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';

export const spinRouter = Router();

const spinLimiter = createRateLimiter(5000, 5);

spinRouter.get('/status', requireAuth, SpinController.getStatus);
spinRouter.post('/claim', requireAuth, spinLimiter, SpinController.claimSpin);
