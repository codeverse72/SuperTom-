import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { LedgerService } from '../ledger/ledgerService.js';

export interface HourlySettlementResult {
  settled: boolean;
  completedHours: number;
  amountSettled: number;
  newBalance: number;
  totalRatePerHour: number;
  lastSettledAt: Date;
  msUntilNextHour: number;
  nextAdditionAt: Date;
}

export class MiningService {
  /**
   * Settle completed hours of mining into the user's main poopsBalance.
   * Strictly adds once per full completed hour (up to 24 times a day / max 24 hours).
   * Starting anchor is either when user enters/starts the bot or when biscuits are fed.
   */
  public static async settleUserHourlyEarnings(userId: string): Promise<HourlySettlementResult> {
    let settlement = await prisma.miningSettlement.findUnique({
      where: { userId },
    });

    if (!settlement) {
      settlement = await prisma.miningSettlement.create({
        data: {
          userId,
          baseRatePerHour: 10,
          boostRatePerHour: 0,
          totalRatePerHour: 10,
          unclaimedPoops: 0n,
          lastSettledAt: new Date(),
        },
      });
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - settlement.lastSettledAt.getTime());
    const maxMs = settlement.maxAccumulationHours * 3600 * 1000;
    const cappedElapsedMs = Math.min(maxMs, elapsedMs);

    // Number of complete hours that have elapsed
    const completedHours = Math.floor(cappedElapsedMs / (3600 * 1000));
    const msIntoCurrentHour = elapsedMs % (3600 * 1000);
    const msUntilNextHour = completedHours >= settlement.maxAccumulationHours
      ? 0
      : Math.max(0, 3600 * 1000 - msIntoCurrentHour);

    const nextAdditionAt = new Date(now + msUntilNextHour);

    if (completedHours < 1 && settlement.unclaimedPoops === 0n) {
      // 0 full hours completed; current hour is still in progress
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { poopsBalance: true },
      });

      return {
        settled: false,
        completedHours: 0,
        amountSettled: 0,
        newBalance: Number(user?.poopsBalance || 0),
        totalRatePerHour: settlement.totalRatePerHour,
        lastSettledAt: settlement.lastSettledAt,
        msUntilNextHour,
        nextAdditionAt,
      };
    }

    // Calculate exact poops for completed hours
    const newlyMined = BigInt(completedHours * settlement.totalRatePerHour);
    const totalToSettle = settlement.unclaimedPoops + newlyMined;

    if (totalToSettle <= 0n) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { poopsBalance: true },
      });

      return {
        settled: false,
        completedHours: 0,
        amountSettled: 0,
        newBalance: Number(user?.poopsBalance || 0),
        totalRatePerHour: settlement.totalRatePerHour,
        lastSettledAt: settlement.lastSettledAt,
        msUntilNextHour,
        nextAdditionAt,
      };
    }

    // Advance lastSettledAt by exact completed hours, preserving remaining minutes toward the current hour
    const newLastSettledAt = new Date(settlement.lastSettledAt.getTime() + completedHours * 3600 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      // Update mining settlement timestamp and reset stored unclaimed
      await tx.miningSettlement.update({
        where: { userId },
        data: {
          unclaimedPoops: 0n,
          lastSettledAt: newLastSettledAt,
        },
      });

      // Credit user's main balance atomically via immutable double-entry ledger
      const { balanceAfter } = await LedgerService.executeBalanceTransaction(tx, {
        userId,
        type: 'MINING_SETTLEMENT',
        amount: totalToSettle,
        description: `Hourly mining settlement: +${totalToSettle} Poops (${completedHours} completed hr${completedHours > 1 ? 's' : ''} @ ${settlement.totalRatePerHour}/hr)`,
        idempotencyKey: `hourly_settle_${userId}_${newLastSettledAt.getTime()}`,
      });

      return {
        newBalance: Number(balanceAfter),
      };
    });

    logger.info(`[MiningService] Auto-settled hourly earnings for user ${userId}: +${totalToSettle} Poops (${completedHours} hrs). New main balance: ${result.newBalance}`);

    return {
      settled: true,
      completedHours,
      amountSettled: Number(totalToSettle),
      newBalance: result.newBalance,
      totalRatePerHour: settlement.totalRatePerHour,
      lastSettledAt: newLastSettledAt,
      msUntilNextHour,
      nextAdditionAt,
    };
  }

  /**
   * Background Worker: Periodically checks active mining settlements and auto-credits
   * any completed hours into users' main balances (24 times/day).
   */
  public static async processScheduledHourlySettlements(): Promise<{
    processedCount: number;
    totalPoopsAwarded: number;
  }> {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);

    // Find settlements that have at least 1 full hour elapsed
    const eligible = await prisma.miningSettlement.findMany({
      where: {
        lastSettledAt: { lte: oneHourAgo },
      },
      take: 50,
      select: { userId: true },
    });

    let processedCount = 0;
    let totalPoopsAwarded = 0;

    for (const item of eligible) {
      try {
        const res = await this.settleUserHourlyEarnings(item.userId);
        if (res.settled) {
          processedCount++;
          totalPoopsAwarded += res.amountSettled;
        }
      } catch (err) {
        logger.error(`[MiningService] Error auto-settling user ${item.userId}:`, err);
      }
    }

    return { processedCount, totalPoopsAwarded };
  }
}

