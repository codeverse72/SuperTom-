import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { Prisma } from '@prisma/client';

export interface AdWatchWithdrawalProgress {
  daysCompleted: number; // 0 to 5
  targetDays: number; // 5
  todayAdsWatched: number; // 0 to 30
  todayAdsTarget: number; // 30
  isTodayCompleted: boolean; // true if today >= 30
  canClaimReward: boolean; // true if daysCompleted >= 5
  totalQualifyingDays: number;
  claimedCycles: number;
}

export interface WithdrawalEntitlement {
  canWithdraw: boolean;
  hasUnlimitedWithdrawals: boolean;
  remainingWithdrawals: number;
  totalDepositedUsd: number;
  requiredDepositTier1: number; // $1.00 for 3 withdrawals
  requiredDepositTier2: number; // $3.00 for unlimited withdrawals
  adWatchProgress: AdWatchWithdrawalProgress;
}

export class WithdrawalEntitlementService {
  /**
   * Calculates the user's progress toward the "Watch 30 Ads/Day for 5 Days" withdrawal unlock.
   */
  public static async getAdWatchProgress(
    userId: string,
    claimedCycles: number = 0
  ): Promise<AdWatchWithdrawalProgress> {
    const TARGET_DAYS = 5;
    const DAILY_ADS_TARGET = 30;

    // Fetch all completed ad sessions for this user
    const completedSessions = await prisma.adSession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
      },
      select: {
        completedAt: true,
      },
    });

    const dailyCounts: Record<string, number> = {};
    for (const s of completedSessions) {
      if (!s.completedAt) continue;
      const dateKey = s.completedAt.toISOString().slice(0, 10); // 'YYYY-MM-DD' in UTC
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const todayAdsWatched = Math.min(DAILY_ADS_TARGET, dailyCounts[todayKey] || 0);
    const isTodayCompleted = todayAdsWatched >= DAILY_ADS_TARGET;

    // Count distinct UTC days where user completed >= 30 ads
    const qualifyingDates = Object.keys(dailyCounts).filter(
      (dateKey) => (dailyCounts[dateKey] || 0) >= DAILY_ADS_TARGET
    );
    const totalQualifyingDays = qualifyingDates.length;

    // Current cycle calculation
    const effectiveDays = Math.max(0, totalQualifyingDays - claimedCycles * TARGET_DAYS);
    const daysCompleted = Math.min(TARGET_DAYS, effectiveDays);
    const canClaimReward = daysCompleted >= TARGET_DAYS;

    return {
      daysCompleted,
      targetDays: TARGET_DAYS,
      todayAdsWatched,
      todayAdsTarget: DAILY_ADS_TARGET,
      isTodayCompleted,
      canClaimReward,
      totalQualifyingDays,
      claimedCycles,
    };
  }

  /**
   * Explicitly claims a withdrawal request unlocked via the 5-day ad watch quest.
   */
  public static async claimAdWithdrawalUnlock(userId: string): Promise<{
    success: boolean;
    remainingWithdrawals: number;
    message: string;
  }> {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, remainingWithdrawals: true, adWithdrawalsClaimed: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const progress = await WithdrawalEntitlementService.getAdWatchProgress(
        userId,
        user.adWithdrawalsClaimed || 0
      );

      if (!progress.canClaimReward) {
        throw new Error(
          `You have completed ${progress.daysCompleted}/5 days of 30 ads. Complete all 5 days to unlock a withdrawal request.`
        );
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          remainingWithdrawals: { increment: 1 },
          adWithdrawalsClaimed: { increment: 1 },
        },
        select: { remainingWithdrawals: true, adWithdrawalsClaimed: true },
      });

      logger.info(
        `[WithdrawalEntitlement] User ${userId} claimed free withdrawal via 5-day ad quest. Remaining: ${updated.remainingWithdrawals}`
      );

      return {
        success: true,
        remainingWithdrawals: updated.remainingWithdrawals,
        message: 'Congratulations! You unlocked 1 free withdrawal request by watching 30 ads/day for 5 days!',
      };
    });
  }

  /**
   * Retrieves or auto-syncs the user's withdrawal entitlement.
   * Auto-detects existing confirmed deposits and completed ad quests to ensure zero desync.
   */
  public static async getUserEntitlement(userId: string): Promise<WithdrawalEntitlement> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        remainingWithdrawals: true,
        hasUnlimitedWithdrawals: true,
        adWithdrawalsClaimed: true,
      },
    });

    if (!user) {
      return {
        canWithdraw: false,
        hasUnlimitedWithdrawals: false,
        remainingWithdrawals: 0,
        totalDepositedUsd: 0,
        requiredDepositTier1: 1.0,
        requiredDepositTier2: 3.0,
        adWatchProgress: {
          daysCompleted: 0,
          targetDays: 5,
          todayAdsWatched: 0,
          todayAdsTarget: 30,
          isTodayCompleted: false,
          canClaimReward: false,
          totalQualifyingDays: 0,
          claimedCycles: 0,
        },
      };
    }

    // Check confirmed deposits in case self-healing / sync is needed
    const confirmedDeposits = await prisma.deposit.findMany({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'COMPLETED', 'CREDITED', 'SUCCESS'] },
      },
      select: {
        amountUsdt: true,
      },
    });

    let totalDepositedUsd = 0;
    let hasThreeDollarDeposit = false;
    let hasOneDollarDeposit = false;

    for (const d of confirmedDeposits) {
      const amt = Number(d.amountUsdt);
      totalDepositedUsd += amt;
      if (amt >= 3.0) hasThreeDollarDeposit = true;
      if (amt >= 1.0) hasOneDollarDeposit = true;
    }

    let hasUnlimited = user.hasUnlimitedWithdrawals;
    let remaining = user.remainingWithdrawals;
    let claimedCycles = user.adWithdrawalsClaimed || 0;

    // Auto-grant unlimited if user has deposited >= $3.00
    if (!hasUnlimited && (hasThreeDollarDeposit || totalDepositedUsd >= 3.0)) {
      hasUnlimited = true;
      await prisma.user.update({
        where: { id: userId },
        data: { hasUnlimitedWithdrawals: true },
      }).catch((e) => logger.warn('[WithdrawalEntitlement] Auto-update unlimited failed:', e));
    }

    // Auto-grant 3 withdrawals if user has deposited >= $1.00 and has 0 remaining
    if (!hasUnlimited && remaining === 0 && (hasOneDollarDeposit || totalDepositedUsd >= 1.0)) {
      const pastWithdrawals = await prisma.withdrawal.count({
        where: { userId, status: { not: 'REJECTED' } },
      });
      const earnedSlots = Math.floor(totalDepositedUsd / 1.0) * 3;
      const calculatedRemaining = Math.max(0, earnedSlots - pastWithdrawals);
      if (calculatedRemaining > 0) {
        remaining = calculatedRemaining;
        await prisma.user.update({
          where: { id: userId },
          data: { remainingWithdrawals: remaining },
        }).catch((e) => logger.warn('[WithdrawalEntitlement] Auto-update remaining failed:', e));
      }
    }

    // Calculate Ad Watch Progress
    let adWatchProgress = await WithdrawalEntitlementService.getAdWatchProgress(userId, claimedCycles);

    // Auto-grant withdrawal request if 5/5 ad days reached and user has 0 remaining withdrawals
    if (!hasUnlimited && remaining === 0 && adWatchProgress.canClaimReward) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            remainingWithdrawals: { increment: 1 },
            adWithdrawalsClaimed: { increment: 1 },
          },
        });
        remaining += 1;
        claimedCycles += 1;
        adWatchProgress = await WithdrawalEntitlementService.getAdWatchProgress(userId, claimedCycles);
        logger.info(`[WithdrawalEntitlement] Auto-credited 1 free withdrawal to user ${userId} for 5 days of 30 ads.`);
      } catch (e) {
        logger.warn('[WithdrawalEntitlement] Auto-claim ad withdrawal failed:', e);
      }
    }

    const canWithdraw = hasUnlimited || remaining > 0;

    return {
      canWithdraw,
      hasUnlimitedWithdrawals: hasUnlimited,
      remainingWithdrawals: hasUnlimited ? 999999 : remaining,
      totalDepositedUsd,
      requiredDepositTier1: 1.0,
      requiredDepositTier2: 3.0,
      adWatchProgress,
    };
  }

  /**
   * Called whenever a deposit is verified and marked CONFIRMED / COMPLETED.
   * Immediately unlocks 3 withdrawals for $1+ or UNLIMITED for $3+.
   */
  public static async processDepositConfirmed(
    tx: Prisma.TransactionClient,
    params: { userId: string; amountUsdt: number }
  ): Promise<void> {
    const { userId, amountUsdt } = params;

    if (amountUsdt >= 3.0) {
      // $3+ deposit unlocks UNLIMITED lifetime withdrawals
      await tx.user.update({
        where: { id: userId },
        data: {
          hasUnlimitedWithdrawals: true,
        },
      });
      logger.info(`[WithdrawalEntitlement] User ${userId} granted UNLIMITED withdrawals for $${amountUsdt.toFixed(2)} deposit!`);
    } else if (amountUsdt >= 1.0) {
      // $1+ deposit unlocks 3 free withdrawals
      await tx.user.update({
        where: { id: userId },
        data: {
          remainingWithdrawals: { increment: 3 },
        },
      });
      logger.info(`[WithdrawalEntitlement] User ${userId} granted +3 free withdrawals for $${amountUsdt.toFixed(2)} deposit!`);
    }
  }

  /**
   * Strictly validates user entitlement inside the withdrawal transaction.
   * Decrements remaining quota by 1 if not unlimited.
   */
  public static async validateAndConsumeWithdrawal(
    tx: Prisma.TransactionClient,
    userId: string
  ): Promise<{ hasUnlimited: boolean; remainingAfter: number }> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        hasUnlimitedWithdrawals: true,
        remainingWithdrawals: true,
        adWithdrawalsClaimed: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    let hasUnlimited = user.hasUnlimitedWithdrawals;
    let remaining = user.remainingWithdrawals;

    // Check if user has qualifying deposits that weren't credited yet
    if (!hasUnlimited && remaining <= 0) {
      const deposits = await tx.deposit.findMany({
        where: {
          userId,
          status: { in: ['CONFIRMED', 'COMPLETED', 'CREDITED', 'SUCCESS'] },
        },
        select: { amountUsdt: true },
      });

      let total = 0;
      let hasThree = false;
      let hasOne = false;
      for (const d of deposits) {
        const a = Number(d.amountUsdt);
        total += a;
        if (a >= 3.0) hasThree = true;
        if (a >= 1.0) hasOne = true;
      }

      if (hasThree || total >= 3.0) {
        hasUnlimited = true;
        await tx.user.update({
          where: { id: userId },
          data: { hasUnlimitedWithdrawals: true },
        });
      } else if (hasOne || total >= 1.0) {
        const pastWithdrawals = await tx.withdrawal.count({
          where: { userId, status: { not: 'REJECTED' } },
        });
        const earned = Math.floor(total / 1.0) * 3;
        const available = Math.max(0, earned - pastWithdrawals);
        if (available > 0) {
          remaining = available;
          await tx.user.update({
            where: { id: userId },
            data: { remainingWithdrawals: remaining },
          });
        }
      }
    }

    // Check if user has completed the "Watch 30 Ads/Day for 5 Days" quest
    if (!hasUnlimited && remaining <= 0) {
      const adProgress = await WithdrawalEntitlementService.getAdWatchProgress(
        userId,
        user.adWithdrawalsClaimed || 0
      );

      if (adProgress.canClaimReward) {
        // Auto-consume 1 ad-unlocked withdrawal request for this payout
        await tx.user.update({
          where: { id: userId },
          data: {
            adWithdrawalsClaimed: { increment: 1 },
          },
        });
        logger.info(
          `[WithdrawalEntitlement] User ${userId} consumed 5-day ad watch reward directly for withdrawal request.`
        );
        return { hasUnlimited: false, remainingAfter: 0 };
      }
    }

    if (!hasUnlimited && remaining <= 0) {
      const err = new Error(
        'A qualifying deposit ($1.00 for 3 payouts, $3.00 for unlimited) or watching 30 ads/day for 5 days is required to unlock payouts.'
      );
      (err as any).code = 'WITHDRAWAL_DEPOSIT_REQUIRED';
      (err as any).requiresDeposit = true;
      throw err;
    }

    // Decrement finite quota
    if (!hasUnlimited) {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          remainingWithdrawals: { decrement: 1 },
        },
        select: { remainingWithdrawals: true },
      });
      return { hasUnlimited: false, remainingAfter: updated.remainingWithdrawals };
    }

    return { hasUnlimited: true, remainingAfter: 999999 };
  }
}

