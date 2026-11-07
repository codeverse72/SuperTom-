import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { isValidTronAddress } from '../../utils/crypto.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { env } from '../../config/env.js';

const withdrawalRequestSchema = z.object({
  walletAddress: z.string().min(30, 'TRON address is required'),
  amountPoops: z.number().int().min(env.MIN_WITHDRAWAL_POOPS, `Minimum withdrawal is ${env.MIN_WITHDRAWAL_POOPS} Poops (1.00 USDT)`),
  network: z.literal('TRC20').default('TRC20'),
});

export class PayoutController {
  /**
   * GET /api/v1/payouts/history
   */
  public static async getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const records = await prisma.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const response = records.map((w) => {
        let statusTitle: 'Pending' | 'Approved' | 'Completed' | 'Rejected' = 'Pending';
        if (w.status === 'APPROVED') statusTitle = 'Approved';
        else if (w.status === 'COMPLETED') statusTitle = 'Completed';
        else if (w.status === 'REJECTED') statusTitle = 'Rejected';

        return {
          id: w.id,
          timestamp: w.createdAt.getTime(),
          amountPoops: Number(w.amountPoops),
          amountUsdt: Number(w.amountUsdt),
          walletAddress: w.walletAddress,
          network: 'TRC20' as const,
          status: statusTitle,
          txHash: w.txHash || undefined,
        };
      });

      sendSuccess(res, response);
    } catch {
      sendError(res, 'Failed to fetch payout history', 500, 'PAYOUT_HISTORY_ERROR');
    }
  }

  /**
   * POST /api/v1/payouts/request
   * Validates TRC20 address, reserves balance atomically into pending payout queue.
   */
  public static async requestWithdrawal(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parseResult = withdrawalRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 'Validation failed', 422, 'VALIDATION_ERROR', parseResult.error.format());
      return;
    }

    const { walletAddress, amountPoops } = parseResult.data;

    // Cryptographic TRON address format validation
    if (!isValidTronAddress(walletAddress)) {
      sendError(
        res,
        'Invalid TRON TRC20 address format. Address must begin with "T" and contain 34 characters.',
        400,
        'INVALID_TRON_ADDRESS'
      );
      return;
    }

    const amountBig = BigInt(amountPoops);
    const amountUsdt = Number((amountPoops / env.POOPS_PER_USDT).toFixed(4));

    try {
      const withdrawal = await prisma.$transaction(async (tx) => {
        // 1. Reserve balance via LedgerService (deducts available poops balance)
        await LedgerService.executeBalanceTransaction(tx, {
          userId,
          type: 'WITHDRAWAL_RESERVATION',
          amount: -amountBig,
          description: `Withdrawal reservation of ${amountPoops} Poops to ${walletAddress}`,
          idempotencyKey: `wd_${userId}_${Date.now()}`,
        });

        // 2. Create pending withdrawal record for manual admin review
        return tx.withdrawal.create({
          data: {
            userId,
            walletAddress,
            amountPoops: amountBig,
            amountUsdt,
            network: 'TRC20',
            status: 'PENDING',
          },
        });
      });

      sendSuccess(res, {
        id: withdrawal.id,
        timestamp: withdrawal.createdAt.getTime(),
        amountPoops: Number(withdrawal.amountPoops),
        amountUsdt: Number(withdrawal.amountUsdt),
        walletAddress: withdrawal.walletAddress,
        network: 'TRC20' as const,
        status: 'Pending' as const,
        txHash: undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Withdrawal submission failed';
      sendError(res, msg, 400, 'WITHDRAWAL_FAILED');
    }
  }
}

