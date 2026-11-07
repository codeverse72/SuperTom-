import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { WithdrawalStatus, DepositStatus } from '@prisma/client';

const completeWithdrawalSchema = z.object({
  txHash: z.string().min(10, 'Valid blockchain transaction hash required'),
});

const rejectWithdrawalSchema = z.object({
  rejectionReason: z.string().min(3, 'Rejection reason required'),
});

const confirmDepositSchema = z.object({
  txHash: z.string().min(10, 'Transaction hash required'),
});

export class AdminPayoutController {
  /**
   * GET /api/v1/admin/withdrawals
   */
  public static async listWithdrawals(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const status = req.query.status as WithdrawalStatus | undefined;
      const search = (req.query.search as string)?.trim();

      const where: any = {};
      if (status && ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'].includes(status)) {
        where.status = status;
      }

      if (search) {
        const isNumeric = /^\d+$/.test(search);
        where.OR = [
          { walletAddress: { contains: search, mode: 'insensitive' } },
          { txHash: { contains: search, mode: 'insensitive' } },
          { user: { username: { contains: search, mode: 'insensitive' } } },
          ...(isNumeric ? [{ user: { telegramId: BigInt(search) } }] : []),
        ];
      }

      const [total, withdrawals] = await Promise.all([
        prisma.withdrawal.count({ where }),
        prisma.withdrawal.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                telegramId: true,
                username: true,
                firstName: true,
                poopsBalance: true,
              },
            },
          },
        }),
      ]);

      sendSuccess(res, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        withdrawals: withdrawals.map((w) => ({
          id: w.id,
          userId: w.userId,
          telegramId: w.user.telegramId.toString(),
          username: w.user.username || w.user.firstName,
          currentBalance: Number(w.user.poopsBalance),
          amountPoops: Number(w.amountPoops),
          amountUsdt: Number(w.amountUsdt),
          walletAddress: w.walletAddress,
          network: w.network,
          status: w.status,
          txHash: w.txHash,
          rejectionReason: w.rejectionReason,
          reviewedAt: w.reviewedAt,
          createdAt: w.createdAt,
        })),
      });
    } catch {
      sendError(res, 'Failed to fetch withdrawals', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/withdrawals/:id/approve
   */
  public static async approveWithdrawal(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
      if (!withdrawal) {
        sendError(res, 'Withdrawal not found', 404, 'NOT_FOUND');
        return;
      }

      if (withdrawal.status !== 'PENDING') {
        sendError(res, `Cannot approve withdrawal with status: ${withdrawal.status}`, 400, 'INVALID_STATUS');
        return;
      }

      const updated = await prisma.withdrawal.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      });

      await recordAuditLog({
        adminId,
        action: 'APPROVE_WITHDRAWAL',
        targetEntity: 'Withdrawal',
        targetId: id,
        previousValue: { status: withdrawal.status },
        newValue: { status: 'APPROVED' },
        req,
      });

      sendSuccess(res, { id: updated.id, status: updated.status, message: 'Withdrawal approved for payout' });
    } catch {
      sendError(res, 'Failed to approve withdrawal', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/withdrawals/:id/reject
   * Automatically refunds the reserved Poops balance to the user.
   */
  public static async rejectWithdrawal(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = rejectWithdrawalSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Rejection reason is required', 422, 'VALIDATION_ERROR');
      return;
    }

    const { rejectionReason } = parse.data;

    try {
      await prisma.$transaction(async (tx) => {
        const withdrawal = await tx.withdrawal.findUnique({ where: { id } });
        if (!withdrawal) {
          throw new Error('Withdrawal not found');
        }

        if (withdrawal.status === 'COMPLETED' || withdrawal.status === 'REJECTED') {
          throw new Error(`Cannot reject withdrawal with status: ${withdrawal.status}`);
        }

        // 1. Mark as rejected
        await tx.withdrawal.update({
          where: { id },
          data: {
            status: 'REJECTED',
            rejectionReason,
            reviewedAt: new Date(),
          },
        });

        // 2. Refund reserved Poops via Ledger
        await LedgerService.executeBalanceTransaction(tx, {
          userId: withdrawal.userId,
          type: 'WITHDRAWAL_REFUND',
          amount: withdrawal.amountPoops, // positive credit
          referenceId: withdrawal.id,
          description: `Refund for rejected withdrawal: ${rejectionReason}`,
          idempotencyKey: `w_refund_${withdrawal.id}`,
        });
      });

      await recordAuditLog({
        adminId,
        action: 'REJECT_WITHDRAWAL',
        targetEntity: 'Withdrawal',
        targetId: id,
        newValue: { status: 'REJECTED', rejectionReason },
        req,
      });

      sendSuccess(res, { message: 'Withdrawal rejected and balance refunded successfully' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject withdrawal';
      sendError(res, msg, 400, 'REJECTION_FAILED');
    }
  }

  /**
   * POST /api/v1/admin/withdrawals/:id/complete
   * Records on-chain txHash and marks transaction COMPLETED.
   */
  public static async completeWithdrawal(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = completeWithdrawalSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Valid transaction hash is required', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const { txHash } = parse.data;

    try {
      const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
      if (!withdrawal) {
        sendError(res, 'Withdrawal not found', 404, 'NOT_FOUND');
        return;
      }

      if (withdrawal.status === 'COMPLETED') {
        sendError(res, 'Withdrawal is already marked completed', 400, 'ALREADY_COMPLETED');
        return;
      }

      const updated = await prisma.withdrawal.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          txHash: txHash.trim(),
          reviewedAt: new Date(),
        },
      });

      await recordAuditLog({
        adminId,
        action: 'COMPLETE_WITHDRAWAL',
        targetEntity: 'Withdrawal',
        targetId: id,
        previousValue: { status: withdrawal.status },
        newValue: { status: 'COMPLETED', txHash: txHash.trim() },
        req,
      });

      sendSuccess(res, {
        id: updated.id,
        status: updated.status,
        txHash: updated.txHash,
        message: 'Withdrawal marked as completed',
      });
    } catch {
      sendError(res, 'Failed to complete withdrawal', 500, 'SERVER_ERROR');
    }
  }

  /**
   * GET /api/v1/admin/deposits
   */
  public static async listDeposits(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const status = req.query.status as DepositStatus | undefined;

      const where: any = {};
      if (status && ['PENDING', 'CONFIRMED', 'REJECTED'].includes(status)) {
        where.status = status;
      }

      const [total, deposits] = await Promise.all([
        prisma.deposit.count({ where }),
        prisma.deposit.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { telegramId: true, username: true, firstName: true },
            },
          },
        }),
      ]);

      sendSuccess(res, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        deposits: deposits.map((d) => ({
          id: d.id,
          userId: d.userId,
          telegramId: d.user.telegramId.toString(),
          username: d.user.username || d.user.firstName,
          amountPoops: Number(d.amountPoops),
          amountUsdt: Number(d.amountUsdt),
          network: d.network,
          txHash: d.txHash,
          status: d.status,
          notes: d.notes,
          createdAt: d.createdAt,
        })),
      });
    } catch {
      sendError(res, 'Failed to fetch deposits', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/deposits/:id/confirm
   * Confirms deposit and credits user with Poops (2000 Poops / 1 USDT).
   */
  public static async confirmDeposit(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = confirmDepositSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Transaction hash required', 422, 'VALIDATION_ERROR');
      return;
    }

    const { txHash } = parse.data;

    try {
      await prisma.$transaction(async (tx) => {
        const deposit = await tx.deposit.findUnique({ where: { id } });
        if (!deposit) {
          throw new Error('Deposit not found');
        }

        if (deposit.status !== 'PENDING') {
          throw new Error(`Cannot confirm deposit with status: ${deposit.status}`);
        }

        await tx.deposit.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            txHash: txHash.trim(),
          },
        });

        // Credit Poops to user
        await LedgerService.executeBalanceTransaction(tx, {
          userId: deposit.userId,
          type: 'ADMIN_ADJUSTMENT',
          amount: deposit.amountPoops,
          referenceId: deposit.id,
          description: `Confirmed deposit of ${deposit.amountUsdt} USDT (${deposit.amountPoops} Poops)`,
          idempotencyKey: `dep_conf_${deposit.id}`,
        });
      });

      await recordAuditLog({
        adminId,
        action: 'CONFIRM_DEPOSIT',
        targetEntity: 'Deposit',
        targetId: id,
        newValue: { status: 'CONFIRMED', txHash },
        req,
      });

      sendSuccess(res, { message: 'Deposit confirmed and Poops credited to player' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deposit confirmation failed';
      sendError(res, msg, 400, 'CONFIRMATION_FAILED');
    }
  }
}
