/**
 * Centralized Feature Availability Configuration
 * 
 * Production-ready feature flags and availability registry.
 * Controls whether backend-dependent features are operative or safely disabled.
 * In frontend-only mode (backend not connected), all financial, transaction,
 * and server-dependent features remain safely UNAVAILABLE with professional notices.
 */

import { FeatureDefinition, FeatureId, FeatureStatus } from '../types/feature';

// Backend connection is live and active on Render
const IS_BACKEND_CONFIGURED = import.meta.env.VITE_BACKEND_DISABLED !== 'true';

export const FEATURE_REGISTRY: Record<FeatureId, FeatureDefinition> = {
  auth: {
    id: 'auth',
    name: 'Account Authentication',
    status: IS_BACKEND_CONFIGURED ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableMessage: 'Connect your account to access this feature.',
    requiresAuth: false,
    requiresBackend: true
  },
  mining: {
    id: 'mining',
    name: 'TomCoin Mining Services',
    status: (IS_BACKEND_CONFIGURED && import.meta.env.VITE_FEATURE_MINING !== 'false') ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableMessage: 'Mining services are temporarily unavailable.',
    requiresAuth: true,
    requiresBackend: true
  },
  biscuit_purchases: {
    id: 'biscuit_purchases',
    name: 'Store Purchases',
    status: (IS_BACKEND_CONFIGURED && import.meta.env.VITE_FEATURE_STORE !== 'false') ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableMessage: 'Purchases are currently unavailable.',
    requiresAuth: true,
    requiresBackend: true
  },
  biscuit_feeding: {
    id: 'biscuit_feeding',
    name: 'Biscuit Feeding',
    status: (IS_BACKEND_CONFIGURED && import.meta.env.VITE_FEATURE_FEEDING !== 'false') ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableMessage: 'Feeding is temporarily unavailable.',
    requiresAuth: true,
    requiresBackend: true
  },
  spin_rewards: {
    id: 'spin_rewards',
    name: 'Spin Rewards',
    status: (IS_BACKEND_CONFIGURED && import.meta.env.VITE_FEATURE_SPIN !== 'false') ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableMessage: 'Spin rewards are temporarily unavailable.',
    requiresAuth: true,
    requiresBackend: true
  },
  spin_timer_sync: {
    id: 'spin_timer_sync',
    name: 'Spin Timer Synchronization',
    status: (IS_BACKEND_CONFIGURED && import.meta.env.VITE_FEATURE_SPIN_SYNC !== 'false') ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableMessage: 'Spin timer synchronization is temporarily unavailable.',
    requiresAuth: true,
    requiresBackend: true
  },
  mission_verification: {
    id: 'mission_verification',
    name: 'Mission Verification',
    status: (IS_BACKEND_CONFIGURED && import.meta.env.VITE_FEATURE_MISSION_VERIFY !== 'false') ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableMessage: 'Mission verification is currently unavailable.',
    requiresAuth: true,
    requiresBackend: true
  },
  mission_claiming: {
    id: 'mission_claiming',
    name: 'Mission Reward Claiming',
    status: (IS_BACKEND_CONFIGURED && import.meta.env.VITE_FEATURE_MISSION_CLAIM !== 'false') ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableMessage: 'Reward claiming is temporarily unavailable.',
    requiresAuth: true,
    requiresBackend: true
  },
  referral_rewards: {
    id: 'referral_rewards',
    name: 'Referral Rewards',
    status: (IS_BACKEND_CONFIGURED && import.meta.env.VITE_FEATURE_REFERRALS !== 'false') ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableMessage: 'Referral rewards are temporarily unavailable.',
    requiresAuth: true,
    requiresBackend: true
  },
  withdrawals: {
    id: 'withdrawals',
    name: 'USDT Withdrawals',
    status: (IS_BACKEND_CONFIGURED && import.meta.env.VITE_FEATURE_WITHDRAWALS !== 'false') ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableMessage: 'Withdrawals are temporarily unavailable.',
    requiresAuth: true,
    requiresBackend: true
  },
  transaction_history: {
    id: 'transaction_history',
    name: 'Transaction History',
    status: (IS_BACKEND_CONFIGURED && import.meta.env.VITE_FEATURE_HISTORY !== 'false') ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableMessage: 'No transaction history.',
    requiresAuth: true,
    requiresBackend: true
  }
};

/**
 * Standard professional UI empty-state and notice messages
 */
export const SYSTEM_MESSAGES = {
  NO_ACCOUNT_DATA: 'No account data available.',
  CONNECT_ACCOUNT: 'Connect your account to access this feature.',
  BALANCE_UNAVAILABLE: 'Balance unavailable.',
  MINING_UNAVAILABLE: 'Mining currently unavailable.',
  FEEDING_UNAVAILABLE: 'Feeding is temporarily unavailable.',
  SPIN_UNAVAILABLE: 'Spin rewards are temporarily unavailable.',
  NO_ACTIVE_MISSIONS: 'No active missions.',
  MISSION_VERIFY_UNAVAILABLE: 'Mission verification is currently unavailable.',
  REWARD_CLAIM_UNAVAILABLE: 'Reward claiming is temporarily unavailable.',
  PURCHASES_UNAVAILABLE: 'Purchases are currently unavailable.',
  INVENTORY_UNAVAILABLE: 'Your biscuit inventory is currently unavailable.',
  WITHDRAWALS_UNAVAILABLE: 'Withdrawals are temporarily unavailable.',
  NO_TRANSACTIONS: 'No transaction history.',
  OFFLINE_MODE_BANNER: 'Backend services are not yet connected. All financial and server-dependent operations are safely disabled.'
} as const;

/**
 * Helper to check if a specific feature is available
 */
export function isFeatureAvailable(featureId: FeatureId): boolean {
  return FEATURE_REGISTRY[featureId]?.status === 'AVAILABLE';
}

/**
 * Helper to get the status of a specific feature
 */
export function getFeatureStatus(featureId: FeatureId): FeatureStatus {
  return FEATURE_REGISTRY[featureId]?.status || 'UNAVAILABLE';
}

/**
 * Helper to get the unavailable message for a specific feature
 */
export function getFeatureUnavailableMessage(featureId: FeatureId): string {
  return FEATURE_REGISTRY[featureId]?.unavailableMessage || 'This feature is temporarily unavailable.';
}
