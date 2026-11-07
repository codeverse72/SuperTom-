import { Router } from 'express';
import { MiningController } from './miningController.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';

export const miningRouter = Router();

const claimLimiter = createRateLimiter(5000, 5); // Max 5 claims per 5 seconds

miningRouter.get('/status', requireAuth, MiningController.getStatus);
miningRouter.post('/claim', requireAuth, claimLimiter, MiningController.claimEarnings);

