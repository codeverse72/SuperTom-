import { Response } from 'express';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { LedgerService } from '../ledger/ledgerService.js';

export class MiningController {
  /**
   * Helper to compute real-time accumulated Poops using server timestamps.
   */
  private static calculateAccumulatedPoops(
    lastSettledAt: Date,
    ratePerHour: number,
    unclaimedStored: bigint,
    maxHours: number = 24
  ): { unclaimedTotal: bigint; elapsedHours: number } {
    const now = Date.now();
    const elapsedMs = Math.max(0, now - lastSettledAt.getTime());
    const elapsedHours = Math.min(maxHours, elapsedMs / (3600 * 1000));
    
    // Exact accrued integer poops
    const newlyMined = BigInt(Math.floor(elapsedHours * ratePerHour));
    const unclaimedTotal = unclaimedStored + newlyMined;

    return { unclaimedTotal, elapsedHours };
  }

  /**
   * GET /api/v1/mining/status
   */
  public static async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
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

      const { unclaimedTotal } = MiningController.calculateAccumulatedPoops(
        settlement.lastSettledAt,
        settlement.totalRatePerHour,
        settlement.unclaimedPoops,
        settlement.maxAccumulationHours
      );

      sendSuccess(res, {
        baseRatePerHour: settlement.baseRatePerHour,
        boostRatePerHour: settlement.boostRatePerHour,
        totalRatePerHour: settlement.totalRatePerHour,
        unclaimedMiningPoops: Number(unclaimedTotal),
        lastCollectedAt: settlement.lastSettledAt.toISOString(),
      });
    } catch {
      sendError(res, 'Failed to fetch mining status', 500, 'MINING_STATUS_ERROR');
    }
  }

  /**
   * POST /api/v1/mining/claim
   * Settles accrued Poops atomically and resets calculation clock.
   */
  public static async claimEarnings(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const settlement = await tx.miningSettlement.findUnique({
          where: { userId },
        });

        if (!settlement) {
          throw new Error('Mining settlement record not found');
        }

        const { unclaimedTotal } = MiningController.calculateAccumulatedPoops(
          settlement.lastSettledAt,
          settlement.totalRatePerHour,
          settlement.unclaimedPoops,
          settlement.maxAccumulationHours
        );

        if (unclaimedTotal <= 0n) {
          throw new Error('No unclaimed Poops available at this time');
        }

        // Reset settlement timestamp and unclaimed stored balance to 0
        await tx.miningSettlement.update({
          where: { userId },
          data: {
            unclaimedPoops: 0n,
            lastSettledAt: new Date(),
          },
        });

        // Credit user balance atomically and write immutable ledger entry
        const { balanceAfter } = await LedgerService.executeBalanceTransaction(tx, {
          userId,
          type: 'MINING_SETTLEMENT',
          amount: unclaimedTotal,
          description: `Mining claim of ${unclaimedTotal} Poops (${settlement.totalRatePerHour}/h rate)`,
          idempotencyKey: `claim_${userId}_${Date.now()}`,
        });

        return {
          claimedAmount: Number(unclaimedTotal),
          newBalance: Number(balanceAfter),
        };
      });

      sendSuccess(res, result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Claiming failed';
      sendError(res, msg, 400, 'CLAIM_FAILED');
    }
  }
}

