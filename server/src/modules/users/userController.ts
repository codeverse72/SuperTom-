import { Response } from 'express';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { env } from '../../config/env.js';
import { MiningService } from '../mining/miningService.js';

export class UserController {
  /**
   * GET /api/v1/user/me
   */
  public static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      // Auto-settle any completed hours into main balance (Option A)
      await MiningService.settleUserHourlyEarnings(userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          receivedReferral: true,
          _count: {
            select: {
              referees: true,
              feedingEvents: true,
              userMissions: { where: { status: 'CLAIMED' } },
            },
          },
        },
      });

      if (!user) {
        sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
        return;
      }

      sendSuccess(res, {
        userId: user.id,
        telegramId: user.telegramId.toString(),
        username: user.username || 'TomPlayer',
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.photoUrl || '/assets/dashboard/avatar.png',
        level: user.level,
        levelTitle: user.levelTitle,
        referralCode: user.referralCode,
        friendsInvited: user._count.referees,
        totalBiscuitsFed: user._count.feedingEvents,
        totalMissionsDone: user._count.userMissions,
        languageCode: user.languageCode || 'en',
        createdAt: user.createdAt.toISOString(),
      });
    } catch {
      sendError(res, 'Failed to retrieve profile', 500, 'SERVER_ERROR');
    }
  }

  /**
   * GET /api/v1/user/balance
   */
  public static async getBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      // Auto-settle any completed hours into main balance (Option A)
      await MiningService.settleUserHourlyEarnings(userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          poopsBalance: true,
          updatedAt: true,
          withdrawals: {
            where: { status: 'PENDING' },
            select: { amountPoops: true },
          },
        },
      });

      if (!user) {
        sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
        return;
      }

      const balanceNum = Number(user.poopsBalance);
      const lockedNum = user.withdrawals.reduce((sum, w) => sum + Number(w.amountPoops), 0);
      const usdtVal = Number((balanceNum / env.POOPS_PER_USDT).toFixed(4));

      sendSuccess(res, {
        balancePoops: balanceNum,
        usdtEquivalent: usdtVal,
        lockedPoops: lockedNum,
        lastUpdated: user.updatedAt.toISOString(),
      });
    } catch {
      sendError(res, 'Failed to retrieve balance', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/user/language
   * Updates user's preferred language (en, fa, ru, fr).
   */
  public static async updateLanguage(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const { languageCode } = req.body as { languageCode?: string };
    const clean = (languageCode || 'en').toLowerCase().trim();
    const validLangs = ['en', 'fa', 'ru', 'fr'];
    const chosen = validLangs.includes(clean) ? clean : 'en';

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { languageCode: chosen },
      });
      sendSuccess(res, { languageCode: chosen, message: 'Language preference updated successfully.' });
    } catch {
      sendError(res, 'Failed to update language', 500, 'SERVER_ERROR');
    }
  }
}

