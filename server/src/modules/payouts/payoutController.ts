import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { validateNetworkAddress } from '../../utils/crypto.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { env } from '../../config/env.js';

const withdrawalRequestSchema = z.object({
  walletAddress: z.string().min(10, 'Wallet address is required'),
  amountPoops: z.number().int().min(env.MIN_WITHDRAWAL_POOPS, `Minimum withdrawal is ${env.MIN_WITHDRAWAL_POOPS} Poops (1.00 USDT)`),
  network: z.enum(['TRC20', 'TON', 'BEP20']).default('TRC20'),
});

const saveWalletSchema = z.object({
  walletAddress: z.string().min(10, 'Wallet address is required'),
  network: z.enum(['TRC20', 'TON', 'BEP20']).default('TRC20'),
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
        let statusTitle: 'Pending' | 'Approved' | 'Processing' | 'Completed' | 'Rejected' = 'Pending';
        if (w.status === 'APPROVED') statusTitle = 'Approved';
        else if (w.status === 'PROCESSING') statusTitle = 'Processing';
        else if (w.status === 'COMPLETED') statusTitle = 'Completed';
        else if (w.status === 'REJECTED') statusTitle = 'Rejected';

        return {
          id: w.id,
          timestamp: w.createdAt.getTime(),
          amountPoops: Number(w.amountPoops),
          amountUsdt: Number(w.amountUsdt),
          walletAddress: w.walletAddress,
          network: w.network as 'TRC20' | 'TON' | 'BEP20',
          status: statusTitle,
          txHash: w.txHash || undefined,
          rejectionReason: w.rejectionReason || undefined,
        };
      });

      sendSuccess(res, response);
    } catch {
      sendError(res, 'Failed to fetch payout history', 500, 'PAYOUT_HISTORY_ERROR');
    }
  }

  /**
   * POST /api/v1/payouts/request
   * Validates multi-network address, reserves balance atomically into pending payout queue.
   * STRICT SECURITY: Requires explicit administrative review. Never automates payouts.
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

    const { walletAddress, amountPoops, network } = parseResult.data;
    const cleanAddress = walletAddress.trim();

    // Multi-network cryptographic address validation
    const validation = validateNetworkAddress(network, cleanAddress);
    if (!validation.isValid) {
      sendError(res, validation.error || 'Invalid wallet address format', 400, 'INVALID_WALLET_ADDRESS');
      return;
    }

    const amountBig = BigInt(amountPoops);
    const amountUsdt = Number((amountPoops / env.POOPS_PER_USDT).toFixed(4));

    try {
      const withdrawal = await prisma.$transaction(async (tx) => {
        // 1. Verify user exists and has sufficient available balance
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { poopsBalance: true, accountStatus: true },
        });

        if (!user) {
          throw new Error('User not found');
        }

        if (user.accountStatus !== 'ACTIVE') {
          throw new Error('Account is restricted from requesting payouts');
        }

        if (user.poopsBalance < amountBig) {
          throw new Error(`Insufficient balance. Available: ${user.poopsBalance} Poops, Requested: ${amountBig} Poops`);
        }

        // 2. Reserve balance via LedgerService (atomic deduction)
        await LedgerService.executeBalanceTransaction(tx, {
          userId,
          type: 'WITHDRAWAL_RESERVATION',
          amount: -amountBig,
          description: `Withdrawal reservation of ${amountPoops} Poops (${amountUsdt} USDT) on ${network} to ${cleanAddress}`,
          idempotencyKey: `wd_${userId}_${Date.now()}`,
        });

        // 3. Save or update user wallet address
        await tx.userWallet.upsert({
          where: {
            userId_network_walletAddress: {
              userId,
              network,
              walletAddress: cleanAddress,
            },
          },
          create: {
            userId,
            network,
            walletAddress: cleanAddress,
            isDefault: true,
          },
          update: {
            updatedAt: new Date(),
          },
        });

        // 4. Create pending withdrawal record for manual admin review
        return tx.withdrawal.create({
          data: {
            userId,
            walletAddress: cleanAddress,
            amountPoops: amountBig,
            amountUsdt,
            network,
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
        network: withdrawal.network as 'TRC20' | 'TON' | 'BEP20',
        status: 'Pending' as const,
        txHash: undefined,
        message: 'Withdrawal request submitted successfully. Pending administrative review.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Withdrawal submission failed';
      sendError(res, msg, 400, 'WITHDRAWAL_FAILED');
    }
  }

  /**
   * GET /api/v1/payouts/wallets
   */
  public static async getWallets(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const wallets = await prisma.userWallet.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });

      sendSuccess(res, wallets);
    } catch {
      sendError(res, 'Failed to fetch saved wallets', 500, 'WALLET_FETCH_ERROR');
    }
  }

  /**
   * POST /api/v1/payouts/wallets
   */
  public static async saveWallet(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = saveWalletSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Validation failed', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const { walletAddress, network } = parse.data;
    const cleanAddress = walletAddress.trim();

    const validation = validateNetworkAddress(network, cleanAddress);
    if (!validation.isValid) {
      sendError(res, validation.error || 'Invalid wallet address format', 400, 'INVALID_WALLET_ADDRESS');
      return;
    }

    try {
      const wallet = await prisma.userWallet.upsert({
        where: {
          userId_network_walletAddress: {
            userId,
            network,
            walletAddress: cleanAddress,
          },
        },
        create: {
          userId,
          network,
          walletAddress: cleanAddress,
          isDefault: true,
        },
        update: {
          updatedAt: new Date(),
        },
      });

      sendSuccess(res, wallet);
    } catch {
      sendError(res, 'Failed to save wallet', 500, 'WALLET_SAVE_ERROR');
    }
  }
}

