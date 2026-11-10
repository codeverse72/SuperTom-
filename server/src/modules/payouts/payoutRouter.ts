import { Router } from 'express';
import { PayoutController } from './payoutController.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';

export const payoutRouter = Router();

const withdrawalLimiter = createRateLimiter(60000, 3); // Max 3 withdrawal attempts per minute
const depositLimiter = createRateLimiter(60000, 5); // Max 5 deposit submissions per minute

payoutRouter.get('/history', requireAuth, PayoutController.getHistory);
payoutRouter.get('/entitlement', requireAuth, PayoutController.getEntitlement);
payoutRouter.post('/request', requireAuth, withdrawalLimiter, PayoutController.requestWithdrawal);
payoutRouter.get('/wallets', requireAuth, PayoutController.getWallets);
payoutRouter.post('/wallets', requireAuth, PayoutController.saveWallet);
payoutRouter.get('/treasury-wallets', PayoutController.getTreasuryWallets);
payoutRouter.get('/ton-rate', PayoutController.getTonRate);
payoutRouter.get('/deposits', requireAuth, PayoutController.getDeposits);
payoutRouter.post('/deposits', requireAuth, depositLimiter, PayoutController.submitDeposit);
payoutRouter.post('/deposits/create', requireAuth, depositLimiter, PayoutController.createDeposit);
payoutRouter.post('/deposits/ton/create', requireAuth, depositLimiter, PayoutController.createTonDeposit);
payoutRouter.get('/deposits/:id/status', requireAuth, PayoutController.getDepositStatus);
payoutRouter.post('/deposits/:id/verify', requireAuth, depositLimiter, PayoutController.verifyDeposit);
payoutRouter.post('/deposits/:id/check-ton', requireAuth, depositLimiter, PayoutController.checkTonDepositOnChain);
