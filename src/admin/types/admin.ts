export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  lastLoginAt?: string | null;
}

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    banned: number;
    newLast24h: number;
    growthChart: Array<{ date: string; count: number }>;
  };
  economy: {
    poopsInCirculation: number;
    totalPoopsMined: number;
    usdtExchangeRate: number;
  };
  withdrawals: {
    pendingCount: number;
    pendingUsdt: number;
    completedCount: number;
    completedUsdt: number;
  };
  deposits: {
    confirmedCount: number;
    confirmedUsdt: number;
  };
  missions: {
    totalCatalog: number;
    totalCompleted: number;
  };
  referrals: {
    totalReferrals: number;
    totalBonusesDistributed: number;
  };
  recentActivity: {
    withdrawals: Array<{
      id: string;
      username: string;
      amountUsdt: number;
      status: string;
      createdAt: string;
    }>;
    auditLogs: Array<{
      id: string;
      adminName: string;
      role: string;
      action: string;
      targetEntity: string;
      createdAt: string;
    }>;
  };
}

export interface ConnectedWalletItem {
  id: string;
  network: string;
  walletAddress: string;
  isDefault: boolean;
  createdAt: string;
}

export interface UserListItem {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  poopsBalance: number;
  level: number;
  levelTitle: string;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  miningRate: number;
  referralCode: string;
  refereesCount: number;
  feedingCount: number;
  walletsCount?: number;
  primaryWallet?: string | null;
  wallets?: ConnectedWalletItem[];
  createdAt: string;
}

export interface UserDetail extends UserListItem {
  photoUrl?: string | null;
  languageCode?: string | null;
  referredById?: string | null;
  updatedAt: string;
  wallets?: ConnectedWalletItem[];
  mining: {
    baseRate: number;
    boostRate: number;
    totalRate: number;
    lastSettledAt?: string;
  };
  spin: {
    currentMilestone: number;
    cycleCount: number;
    nextUnlockAt?: string;
    claimedMilestones?: string;
  };
  inventory: Array<{
    biscuitId: string;
    name: string;
    quantity: number;
    boostPerHour: number;
  }>;
  counts: {
    referees: number;
    feedingEvents: number;
    missionsDone: number;
  };
  withdrawals: Array<{
    id: string;
    amountPoops: number;
    amountUsdt: number;
    address: string;
    status: string;
    txHash?: string | null;
    createdAt: string;
  }>;
  deposits: Array<{
    id: string;
    amountPoops: number;
    amountUsdt: number;
    status: string;
    txHash?: string | null;
    createdAt: string;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
  }>;
}

export interface MiningSettings {
  baseRatePerHour: number;
  maxAccumulationHours: number;
  activeMinersCount: number;
  averageMiningRate: number;
  averageBoostRate: number;
}

export interface BiscuitItem {
  id: string;
  name: string;
  costPoops: number;
  productionBoostPerHour: number;
  currencyType: string;
  badge: string;
  color: string;
  borderColor: string;
  glowColor: string;
  description: string;
  isActive: boolean;
  totalPurchasedInventory: number;
  totalFedCount: number;
}

export interface MissionItem {
  id: string;
  title: string;
  description: string;
  rewardPoops: number;
  category: 'DAILY' | 'SOCIAL' | 'REFERRAL' | 'SPECIAL';
  verificationType: 'TELEGRAM_CHANNEL' | 'TELEGRAM_GROUP' | 'EXTERNAL_LINK' | 'GAME_ACTION';
  icon: string;
  badge?: string;
  actionUrl?: string;
  channelId?: string;
  isActive: boolean;
  totalParticipants: number;
  createdAt: string;
}

export interface SpinRewardItem {
  id: string;
  label: string;
  rewardType: 'poops' | 'biscuit';
  amount?: number;
  biscuitId?: string;
  percentage: number;
}

export interface SpinConfig {
  rewards: SpinRewardItem[];
  cooldowns: {
    milestone1Hours: number;
    milestone2Hours: number;
    milestone3Hours: number;
  };
  totalSpinsAwarded: number;
}

export interface WithdrawalItem {
  id: string;
  userId: string;
  telegramId: string;
  username?: string | null;
  currentBalance: number;
  amountPoops: number;
  amountUsdt: number;
  walletAddress: string;
  network: string;
  status: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
  txHash?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface DepositItem {
  id: string;
  userId: string | null;
  telegramId: string;
  username?: string | null;
  amountPoops: number;
  amountUsdt: number;
  network: string;
  currency?: string | null;
  depositAddress?: string | null;
  paymentReference?: string | null;
  expectedCryptoAmount?: number | null;
  receivedCryptoAmount?: number | null;
  fromAddress?: string | null;
  txHash?: string | null;
  status: string;
  confirmations?: number | null;
  requiredConfirmations?: number | null;
  blockNumber?: string | null;
  explorerUrl?: string | null;
  failureReason?: string | null;
  notes?: string | null;
  verifiedAt?: string | null;
  creditedAt?: string | null;
  createdAt: string;
}

export interface TransactionItem {
  id: string;
  userId: string;
  telegramId: string;
  username?: string | null;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId?: string | null;
  createdAt: string;
}

export interface ReferralStats {
  overview: {
    totalReferrals: number;
    totalRewardsDistributed: number;
    totalCommissionsPaid: number;
  };
  topReferrers: Array<{
    userId: string;
    telegramId: string;
    username: string;
    referralCode: string;
    refereesCount: number;
    balance: number;
    status: string;
  }>;
  suspicious: Array<{
    userId: string;
    telegramId: string;
    username?: string | null;
    status: string;
    refereesCount: number;
  }>;
}

export interface AuditLogItem {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminRole: AdminRole;
  action: string;
  targetEntity: string;
  targetId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

