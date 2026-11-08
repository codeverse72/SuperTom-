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
import { AdminCampaignController } from './adminCampaignController.js';
import { PayoutAutomationController } from '../payoutAutomation/payoutAutomationController.js';

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
adminRouter.post(
  '/biscuits',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminBiscuitController.createBiscuit
);
adminRouter.put(
  '/biscuits/:id',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminBiscuitController.updateBiscuit
);
adminRouter.delete(
  '/biscuits/:id',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminBiscuitController.deleteBiscuit
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
adminRouter.post(
  '/spin/reset-cooldown',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminSpinController.resetSpinCooldown
);

// Payouts & Deposits Management
adminRouter.get('/withdrawals', AdminPayoutController.listWithdrawals);
adminRouter.post(
  '/withdrawals/:id/approve',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminPayoutController.approveWithdrawal
);
adminRouter.post(
  '/withdrawals/:id/processing',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminPayoutController.markProcessing
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
adminRouter.post(
  '/deposits/manual-credit',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminPayoutController.manualCreditDeposit
);

// Receiving Trust Wallet Treasury Configuration
adminRouter.get('/treasury-settings', AdminPayoutController.getTreasurySettings);
adminRouter.post(
  '/treasury-settings',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminPayoutController.updateTreasurySettings
);

// Ledger & Transaction Management
adminRouter.get('/transactions', AdminTransactionController.listTransactions);

// Referral Program Management
adminRouter.get('/referrals', AdminReferralController.getReferralStats);

// 5K Celebration Campaign Management
adminRouter.get('/campaign', AdminCampaignController.getCampaignConfig);
adminRouter.put(
  '/campaign',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminCampaignController.updateCampaignConfig
);
adminRouter.post(
  '/campaign/process-rewards',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminCampaignController.triggerProcessDailyRewards
);
adminRouter.get(
  '/campaign/export',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  AdminCampaignController.exportParticipants
);

// Audit Trail Logs
adminRouter.get('/audit-logs', AdminAuditLogController.listLogs);

// === Payout Channel Automation Management ===
adminRouter.get('/payout-automation/config', PayoutAutomationController.getConfig);
adminRouter.put(
  '/payout-automation/config',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.updateConfig
);
adminRouter.post(
  '/payout-automation/verify-reference',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.verifyReferenceChannel
);
adminRouter.post(
  '/payout-automation/verify-destination',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.verifyDestinationChannel
);
adminRouter.get(
  '/payout-automation/detect-channels',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.detectBotChannels
);
adminRouter.post(
  '/payout-automation/sync-reflect',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.syncAndReflect
);
adminRouter.get('/payout-automation/templates', PayoutAutomationController.listTemplates);
adminRouter.post(
  '/payout-automation/templates',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.createTemplate
);
adminRouter.put(
  '/payout-automation/templates/:id',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.updateTemplate
);
adminRouter.delete(
  '/payout-automation/templates/:id',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.deleteTemplate
);
adminRouter.post(
  '/payout-automation/analyze',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.analyzeMessage
);
adminRouter.post(
  '/payout-automation/preview',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.previewMessage
);
adminRouter.get('/payout-automation/announcements', PayoutAutomationController.listAnnouncements);
adminRouter.post(
  '/payout-automation/announcements/:id/publish',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.publishAnnouncement
);
adminRouter.put(
  '/payout-automation/announcements/:id',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.editAnnouncement
);
adminRouter.post(
  '/payout-automation/announcements/:id/reject',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.rejectAnnouncement
);
adminRouter.post(
  '/payout-automation/test-send',
  requireAdminRole(['SUPER_ADMIN', 'ADMIN']),
  PayoutAutomationController.testSendAnnouncement
);
adminRouter.get('/payout-automation/analytics', PayoutAutomationController.getAnalytics);


