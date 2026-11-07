import { Router } from 'express';
import { MissionController } from './missionController.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';

export const missionRouter = Router();

const missionLimiter = createRateLimiter(5000, 10);

missionRouter.get('/', requireAuth, MissionController.getMissions);
missionRouter.post('/:id/verify', requireAuth, missionLimiter, MissionController.verifyMission);
missionRouter.post('/:id/claim', requireAuth, missionLimiter, MissionController.claimReward);
