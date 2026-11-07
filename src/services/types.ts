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
  network: string;
}

export interface TransactionDto {
  id: string;
  timestamp: number;
  amountPoops: number;
  amountUsdt: number;
  walletAddress: string;
  network: string;
  status: 'Pending' | 'Approved' | 'Processing' | 'Completed' | 'Rejected';
  txHash?: string;
  rejectionReason?: string;
}

export interface DepositRequestDto {
  amountUsdt: number;
  network: string;
  txHash: string;
  notes?: string;
}

export interface DepositDto {
  id: string;
  timestamp: number;
  amountUsdt: number;
  amountPoops: number;
  currency?: string;
  network: string;
  depositAddress?: string;
  paymentReference?: string;
  expectedCryptoAmount?: number;
  txHash?: string;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Rejected' | 'Confirming' | string;
  rawStatus?: string;
  notes?: string;
  confirmedAt?: number;
}

export interface CreateDepositIntentRequestDto {
  amountUsdt: number;
  currency: string;
  network: string;
  notes?: string;
}

export interface CreateDepositIntentResponseDto {
  id: string;
  telegramId: string;
  amountUsdt: number;
  amountPoops: number;
  currency: string;
  network: string;
  depositAddress: string;
  paymentReference: string;
  expectedCryptoAmount: number;
  minDeposit: number;
  status: string;
  expiresAt?: number;
  createdAt: number;
}

export interface DepositStatusResponseDto {
  id: string;
  status: string;
  amountUsdt: number;
  amountPoops: number;
  currency: string;
  network: string;
  depositAddress?: string;
  paymentReference?: string;
  txHash?: string;
  confirmedAt?: number;
  isCompleted: boolean;
}

export interface TreasuryWalletsResponseDto {
  wallets: Record<string, {
    currency: string;
    network: string;
    address: string;
    hint: string;
  }>;
  rate: {
    poopsPerUsdt: number;
    minWithdrawalPoops: number;
  };
}

export interface ReferralStatsDto {
  referralCode: string;
  friendsInvited: number;
  commissionEarnedPoops: number;
  commissionRatePercent: number;
}
