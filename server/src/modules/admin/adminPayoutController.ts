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

const manualCreditDepositSchema = z.object({
  identifier: z.string().min(1, 'User Telegram ID or Username is required'),
  amountUsdt: z.number().positive('USDT amount must be greater than zero'),
  network: z.enum(['TRC20', 'TON', 'BEP20']).default('TRC20'),
  txHash: z.string().optional(),
  notes: z.string().min(3, 'Audit explanation required'),
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
      if (status && ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED'].includes(status)) {
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
          reviewedBy: req.admin?.email || adminId,
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
   * POST /api/v1/admin/withdrawals/:id/processing
   * Sets status to PROCESSING (funds preparing for on-chain transfer).
   */
  public static async markProcessing(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
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

      if (withdrawal.status !== 'PENDING' && withdrawal.status !== 'APPROVED') {
        sendError(res, `Cannot mark processing for withdrawal with status: ${withdrawal.status}`, 400, 'INVALID_STATUS');
        return;
      }

      const updated = await prisma.withdrawal.update({
        where: { id },
        data: {
          status: 'PROCESSING',
          reviewedAt: new Date(),
          reviewedBy: req.admin?.email || adminId,
        },
      });

      await recordAuditLog({
        adminId,
        action: 'MARK_WITHDRAWAL_PROCESSING',
        targetEntity: 'Withdrawal',
        targetId: id,
        previousValue: { status: withdrawal.status },
        newValue: { status: 'PROCESSING' },
        req,
      });

      sendSuccess(res, { id: updated.id, status: updated.status, message: 'Withdrawal marked as processing' });
    } catch {
      sendError(res, 'Failed to update withdrawal status', 500, 'SERVER_ERROR');
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
            reviewedBy: req.admin?.email || adminId,
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

      if (withdrawal.status === 'REJECTED') {
        sendError(res, 'Cannot complete a rejected withdrawal', 400, 'ALREADY_REJECTED');
        return;
      }

      const updated = await prisma.withdrawal.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          txHash: txHash.trim(),
          reviewedAt: new Date(),
          reviewedBy: req.admin?.email || adminId,
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

  /**
   * POST /api/v1/admin/deposits/manual-credit
   * Allows authorized admin to credit a user deposit directly (updates balance with audit log).
   */
  public static async manualCreditDeposit(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = manualCreditDepositSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Validation failed', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const { identifier, amountUsdt, network, txHash, notes } = parse.data;
    const cleanId = identifier.trim();

    try {
      // Find target user
      const isNumeric = /^\d+$/.test(cleanId);
      const targetUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: cleanId },
            { username: { equals: cleanId.replace(/^@/, ''), mode: 'insensitive' } },
            ...(isNumeric ? [{ telegramId: BigInt(cleanId) }] : []),
          ],
        },
      });

      if (!targetUser) {
        sendError(res, `Target user "${cleanId}" not found`, 404, 'USER_NOT_FOUND');
        return;
      }

      const amountPoops = BigInt(Math.round(amountUsdt * 2000));

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create confirmed deposit
        const deposit = await tx.deposit.create({
          data: {
            userId: targetUser.id,
            amountUsdt,
            amountPoops,
            network,
            txHash: txHash ? txHash.trim() : `admin_manual_${Date.now()}`,
            status: 'CONFIRMED',
            notes: `[Admin Manual Credit]: ${notes}`,
          },
        });

        // 2. Credit poops via ledger
        await LedgerService.executeBalanceTransaction(tx, {
          userId: targetUser.id,
          type: 'ADMIN_ADJUSTMENT',
          amount: amountPoops,
          referenceId: deposit.id,
          description: `Admin deposit credit of $${amountUsdt} USDT (${amountPoops} Poops). Reason: ${notes}`,
          idempotencyKey: `dep_manual_${deposit.id}`,
        });

        // 3. Return updated user
        const updatedUser = await tx.user.findUnique({
          where: { id: targetUser.id },
          select: { id: true, telegramId: true, username: true, poopsBalance: true },
        });

        return { deposit, updatedUser };
      });

      await recordAuditLog({
        adminId,
        action: 'MANUAL_DEPOSIT_CREDIT',
        targetEntity: 'Deposit',
        targetId: result.deposit.id,
        previousValue: { poopsBalance: targetUser.poopsBalance.toString() },
        newValue: {
          creditedUsdt: amountUsdt,
          creditedPoops: amountPoops.toString(),
          newBalance: result.updatedUser?.poopsBalance.toString(),
          notes,
        },
        req,
      });

      sendSuccess(res, {
        deposit: {
          id: result.deposit.id,
          amountUsdt: Number(result.deposit.amountUsdt),
          amountPoops: Number(result.deposit.amountPoops),
          network: result.deposit.network,
          txHash: result.deposit.txHash,
          status: result.deposit.status,
        },
        user: {
          id: result.updatedUser?.id,
          telegramId: result.updatedUser?.telegramId.toString(),
          username: result.updatedUser?.username,
          newBalance: Number(result.updatedUser?.poopsBalance),
        },
        message: `Successfully credited $${amountUsdt} USDT (${amountPoops} Poops) to @${result.updatedUser?.username || cleanId}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Manual credit deposit failed';
      sendError(res, msg, 400, 'MANUAL_CREDIT_FAILED');
    }
  }
}

