import { Response } from 'express';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { env } from '../../config/env.js';

export class ReferralController {
  /**
   * GET /api/v1/referrals/stats
   */
  public static async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          sentReferrals: {
            select: { totalCommissionPoops: true, rewardPoops: true },
          },
          _count: {
            select: { referees: true },
          },
        },
      });

      if (!user) {
        sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
        return;
      }

      const totalBonusEarned = user.sentReferrals.reduce(
        (sum, r) => sum + Number(r.rewardPoops) + Number(r.totalCommissionPoops),
        0
      );

      sendSuccess(res, {
        referralCode: user.referralCode,
        friendsInvited: user._count.referees,
        commissionEarnedPoops: totalBonusEarned,
        commissionRatePercent: env.REFERRAL_COMMISSION_PERCENT,
      });
    } catch {
      sendError(res, 'Failed to fetch referral statistics', 500, 'REFERRAL_STATS_ERROR');
    }
  }
}
