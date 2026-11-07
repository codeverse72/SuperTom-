import { Router } from 'express';
import { requireAdminAuth, requireAdminRole } from '../../middleware/adminAuth.js';
import { AdminAuthController } from './adminAuthController.js';
import { AdminDashboardController } from './adminDashboardController.js';
import { AdminUserController } from './adminUserController.js';
import { AdminMiningController } from './adminMiningController.js';
import { AdminBiscuitController } from './adminBiscuitController.js';
import { AdminMissionController } from './adminMissionController.js';
import { AdminSpinController } from './adminSpinController.js';
import { AdminPayoutController } from './adminPayoutController.js';
import { AdminTransactionController } from './adminTransactionController.js';
import { AdminReferralController } from './adminReferralController.js';
import { AdminAuditLogController } from './adminAuditLogController.js';

export const adminRouter = Router();

// === 1. Public Admin Auth ===
adminRouter.post('/auth/login', AdminAuthController.login);

// === Protected Admin Endpoints (Requires Admin Session) ===
adminRouter.use(requireAdminAuth);

// Auth Profile & Password
adminRouter.get('/auth/me', AdminAuthController.getProfile);
adminRouter.post('/auth/change-password', AdminAuthController.changePassword);

// Dashboard
adminRouter.get('/dashboard/stats', AdminDashboardController.getStats);

// User Management
adminRouter.get('/users', AdminUserController.listUsers);
adminRouter.get('/users/:id', AdminUserController.getUserDetail);
adminRouter.patch(
  '/users/:id/status',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminUserController.updateStatus
);
adminRouter.post(
  '/users/:id/adjust-balance',
  requireAdminRole(['SUPER_ADMIN']),
  AdminUserController.adjustBalance
);

// Mining Management
adminRouter.get('/mining', AdminMiningController.getSettings);
adminRouter.put(
  '/mining',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminMiningController.updateSettings
);

// Biscuit Store Management
adminRouter.get('/biscuits', AdminBiscuitController.listBiscuits);
adminRouter.put(
  '/biscuits/:id',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminBiscuitController.updateBiscuit
);

// Missions Management
adminRouter.get('/missions', AdminMissionController.listMissions);
adminRouter.post(
  '/missions',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminMissionController.createMission
);
adminRouter.put(
  '/missions/:id',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminMissionController.updateMission
);
adminRouter.delete(
  '/missions/:id',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminMissionController.deactivateMission
);

// Spin Wheel Management
adminRouter.get('/spin', AdminSpinController.getSpinConfig);
adminRouter.put(
  '/spin/probabilities',
  requireAdminRole(['SUPER_ADMIN']),
  AdminSpinController.updateProbabilities
);
adminRouter.put(
  '/spin/cooldowns',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminSpinController.updateCooldowns
);

// Payouts & Deposits Management
adminRouter.get('/withdrawals', AdminPayoutController.listWithdrawals);
adminRouter.post(
  '/withdrawals/:id/approve',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminPayoutController.approveWithdrawal
);
adminRouter.post(
  '/withdrawals/:id/reject',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminPayoutController.rejectWithdrawal
);
adminRouter.post(
  '/withdrawals/:id/complete',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminPayoutController.completeWithdrawal
);

adminRouter.get('/deposits', AdminPayoutController.listDeposits);
adminRouter.post(
  '/deposits/:id/confirm',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminPayoutController.confirmDeposit
);

// Ledger & Transaction Management
adminRouter.get('/transactions', AdminTransactionController.listTransactions);

// Referral Program Management
adminRouter.get('/referrals', AdminReferralController.getReferralStats);

// Audit Trail Logs
adminRouter.get('/audit-logs', AdminAuditLogController.listLogs);
