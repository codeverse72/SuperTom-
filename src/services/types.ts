/**
 * Backend Service Type Definitions
 * Ready for future REST / WebSocket API integration.
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface UserSessionDto {
  userId: string;
  telegramId?: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  level: number;
  levelTitle: string;
  referralCode: string;
  createdAt: string;
}

export interface BalanceDto {
  balancePoops: number;
  usdtEquivalent: number;
  lockedPoops: number;
  lastUpdated: string;
}

export interface MiningRateDto {
  baseRatePerHour: number;
  boostRatePerHour: number;
  totalRatePerHour: number;
  unclaimedMiningPoops: number;
  lastCollectedAt: string;
}

export interface MissionDto {
  id: string;
  title: string;
  description: string;
  rewardPoops: number;
  category: 'daily' | 'social' | 'special';
  icon: string;
  status: 'start' | 'in_progress' | 'verify' | 'completed' | 'claimed';
  progress: number;
  total: number;
  badge?: string;
  actionUrl?: string;
}

export interface SpinStatusDto {
  currentMilestone: 1 | 2 | 3;
  nextUnlockTimestamp: number;
  canSpin: boolean;
  cycleCount: number;
  claimedMilestones: number[];
}

export interface SpinClaimResultDto {
  rewardId: string;
  label: string;
  rewardType: 'poops' | 'biscuit';
  amount?: number;
  biscuitId?: string;
  newBalancePoops: number;
  nextMilestone: 1 | 2 | 3;
  nextUnlockTimestamp: number;
}

export interface BiscuitInventoryDto {
  common: number;
  silver: number;
  gold: number;
  diamond: number;
  [key: string]: number;
}

export interface PurchaseBiscuitRequest {
  biscuitId: 'common' | 'silver' | 'gold' | 'diamond';
  quantity: number;
}

export interface PurchaseBiscuitResponse {
  biscuitId: string;
  quantityPurchased: number;
  totalCostPoops: number;
  newBalancePoops: number;
  newInventory: BiscuitInventoryDto;
  newProductionRate: number;
}

export interface WithdrawalRequestDto {
  walletAddress: string;
  amountPoops: number;
  network: 'TRC20' | 'TON' | 'BEP20';
}

export interface TransactionDto {
  id: string;
  timestamp: number;
  amountPoops: number;
  amountUsdt: number;
  walletAddress: string;
  network: 'TRC20' | 'TON' | 'BEP20';
  status: 'Pending' | 'Approved' | 'Processing' | 'Completed' | 'Rejected';
  txHash?: string;
  rejectionReason?: string;
}

export interface ReferralStatsDto {
  referralCode: string;
  friendsInvited: number;
  commissionEarnedPoops: number;
  commissionRatePercent: number;
}
