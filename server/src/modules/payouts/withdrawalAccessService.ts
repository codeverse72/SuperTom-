import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

export interface WithdrawalAccessResult {
  canWithdraw: boolean;
  isUnlimited: boolean;
  remainingWithdrawals: number;
  totalDepositedUsd: number;
  completedWithdrawalsCount: number;
  tier: 'LOCKED' | 'THREE_PACK' | 'UNLIMITED';
  message: string;
}

export class WithdrawalAccessService {
  /**
   * Determine whether a user qualifies to withdraw:
   * - Must have deposited at least $3.00 USD
   * - A $3.00 deposit unlocks the next 3 free withdrawals
   * - A $5.00 deposit (single or cumulative) unlocks unlimited lifetime withdrawals
   */
  public static async getUserWithdrawalAccess(userId: string): Promise<WithdrawalAccessResult> {
    try {
      // 1. Fetch all confirmed or completed deposits for the user
      const deposits = await prisma.deposit.findMany({
        where: {
          userId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
        select: {
          amountUsdt: true,
        },
      });

      const totalDepositedUsd = deposits.reduce(
        (sum, d) => sum + Number(d.amountUsdt || 0),
        0
      );

      // 2. Check VIP Unlimited condition: cumulative >= $5.00 or any single deposit >= $5.00
      const hasUnlimited =
        totalDepositedUsd >= 5.0 ||
        deposits.some((d) => Number(d.amountUsdt || 0) >= 5.0);

      if (hasUnlimited) {
        return {
          canWithdraw: true,
          isUnlimited: true,
          remainingWithdrawals: 999999,
          totalDepositedUsd,
          completedWithdrawalsCount: 0,
          tier: 'UNLIMITED',
          message: 'VIP Pass Active: Unlimited lifetime withdrawals unlocked.',
        };
      }

      // 3. Count 3-pack quota earned from deposits >= $3.00
      // Each $3.00 deposited grants 3 withdrawals
      let totalQuota = deposits.reduce((acc, d) => {
        const amt = Number(d.amountUsdt || 0);
        if (amt >= 3.0) {
          return acc + Math.floor(amt / 3.0) * 3;
        }
        return acc;
      }, 0);

      // If cumulative total is >= $3.00 and no individual deposit reached $3.00, grant 3
      if (totalQuota === 0 && totalDepositedUsd >= 3.0) {
        totalQuota = 3;
      }

      // 4. Count all withdrawals made (excluding rejected)
      const withdrawalsUsed = await prisma.withdrawal.count({
        where: {
          userId,
          status: { not: 'REJECTED' },
        },
      });

      const remainingWithdrawals = Math.max(0, totalQuota - withdrawalsUsed);

      if (remainingWithdrawals > 0) {
        return {
          canWithdraw: true,
          isUnlimited: false,
          remainingWithdrawals,
          totalDepositedUsd,
          completedWithdrawalsCount: withdrawalsUsed,
          tier: 'THREE_PACK',
          message: `Active Pass: ${remainingWithdrawals} withdrawal${remainingWithdrawals > 1 ? 's' : ''} remaining.`,
        };
      }

      return {
        canWithdraw: false,
        isUnlimited: false,
        remainingWithdrawals: 0,
        totalDepositedUsd,
        completedWithdrawalsCount: withdrawalsUsed,
        tier: 'LOCKED',
        message: 'Deposit required: Deposit $3 for next 3 withdrawals, or $5 for unlimited withdrawals.',
      };
    } catch (err) {
      logger.error(`[WithdrawalAccessService] Failed to calculate access for user ${userId}:`, err);
      return {
        canWithdraw: false,
        isUnlimited: false,
        remainingWithdrawals: 0,
        totalDepositedUsd: 0,
        completedWithdrawalsCount: 0,
        tier: 'LOCKED',
        message: 'Deposit required: Deposit $3 for next 3 withdrawals, or $5 for unlimited withdrawals.',
      };
    }
  }
}
