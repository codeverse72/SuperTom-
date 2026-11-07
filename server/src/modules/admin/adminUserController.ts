import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';
import { AccountStatus } from '@prisma/client';
import { LedgerService } from '../ledger/ledgerService.js';

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
  reason: z.string().optional(),
});

const adjustBalanceSchema = z.object({
  amountPoops: z.number().int().refine((val) => val !== 0, 'Amount cannot be 0'),
  reason: z.string().min(3, 'Audit reason required'),
});

export class AdminUserController {
  /**
   * GET /api/v1/admin/users
   */
  public static async listUsers(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const search = (req.query.search as string)?.trim();
      const status = req.query.status as AccountStatus | undefined;

      const where: any = {};
      if (status && ['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) {
        where.accountStatus = status;
      }

      if (search) {
        const isNumeric = /^\d+$/.test(search);
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { referralCode: { contains: search, mode: 'insensitive' } },
          ...(isNumeric ? [{ telegramId: BigInt(search) }] : []),
        ];
      }

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            miningSettlement: { select: { totalRatePerHour: true } },
            _count: { select: { referees: true, feedingEvents: true } },
          },
        }),
      ]);

      sendSuccess(res, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        users: users.map((u) => ({
          id: u.id,
          telegramId: u.telegramId.toString(),
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          poopsBalance: Number(u.poopsBalance),
          level: u.level,
          levelTitle: u.levelTitle,
          accountStatus: u.accountStatus,
          miningRate: u.miningSettlement?.totalRatePerHour ?? 10,
          referralCode: u.referralCode,
          refereesCount: u._count.referees,
          feedingCount: u._count.feedingEvents,
          createdAt: u.createdAt,
        })),
      });
    } catch {
      sendError(res, 'Failed to fetch users', 500, 'SERVER_ERROR');
    }
  }

  /**
   * GET /api/v1/admin/users/:id
   */
  public static async getUserDetail(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          miningSettlement: true,
          spinState: true,
          inventories: { include: { biscuit: true } },
          withdrawals: { orderBy: { createdAt: 'desc' }, take: 10 },
          deposits: { orderBy: { createdAt: 'desc' }, take: 10 },
          ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 20 },
          _count: { select: { referees: true, feedingEvents: true, userMissions: true } },
        },
      });

      if (!user) {
        sendError(res, 'User not found', 404, 'NOT_FOUND');
        return;
      }

      sendSuccess(res, {
        id: user.id,
        telegramId: user.telegramId.toString(),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        languageCode: user.languageCode,
        poopsBalance: Number(user.poopsBalance),
        level: user.level,
        levelTitle: user.levelTitle,
        referralCode: user.referralCode,
        referredById: user.referredById,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        mining: {
          baseRate: user.miningSettlement?.baseRatePerHour ?? 10,
          boostRate: user.miningSettlement?.boostRatePerHour ?? 0,
          totalRate: user.miningSettlement?.totalRatePerHour ?? 10,
          lastSettledAt: user.miningSettlement?.lastSettledAt,
        },
        spin: {
          currentMilestone: user.spinState?.currentMilestone ?? 1,
          cycleCount: user.spinState?.cycleCount ?? 1,
          nextUnlockAt: user.spinState?.nextUnlockAt,
          claimedMilestones: user.spinState?.claimedMilestones,
        },
        inventory: user.inventories.map((inv) => ({
          biscuitId: inv.biscuitId,
          name: inv.biscuit.name,
          quantity: inv.quantity,
          boostPerHour: inv.biscuit.productionBoostPerHour,
        })),
        counts: {
          referees: user._count.referees,
          feedingEvents: user._count.feedingEvents,
          missionsDone: user._count.userMissions,
        },
        withdrawals: user.withdrawals.map((w) => ({
          id: w.id,
          amountPoops: Number(w.amountPoops),
          amountUsdt: Number(w.amountUsdt),
          address: w.walletAddress,
          status: w.status,
          txHash: w.txHash,
          createdAt: w.createdAt,
        })),
        deposits: user.deposits.map((d) => ({
          id: d.id,
          amountPoops: Number(d.amountPoops),
          amountUsdt: Number(d.amountUsdt),
          status: d.status,
          txHash: d.txHash,
          createdAt: d.createdAt,
        })),
        recentTransactions: user.ledgerEntries.map((l) => ({
          id: l.id,
          type: l.type,
          amount: Number(l.amount),
          balanceAfter: Number(l.balanceAfter),
          description: l.description,
          createdAt: l.createdAt,
        })),
      });
    } catch {
      sendError(res, 'Failed to retrieve user details', 500, 'SERVER_ERROR');
    }
  }

  /**
   * PATCH /api/v1/admin/users/:id/status
   */
  public static async updateStatus(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = statusSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid status', 422, 'VALIDATION_ERROR');
      return;
    }

    const { status, reason } = parse.data;

    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        sendError(res, 'User not found', 404, 'NOT_FOUND');
        return;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { accountStatus: status },
      });

      await recordAuditLog({
        adminId,
        action: `USER_STATUS_${status}`,
        targetEntity: 'User',
        targetId: user.id,
        previousValue: { accountStatus: user.accountStatus },
        newValue: { accountStatus: status, reason },
        req,
      });

      sendSuccess(res, {
        id: updated.id,
        accountStatus: updated.accountStatus,
        message: `Account status updated to ${status}`,
      });
    } catch {
      sendError(res, 'Failed to update user status', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/users/:id/adjust-balance
   */
  public static async adjustBalance(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = adjustBalanceSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid adjustment parameters', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const { amountPoops, reason } = parse.data;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id },
          select: { id: true, poopsBalance: true },
        });

        if (!user) {
          throw new Error('User not found');
        }

        const bigIntAmount = BigInt(amountPoops);
        if (bigIntAmount < 0n && user.poopsBalance + bigIntAmount < 0n) {
          throw new Error('Adjustment would result in negative user balance');
        }

        const txResult = await LedgerService.executeBalanceTransaction(tx, {
          userId: user.id,
          type: 'ADMIN_ADJUSTMENT',
          amount: bigIntAmount,
          description: `Admin manual adjustment: ${reason}`,
          idempotencyKey: `admin_adj_${Date.now()}_${user.id}`,
        });

        return {
          userId: user.id,
          balanceBefore: Number(txResult.balanceBefore),
          balanceAfter: Number(txResult.balanceAfter),
          amount: amountPoops,
        };
      });

      await recordAuditLog({
        adminId,
        action: 'ADMIN_BALANCE_ADJUSTMENT',
        targetEntity: 'User',
        targetId: id,
        previousValue: { balance: result.balanceBefore },
        newValue: { balance: result.balanceAfter, amount: amountPoops, reason },
        req,
      });

      sendSuccess(res, result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Balance adjustment failed';
      sendError(res, msg, 400, 'ADJUSTMENT_FAILED');
    }
  }
}
