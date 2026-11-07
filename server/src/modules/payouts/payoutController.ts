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
  network: z.string().min(2).default('TRC20'),
});

const saveWalletSchema = z.object({
  walletAddress: z.string().min(10, 'Wallet address is required'),
  network: z.string().min(2).default('TRC20'),
});

const submitDepositSchema = z.object({
  amountUsdt: z.number().positive('Deposit amount must be positive'),
  network: z.string().min(2, 'Network required'),
  txHash: z.string().min(6, 'Valid transaction hash is required'),
  notes: z.string().optional(),
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
          network: w.network,
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
        network: withdrawal.network,
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
   * GET /api/v1/payouts/treasury-wallets
   * Returns official deposit receiving addresses for all supported currencies
   */
  public static async getTreasuryWallets(_req: AuthenticatedRequest, res: Response): Promise<void> {
    sendSuccess(res, {
      wallets: {
        GRAM: {
          currency: 'GRAM',
          network: 'TON',
          address: process.env.TREASURY_TON_ADDRESS || 'EQBvW8Z5huBkMJYdn3PCDKNKKqiqXDjvjjx29JqYpn8SoGSq',
          hint: 'Send GRAM on TON network to this official address',
        },
        'USDT (BEP20)': {
          currency: 'USDT (BEP20)',
          network: 'BNB',
          address: process.env.TREASURY_EVM_ADDRESS || '0x71C8360216Ac3456952771bEc438F5e85d99623C',
          hint: 'Send USDT (BEP20) on BNB Smart Chain to this address',
        },
        'USDT (TRC20)': {
          currency: 'USDT (TRC20)',
          network: 'Tron',
          address: process.env.TREASURY_TRON_ADDRESS || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          hint: 'Send USDT (TRC20) on TRON network to this address',
        },
        BNB: {
          currency: 'BNB',
          network: 'BNB',
          address: process.env.TREASURY_EVM_ADDRESS || '0x71C8360216Ac3456952771bEc438F5e85d99623C',
          hint: 'Send BNB on BNB Smart Chain to this address',
        },
        TRX: {
          currency: 'TRX',
          network: 'Tron',
          address: process.env.TREASURY_TRON_ADDRESS || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          hint: 'Send TRX on TRON network to this address',
        },
        'SOL (Solana)': {
          currency: 'SOL (Solana)',
          network: 'Solana',
          address: process.env.TREASURY_SOLANA_ADDRESS || '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          hint: 'Send SOL on Solana network to this address',
        },
        'Base (USDC / ETH)': {
          currency: 'Base (USDC / ETH)',
          network: 'Base',
          address: process.env.TREASURY_BASE_ADDRESS || process.env.TREASURY_EVM_ADDRESS || '0x71C8360216Ac3456952771bEc438F5e85d99623C',
          hint: 'Send USDC or ETH on Base network to this address',
        },
      },
      rate: {
        poopsPerUsdt: env.POOPS_PER_USDT,
        minWithdrawalPoops: env.MIN_WITHDRAWAL_POOPS,
      },
    });
  }

  /**
   * GET /api/v1/payouts/deposits
   * Fetch player's personal deposit history
   */
  public static async getDeposits(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const records = await prisma.deposit.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const response = records.map((d) => {
        let statusTitle: 'Pending' | 'Confirmed' | 'Rejected' = 'Pending';
        if (d.status === 'CONFIRMED') statusTitle = 'Confirmed';
        else if (d.status === 'REJECTED') statusTitle = 'Rejected';

        return {
          id: d.id,
          timestamp: d.createdAt.getTime(),
          amountUsdt: Number(d.amountUsdt),
          amountPoops: Number(d.amountPoops),
          network: d.network,
          txHash: d.txHash || undefined,
          status: statusTitle,
          notes: d.notes || undefined,
        };
      });

      sendSuccess(res, response);
    } catch {
      sendError(res, 'Failed to fetch deposits', 500, 'DEPOSITS_FETCH_ERROR');
    }
  }

  /**
   * POST /api/v1/payouts/deposits
   * Submit transaction hash and details for verification
   */
  public static async submitDeposit(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parseResult = submitDepositSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 'Validation failed', 422, 'VALIDATION_ERROR', parseResult.error.format());
      return;
    }

    const { amountUsdt, network, txHash, notes } = parseResult.data;
    const cleanHash = txHash.trim();

    try {
      // Check for duplicate txHash
      const existing = await prisma.deposit.findUnique({
        where: { txHash: cleanHash },
      });

      if (existing) {
        sendError(res, 'This transaction hash has already been submitted for verification.', 400, 'DUPLICATE_TX_HASH');
        return;
      }

      const amountPoops = BigInt(Math.round(amountUsdt * env.POOPS_PER_USDT));

      const deposit = await prisma.deposit.create({
        data: {
          userId,
          amountUsdt,
          amountPoops,
          network,
          txHash: cleanHash,
          status: 'PENDING',
          notes: notes ? notes.trim() : `User submitted deposit on ${network}`,
        },
      });

      sendSuccess(res, {
        id: deposit.id,
        timestamp: deposit.createdAt.getTime(),
        amountUsdt: Number(deposit.amountUsdt),
        amountPoops: Number(deposit.amountPoops),
        network: deposit.network,
        txHash: deposit.txHash,
        status: 'Pending' as const,
        message: 'Deposit proof submitted successfully. Pending admin on-chain verification.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deposit submission failed';
      sendError(res, msg, 400, 'DEPOSIT_FAILED');
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
