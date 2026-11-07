import { Response } from 'express';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';

export class AdminDashboardController {
  /**
   * GET /api/v1/admin/dashboard/stats
   */
  public static async getStats(_req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

      // 1. User Metrics
      const [
        totalUsers,
        activeUsers,
        suspendedUsers,
        bannedUsers,
        newUsersLast24h,
        circulationAgg,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { accountStatus: 'ACTIVE' } }),
        prisma.user.count({ where: { accountStatus: 'SUSPENDED' } }),
        prisma.user.count({ where: { accountStatus: 'BANNED' } }),
        prisma.user.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
        prisma.user.aggregate({ _sum: { poopsBalance: true } }),
      ]);

      // 2. Financial Metrics: Mining & Withdrawals & Deposits
      const [
        totalMinedAgg,
        pendingWithdrawalsAgg,
        completedWithdrawalsAgg,
        confirmedDepositsAgg,
      ] = await Promise.all([
        prisma.ledgerEntry.aggregate({
          where: { type: 'MINING_SETTLEMENT' },
          _sum: { amount: true },
        }),
        prisma.withdrawal.aggregate({
          where: { status: 'PENDING' },
          _count: { id: true },
          _sum: { amountUsdt: true, amountPoops: true },
        }),
        prisma.withdrawal.aggregate({
          where: { status: 'COMPLETED' },
          _count: { id: true },
          _sum: { amountUsdt: true, amountPoops: true },
        }),
        prisma.deposit.aggregate({
          where: { status: 'CONFIRMED' },
          _count: { id: true },
          _sum: { amountUsdt: true, amountPoops: true },
        }),
      ]);

      // 3. Quest & Referral Metrics
      const [totalMissions, completedMissions, totalReferrals, referralBonusesAgg] =
        await Promise.all([
          prisma.mission.count(),
          prisma.userMission.count({ where: { status: 'CLAIMED' } }),
          prisma.referral.count(),
          prisma.referral.aggregate({ _sum: { rewardPoops: true } }),
        ]);

      // 4. Last 7 Days Registrations & Volume for Charts
      const recentUsers = await prisma.user.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      });

      // Group registrations by YYYY-MM-DD
      const growthMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
        const key = d.toISOString().split('T')[0];
        growthMap[key] = 0;
      }
      for (const u of recentUsers) {
        const key = u.createdAt.toISOString().split('T')[0];
        if (growthMap[key] !== undefined) {
          growthMap[key]++;
        }
      }

      const growthChart = Object.entries(growthMap).map(([date, count]) => ({
        date,
        count,
      }));

      // 5. Recent Activity
      const [recentWithdrawals, recentAuditLogs] = await Promise.all([
        prisma.withdrawal.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { telegramId: true, username: true, firstName: true },
            },
          },
        }),
        prisma.adminAuditLog.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { admin: { select: { name: true, role: true } } },
        }),
      ]);

      sendSuccess(res, {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          banned: bannedUsers,
          newLast24h: newUsersLast24h,
          growthChart,
        },
        economy: {
          poopsInCirculation: Number(circulationAgg._sum.poopsBalance ?? 0n),
          totalPoopsMined: Number(totalMinedAgg._sum.amount ?? 0n),
          usdtExchangeRate: 2000,
        },
        withdrawals: {
          pendingCount: pendingWithdrawalsAgg._count.id,
          pendingUsdt: Number(pendingWithdrawalsAgg._sum.amountUsdt ?? 0),
          completedCount: completedWithdrawalsAgg._count.id,
          completedUsdt: Number(completedWithdrawalsAgg._sum.amountUsdt ?? 0),
        },
        deposits: {
          confirmedCount: confirmedDepositsAgg._count.id,
          confirmedUsdt: Number(confirmedDepositsAgg._sum.amountUsdt ?? 0),
        },
        missions: {
          totalCatalog: totalMissions,
          totalCompleted: completedMissions,
        },
        referrals: {
          totalReferrals,
          totalBonusesDistributed: Number(referralBonusesAgg._sum.rewardPoops ?? 0n),
        },
        recentActivity: {
          withdrawals: recentWithdrawals.map((w) => ({
            id: w.id,
            username: w.user.username || w.user.firstName || w.user.telegramId.toString(),
            amountUsdt: Number(w.amountUsdt),
            status: w.status,
            createdAt: w.createdAt,
          })),
          auditLogs: recentAuditLogs.map((l) => ({
            id: l.id,
            adminName: l.admin.name,
            role: l.admin.role,
            action: l.action,
            targetEntity: l.targetEntity,
            createdAt: l.createdAt,
          })),
        },
      });
    } catch {
      sendError(res, 'Failed to fetch dashboard statistics', 500, 'SERVER_ERROR');
    }
  }
}

