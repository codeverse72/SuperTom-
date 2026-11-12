import { Router } from 'express';
import { AdController } from './adController.js';
import { requireAuth } from '../../middleware/auth.js';

export const adRouter = Router();

// All ad session endpoints require authentic player authentication
adRouter.post('/session/create', requireAuth, AdController.createSession);
adRouter.post('/session/complete', requireAuth, AdController.completeSession);
adRouter.get('/session/:id', requireAuth, AdController.getSessionStatus);
