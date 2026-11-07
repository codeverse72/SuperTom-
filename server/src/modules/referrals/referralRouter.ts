import { Router } from 'express';
import { ReferralController } from './referralController.js';
import { requireAuth } from '../../middleware/auth.js';

export const referralRouter = Router();

referralRouter.get('/stats', requireAuth, ReferralController.getStats);

