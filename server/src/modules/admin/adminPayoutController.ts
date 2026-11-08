import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { CampaignService } from '../campaign/campaignService.js';
import { WithdrawalStatus, DepositStatus } from '@prisma/client';

const completeWithdrawalSchema = z.object({
  txHash: z.string().min(10, 'Valid blockchain transaction hash required'),
});

const rejectWithdrawalSchema = z.object({
  rejectionReason: z.string().min(3, 'Rejection reason required'),
});

const confirmDepositSchema = z.object({
  txHash: z.string().min(6, 'Transaction hash required'),
  boostPerHour: z.number().int().min(0).optional(),
});

const manualCreditDepositSchema = z.object({
  identifier: z.string().min(1, 'User Telegram ID or Username is required'),
  amountUsdt: z.number().positive('USDT amount must be greater than zero'),
  network: z.string().default('TRC20'),
  txHash: z.string().optional(),
  notes: z.string().min(3, 'Audit explanation required'),
  boostPerHour: z.number().int().min(0).default(0),
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

      const [total, withdrawals, completedStats, pendingCount, processingCount] = await Promise.all([
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
        prisma.withdrawal.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { amountUsdt: true, amountPoops: true },
        }),
        prisma.withdrawal.count({ where: { status: 'PENDING' } }),
        prisma.withdrawal.count({ where: { status: 'PROCESSING' } }),
      ]);

      sendSuccess(res, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: {
          totalCompletedUsdt: Number(completedStats._sum.amountUsdt || 0),
          totalCompletedPoops: Number(completedStats._sum.amountPoops || 0),
          pendingCount,
          processingCount,
        },
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

      const [total, deposits, confirmedStats, pendingCount] = await Promise.all([
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
        prisma.deposit.aggregate({
          where: { status: 'CONFIRMED' },
          _sum: { amountUsdt: true, amountPoops: true },
        }),
        prisma.deposit.count({ where: { status: 'PENDING' } }),
      ]);

      sendSuccess(res, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: {
          totalConfirmedUsdt: Number(confirmedStats._sum.amountUsdt || 0),
          totalConfirmedPoops: Number(confirmedStats._sum.amountPoops || 0),
          pendingCount,
        },
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

    const { txHash, boostPerHour } = parse.data;

    try {
      let appliedBoost = boostPerHour || 0;

      await prisma.$transaction(async (tx) => {
        const deposit = await tx.deposit.findUnique({ where: { id } });
        if (!deposit) {
          throw new Error('Deposit not found');
        }

        if (!['PENDING', 'WAITING_FOR_PAYMENT', 'PAYMENT_DETECTED', 'CONFIRMING'].includes(deposit.status)) {
          throw new Error(`Cannot confirm deposit with status: ${deposit.status}`);
        }

        // Auto-detect mining plan boost from deposit notes if not explicitly passed
        if (!appliedBoost && deposit.notes) {
          const n = deposit.notes.toLowerCase();
          if (n.includes('+1000') || n.includes('diamond')) appliedBoost = 1000;
          else if (n.includes('+200') || n.includes('gold')) appliedBoost = 200;
          else if (n.includes('+50') || n.includes('silver')) appliedBoost = 50;
          else if (n.includes('+10') || n.includes('common')) appliedBoost = 10;
        }

        await tx.deposit.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            txHash: txHash.trim(),
            confirmedAt: new Date(),
          },
        });

        // 1. Credit Poops to user balance via Ledger
        await LedgerService.executeBalanceTransaction(tx, {
          userId: deposit.userId,
          type: 'DEPOSIT_CREDIT',
          amount: deposit.amountPoops,
          referenceId: deposit.id,
          description: `Confirmed deposit of ${deposit.amountUsdt} USDT (${deposit.amountPoops} Poops)`,
          idempotencyKey: `dep_conf_${deposit.id}`,
        });

        // 1.5 Process 5K Members Celebration Campaign Enrollment & 30% Instant Cashback
        try {
          await CampaignService.processDepositForCampaign(tx, {
            id: deposit.id,
            userId: deposit.userId,
            amountUsdt: deposit.amountUsdt,
          });
        } catch (cErr) {
          console.error('[AdminPayout] Campaign processing error in confirmDeposit:', cErr);
        }

        // 2. Adjust mining speed if a plan boost applies
        if (appliedBoost > 0) {
          await tx.miningSettlement.update({
            where: { userId: deposit.userId },
            data: {
              boostRatePerHour: { increment: appliedBoost },
              totalRatePerHour: { increment: appliedBoost },
            },
          });
        }
      });

      await recordAuditLog({
        adminId,
        action: 'CONFIRM_DEPOSIT',
        targetEntity: 'Deposit',
        targetId: id,
        newValue: { status: 'CONFIRMED', txHash, appliedBoost },
        req,
      });

      sendSuccess(res, {
        message: appliedBoost > 0 
          ? `Deposit confirmed! Poops credited and mining speed boosted by +${appliedBoost}/hr.`
          : 'Deposit confirmed and Poops credited to player',
      });
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

    const { identifier, amountUsdt, network, txHash, notes, boostPerHour } = parse.data;
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
            notes: `[Admin Manual Credit]: ${notes}${boostPerHour > 0 ? ` (+${boostPerHour}/hr boost)` : ''}`,
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

        // 2.5 Process 5K Members Celebration Campaign Enrollment & 30% Instant Cashback
        try {
          await CampaignService.processDepositForCampaign(tx, {
            id: deposit.id,
            userId: targetUser.id,
            amountUsdt: deposit.amountUsdt,
          });
        } catch (cErr) {
          console.error('[AdminPayout] Campaign processing error in manualCreditDeposit:', cErr);
        }

        // 3. Adjust mining speed if a plan boost applies
        if (boostPerHour > 0) {
          await tx.miningSettlement.update({
            where: { userId: targetUser.id },
            data: {
              boostRatePerHour: { increment: boostPerHour },
              totalRatePerHour: { increment: boostPerHour },
            },
          });
        }

        // 4. Return updated user & mining rate
        const [updatedUser, updatedSettlement] = await Promise.all([
          tx.user.findUnique({
            where: { id: targetUser.id },
            select: { id: true, telegramId: true, username: true, poopsBalance: true },
          }),
          tx.miningSettlement.findUnique({
            where: { userId: targetUser.id },
            select: { totalRatePerHour: true },
          }),
        ]);

        return { deposit, updatedUser, rate: updatedSettlement?.totalRatePerHour };
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
          boostPerHour,
          newRate: result.rate,
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
          productionRate: result.rate,
        },
        message: `Successfully credited $${amountUsdt} USDT (${amountPoops} Poops) to @${result.updatedUser?.username || cleanId}${boostPerHour > 0 ? ` with +${boostPerHour}/hr mining speed boost!` : '!'}`
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Manual credit deposit failed';
      sendError(res, msg, 400, 'MANUAL_CREDIT_FAILED');
    }
  }

  /**
   * GET /api/v1/admin/treasury-settings
   * Fetches receiving Trust Wallet addresses from DB SystemSetting
   */
  public static async getTreasurySettings(_req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: [
              'TRUST_WALLET_EVM_ADDRESS',
              'TRUST_WALLET_TRON_ADDRESS',
              'TRUST_WALLET_TON_ADDRESS',
              'TRUST_WALLET_SOL_ADDRESS',
            ],
          },
        },
      });

      const map: Record<string, string> = {};
      settings.forEach((s) => {
        map[s.key] = s.value;
      });

      sendSuccess(res, {
        trustWalletEvm: map['TRUST_WALLET_EVM_ADDRESS'] || process.env.TREASURY_EVM_ADDRESS || process.env.TRUST_WALLET_EVM_ADDRESS || '0x71C8360216Ac3456952771bEc438F5e85d99623C',
        trustWalletTron: map['TRUST_WALLET_TRON_ADDRESS'] || process.env.TREASURY_TRON_ADDRESS || process.env.TREASURY_TRON_ADORESS || process.env.TRUST_WALLET_TRON_ADDRESS || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        trustWalletTon: map['TRUST_WALLET_TON_ADDRESS'] || process.env.TREASURY_TON_ADDRESS || process.env.TRUST_WALLET_TON_ADDRESS || 'EQBvW8Z5huBkMJYdn3PCDKNKKqiqXDjvjjx29JqYpn8SoGSq',
        trustWalletSol: map['TRUST_WALLET_SOL_ADDRESS'] || process.env.TREASURY_SOL_ADDRESS || process.env.TRUST_WALLET_SOL_ADDRESS || '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      });
    } catch {
      sendError(res, 'Failed to fetch treasury settings', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/treasury-settings
   * Updates receiving Trust Wallet addresses in DB SystemSetting with audit logging
   */
  public static async updateTreasurySettings(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const { trustWalletEvm, trustWalletTron, trustWalletTon, trustWalletSol } = req.body;

    try {
      const updates: Array<{ key: string; value: string; desc: string }> = [];
      if (trustWalletEvm) updates.push({ key: 'TRUST_WALLET_EVM_ADDRESS', value: trustWalletEvm.trim(), desc: 'Trust Wallet BSC/EVM Treasury' });
      if (trustWalletTron) updates.push({ key: 'TRUST_WALLET_TRON_ADDRESS', value: trustWalletTron.trim(), desc: 'Trust Wallet TRON Treasury' });
      if (trustWalletTon) updates.push({ key: 'TRUST_WALLET_TON_ADDRESS', value: trustWalletTon.trim(), desc: 'Trust Wallet TON Treasury' });
      if (trustWalletSol) updates.push({ key: 'TRUST_WALLET_SOL_ADDRESS', value: trustWalletSol.trim(), desc: 'Trust Wallet Solana Treasury' });

      for (const item of updates) {
        await prisma.systemSetting.upsert({
          where: { key: item.key },
          create: { key: item.key, value: item.value, description: item.desc },
          update: { value: item.value, updatedAt: new Date() },
        });
      }

      await recordAuditLog({
        adminId,
        action: 'UPDATE_TREASURY_SETTINGS',
        targetEntity: 'SystemSetting',
        newValue: { updates },
        req,
      });

      sendSuccess(res, { message: 'Trust Wallet treasury receiving addresses updated successfully!' });
    } catch {
      sendError(res, 'Failed to update treasury settings', 500, 'SERVER_ERROR');
    }
  }
}

