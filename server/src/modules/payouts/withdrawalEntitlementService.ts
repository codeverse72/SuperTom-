import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { Prisma } from '@prisma/client';

export interface WithdrawalEntitlement {
  canWithdraw: boolean;
  hasUnlimitedWithdrawals: boolean;
  remainingWithdrawals: number;
  totalDepositedUsd: number;
  requiredDepositTier1: number; // $3.00 for 3 withdrawals
  requiredDepositTier2: number; // $5.00 for unlimited withdrawals
}

export class WithdrawalEntitlementService {
  /**
   * Retrieves or auto-syncs the user's withdrawal entitlement.
   * Auto-detects existing confirmed deposits to ensure zero desync.
   */
  public static async getUserEntitlement(userId: string): Promise<WithdrawalEntitlement> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        remainingWithdrawals: true,
        hasUnlimitedWithdrawals: true,
      },
    });

    if (!user) {
      return {
        canWithdraw: false,
        hasUnlimitedWithdrawals: false,
        remainingWithdrawals: 0,
        totalDepositedUsd: 0,
        requiredDepositTier1: 3.0,
        requiredDepositTier2: 5.0,
      };
    }

    // Check confirmed deposits in case self-healing / sync is needed
    const confirmedDeposits = await prisma.deposit.findMany({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      select: {
        amountUsdt: true,
      },
    });

    let totalDepositedUsd = 0;
    let hasFiveDollarDeposit = false;
    let hasThreeDollarDeposit = false;

    for (const d of confirmedDeposits) {
      const amt = Number(d.amountUsdt);
      totalDepositedUsd += amt;
      if (amt >= 5.0) hasFiveDollarDeposit = true;
      if (amt >= 3.0) hasThreeDollarDeposit = true;
    }

    let hasUnlimited = user.hasUnlimitedWithdrawals;
    let remaining = user.remainingWithdrawals;

    // Auto-grant unlimited if user has deposited >= $5.00
    if (!hasUnlimited && (hasFiveDollarDeposit || totalDepositedUsd >= 5.0)) {
      hasUnlimited = true;
      await prisma.user.update({
        where: { id: userId },
        data: { hasUnlimitedWithdrawals: true },
      }).catch((e) => logger.warn('[WithdrawalEntitlement] Auto-update unlimited failed:', e));
    }

    // Auto-grant 3 withdrawals if user has deposited >= $3.00 and has 0 remaining
    if (!hasUnlimited && remaining === 0 && (hasThreeDollarDeposit || totalDepositedUsd >= 3.0)) {
      const pastWithdrawals = await prisma.withdrawal.count({
        where: { userId, status: { not: 'REJECTED' } },
      });
      const earnedSlots = Math.floor(totalDepositedUsd / 3.0) * 3;
      const calculatedRemaining = Math.max(0, earnedSlots - pastWithdrawals);
      if (calculatedRemaining > 0) {
        remaining = calculatedRemaining;
        await prisma.user.update({
          where: { id: userId },
          data: { remainingWithdrawals: remaining },
        }).catch((e) => logger.warn('[WithdrawalEntitlement] Auto-update remaining failed:', e));
      }
    }

    const canWithdraw = hasUnlimited || remaining > 0;

    return {
      canWithdraw,
      hasUnlimitedWithdrawals: hasUnlimited,
      remainingWithdrawals: hasUnlimited ? 999999 : remaining,
      totalDepositedUsd,
      requiredDepositTier1: 3.0,
      requiredDepositTier2: 5.0,
    };
  }

  /**
   * Called whenever a deposit is verified and marked CONFIRMED / COMPLETED.
   * Immediately unlocks 3 withdrawals for $3+ or UNLIMITED for $5+.
   */
  public static async processDepositConfirmed(
    tx: Prisma.TransactionClient,
    params: { userId: string; amountUsdt: number }
  ): Promise<void> {
    const { userId, amountUsdt } = params;

    if (amountUsdt >= 5.0) {
      // $5+ deposit unlocks UNLIMITED lifetime withdrawals
      await tx.user.update({
        where: { id: userId },
        data: {
          hasUnlimitedWithdrawals: true,
        },
      });
      logger.info(`[WithdrawalEntitlement] User ${userId} granted UNLIMITED withdrawals for $${amountUsdt.toFixed(2)} deposit!`);
    } else if (amountUsdt >= 3.0) {
      // $3+ deposit unlocks 3 free withdrawals
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
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
        select: { amountUsdt: true },
      });

      let total = 0;
      let hasFive = false;
      let hasThree = false;
      for (const d of deposits) {
        const a = Number(d.amountUsdt);
        total += a;
        if (a >= 5.0) hasFive = true;
        if (a >= 3.0) hasThree = true;
      }

      if (hasFive || total >= 5.0) {
        hasUnlimited = true;
        await tx.user.update({
          where: { id: userId },
          data: { hasUnlimitedWithdrawals: true },
        });
      } else if (hasThree || total >= 3.0) {
        const pastWithdrawals = await tx.withdrawal.count({
          where: { userId, status: { not: 'REJECTED' } },
        });
        const earned = Math.floor(total / 3.0) * 3;
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

    if (!hasUnlimited && remaining <= 0) {
      const err = new Error(
        'A qualifying deposit is required to unlock payouts ($3.00 for 3 withdrawals, or $5.00 for unlimited withdrawals).'
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
