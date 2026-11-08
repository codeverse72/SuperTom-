import { Router } from 'express';
import { StoreController } from './storeController.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';

export const storeRouter = Router();

const transactionLimiter = createRateLimiter(5000, 10);

storeRouter.get('/biscuits', StoreController.listBiscuits);
storeRouter.get('/inventory', requireAuth, StoreController.getInventory);
storeRouter.post('/purchase', requireAuth, transactionLimiter, StoreController.purchaseBiscuit);
storeRouter.post('/feed', requireAuth, transactionLimiter, StoreController.feedBiscuit);

