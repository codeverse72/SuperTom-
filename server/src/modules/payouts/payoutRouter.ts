import { Router } from 'express';
import { PayoutController } from './payoutController.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';

export const payoutRouter = Router();

const withdrawalLimiter = createRateLimiter(60000, 3); // Max 3 withdrawal attempts per minute

payoutRouter.get('/history', requireAuth, PayoutController.getHistory);
payoutRouter.post('/request', requireAuth, withdrawalLimiter, PayoutController.requestWithdrawal);

