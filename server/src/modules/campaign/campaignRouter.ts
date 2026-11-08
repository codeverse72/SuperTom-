import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { CampaignController } from './campaignController.js';

export const campaignRouter = Router();

campaignRouter.get('/status', requireAuth, CampaignController.getStatus);
campaignRouter.get('/info', CampaignController.getInfo);
