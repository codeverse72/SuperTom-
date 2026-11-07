import { Response } from 'express';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';

export class AdminReferralController {
  /**
   * GET /api/v1/admin/referrals
   */
  public static async getReferralStats(_req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const [totalReferrals, totalCommissionsAgg, topReferrersRaw] = await Promise.all([
        prisma.referral.count(),
        prisma.referral.aggregate({
          _sum: { rewardPoops: true, totalCommissionPoops: true },
        }),
        prisma.user.findMany({
          take: 10,
          orderBy: { referees: { _count: 'desc' } },
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            referralCode: true,
            accountStatus: true,
            poopsBalance: true,
            _count: { select: { referees: true } },
          },
        }),
      ]);

      // Suspicious check: users with high referrals (>10) but account status suspended/banned or with abnormally high count
      const suspiciousAccounts = await prisma.user.findMany({
        where: {
          OR: [
            { accountStatus: { in: ['SUSPENDED', 'BANNED'] }, referees: { some: {} } },
          ],
        },
        take: 10,
        select: {
          id: true,
          telegramId: true,
          username: true,
          accountStatus: true,
          _count: { select: { referees: true } },
        },
      });

      sendSuccess(res, {
        overview: {
          totalReferrals,
          totalRewardsDistributed: Number(totalCommissionsAgg._sum.rewardPoops ?? 0n),
          totalCommissionsPaid: Number(totalCommissionsAgg._sum.totalCommissionPoops ?? 0n),
        },
        topReferrers: topReferrersRaw.map((u) => ({
          userId: u.id,
          telegramId: u.telegramId.toString(),
          username: u.username || u.firstName || 'Player',
          referralCode: u.referralCode,
          refereesCount: u._count.referees,
          balance: Number(u.poopsBalance),
          status: u.accountStatus,
        })),
        suspicious: suspiciousAccounts.map((s) => ({
          userId: s.id,
          telegramId: s.telegramId.toString(),
          username: s.username,
          status: s.accountStatus,
          refereesCount: s._count.referees,
        })),
      });
    } catch {
      sendError(res, 'Failed to fetch referral statistics', 500, 'SERVER_ERROR');
    }
  }
}
