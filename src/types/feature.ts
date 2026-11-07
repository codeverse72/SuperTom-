/**
 * Centralized Feature Availability Types
 * 
 * Production architecture for handling backend-dependent capabilities.
 */

export type FeatureStatus = 
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'LOADING'
  | 'ERROR'
  | 'AUTHENTICATION_REQUIRED';

export type FeatureId =
  | 'auth'
  | 'mining'
  | 'biscuit_purchases'
  | 'biscuit_feeding'
  | 'spin_rewards'
  | 'spin_timer_sync'
  | 'mission_verification'
  | 'mission_claiming'
  | 'referral_rewards'
  | 'withdrawals'
  | 'transaction_history';

export interface FeatureDefinition {
  id: FeatureId;
  name: string;
  status: FeatureStatus;
  unavailableMessage: string;
  requiresAuth: boolean;
  requiresBackend: boolean;
}
