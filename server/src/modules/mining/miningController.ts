import { Response } from 'express';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { MiningService } from './miningService.js';

export class MiningController {
  /**
   * GET /api/v1/mining/status
   * Checks real-time mining speed, auto-settles any completed hours into main balance (Option A),
   * and returns the exact milliseconds remaining until the next hourly addition.
   */
  public static async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      // Auto-settle any completed hours into the user's main balance (Option A)
      const settleResult = await MiningService.settleUserHourlyEarnings(userId);

      const settlement = await prisma.miningSettlement.findUnique({
        where: { userId },
      });

      sendSuccess(res, {
        baseRatePerHour: settlement?.baseRatePerHour ?? 10,
        boostRatePerHour: settlement?.boostRatePerHour ?? 0,
        totalRatePerHour: settleResult.totalRatePerHour,
        settledAmount: settleResult.amountSettled,
        completedHoursSettled: settleResult.completedHours,
        newBalance: settleResult.newBalance,
        lastCollectedAt: settleResult.lastSettledAt.toISOString(),
        msUntilNextHour: settleResult.msUntilNextHour,
        nextAdditionAt: settleResult.nextAdditionAt.toISOString(),
      });
    } catch {
      sendError(res, 'Failed to fetch mining status', 500, 'MINING_STATUS_ERROR');
    }
  }

  /**
   * POST /api/v1/mining/claim
   * Settles completed hours into main balance and resets hourly interval.
   */
  public static async claimEarnings(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const result = await MiningService.settleUserHourlyEarnings(userId);

      sendSuccess(res, {
        claimedAmount: result.amountSettled,
        newBalance: result.newBalance,
        completedHours: result.completedHours,
        msUntilNextHour: result.msUntilNextHour,
        nextAdditionAt: result.nextAdditionAt.toISOString(),
        message: result.settled
          ? `Added +${result.amountSettled} Poops to your main balance (${result.completedHours} hr${result.completedHours > 1 ? 's' : ''})!`
          : 'Hourly mining in progress. Next addition will occur when the hour completes.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Claiming failed';
      sendError(res, msg, 400, 'CLAIM_FAILED');
    }
  }
}


