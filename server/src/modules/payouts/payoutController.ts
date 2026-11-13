import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { validateNetworkAddress } from '../../utils/crypto.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { DepositVerificationService } from './depositVerificationService.js';
import { WithdrawalEntitlementService } from './withdrawalEntitlementService.js';
import { AutoDepositMonitor } from './autoDepositMonitor.js';

const withdrawalRequestSchema = z.object({
  walletAddress: z.string().min(10, 'Wallet address is required'),
  amountPoops: z.number().int().min(env.MIN_WITHDRAWAL_POOPS, `Minimum withdrawal is ${env.MIN_WITHDRAWAL_POOPS} TomCoins (1.00 USDT)`),
  network: z.string().min(2).default('TRC20'),
});

const saveWalletSchema = z.object({
  walletAddress: z.string().min(10, 'Wallet address is required'),
  network: z.string().min(2).default('TRC20'),
});

const createDepositSchema = z.object({
  amountUsdt: z.number().min(0.5, 'Minimum deposit is $0.50 USDT').max(10000, 'Maximum deposit is $10,000 USDT'),
  currency: z.string().min(2),
  network: z.string().min(2),
  notes: z.string().optional(),
});

const verifyDepositSchema = z.object({
  txHash: z.string().min(6, 'Valid transaction hash is required'),
  amountUsdt: z.number().min(0.5).optional(),
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
   * GET /api/v1/payouts/entitlement
   * Returns whether user can withdraw, quota remaining, or unlimited status.
   */
  public static async getEntitlement(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const entitlement = await WithdrawalEntitlementService.getUserEntitlement(userId);
      sendSuccess(res, entitlement);
    } catch {
      sendError(res, 'Failed to fetch withdrawal entitlement', 500, 'ENTITLEMENT_ERROR');
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
          throw new Error(`Insufficient balance. Available: ${user.poopsBalance} TomCoins, Requested: ${amountBig} TomCoins`);
        }

        // 1.5 Strictly enforce deposit requirement for withdrawals:
        // $3 deposit unlocks 3 withdrawals, $5 deposit unlocks unlimited withdrawals
        await WithdrawalEntitlementService.validateAndConsumeWithdrawal(tx, userId);

        // 2. Reserve balance via LedgerService (atomic deduction)
        await LedgerService.executeBalanceTransaction(tx, {
          userId,
          type: 'WITHDRAWAL_RESERVATION',
          amount: -amountBig,
          description: `Withdrawal reservation of ${amountPoops} TomCoins (${amountUsdt} USDT) on ${network} to ${cleanAddress}`,
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
      if ((err as any)?.code === 'WITHDRAWAL_DEPOSIT_REQUIRED') {
        sendError(
          res,
          'A deposit of $3.00 (for 3 withdrawals), $5.00 (for unlimited withdrawals), or watching 30 ads/day for 5 days is required to unlock payouts.',
          403,
          'WITHDRAWAL_DEPOSIT_REQUIRED',
          { requiresDeposit: true }
        );
        return;
      }
      const msg = err instanceof Error ? err.message : 'Withdrawal submission failed';
      sendError(res, msg, 400, 'WITHDRAWAL_FAILED');
    }
  }

  /**
   * POST /api/v1/payouts/claim-ad-unlock
   * Claims a withdrawal request unlocked via the "Watch 30 Ads/Day for 5 Days" quest.
   */
  public static async claimAdUnlock(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const result = await WithdrawalEntitlementService.claimAdWithdrawalUnlock(userId);
      sendSuccess(res, result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to claim ad withdrawal unlock';
      sendError(res, msg, 400, 'CLAIM_FAILED');
    }
  }

  /**
   * GET /api/v1/payouts/treasury-wallets
   * Returns official deposit receiving addresses for all supported currencies.
   * Priority: Dynamic Trust Wallet DB setting -> Process Env -> Default Fallback.
   */
  public static async getTreasuryWallets(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const dbSettings = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: [
              'TRUST_WALLET_EVM_ADDRESS',
              'TRUST_WALLET_TRON_ADDRESS',
              'TRUST_WALLET_TON_ADDRESS',
              'TRUST_WALLET_SOL_ADDRESS',
              'TREASURY_EVM_ADDRESS',
              'TREASURY_TRON_ADDRESS',
              'TREASURY_TON_ADDRESS',
              'TREASURY_SOLANA_ADDRESS',
            ],
          },
        },
      });

      const settingsMap: Record<string, string> = {};
      dbSettings.forEach((s) => {
        settingsMap[s.key] = s.value;
      });

      const evmAddr = settingsMap['TRUST_WALLET_EVM_ADDRESS'] || settingsMap['TREASURY_EVM_ADDRESS'] || process.env.TRUST_WALLET_EVM_ADDRESS || process.env.TREASURY_EVM_ADDRESS || '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1';
      const tronAddr = settingsMap['TRUST_WALLET_TRON_ADDRESS'] || settingsMap['TREASURY_TRON_ADDRESS'] || process.env.TRUST_WALLET_TRON_ADDRESS || process.env.TREASURY_TRON_ADDRESS || process.env.TREASURY_TRON_ADORESS || 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv';
      const tonAddr = settingsMap['TRUST_WALLET_TON_ADDRESS'] || settingsMap['TREASURY_TON_ADDRESS'] || process.env.TRUST_WALLET_TON_ADDRESS || process.env.TREASURY_TON_ADDRESS || 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR';
      const solAddr = settingsMap['TRUST_WALLET_SOL_ADDRESS'] || settingsMap['TREASURY_SOL_ADDRESS'] || settingsMap['TREASURY_SOLANA_ADDRESS'] || process.env.TRUST_WALLET_SOL_ADDRESS || process.env.TREASURY_SOL_ADDRESS || process.env.TREASURY_SOLANA_ADDRESS || 'ER74j5s2PgVPx9dsT7wqyMSM7RgY4LKrFt9c1NFp92Qk';

      sendSuccess(res, {
        wallets: {
          TON: {
            currency: 'TON',
            network: 'TON',
            address: tonAddr,
            hint: 'Send TON (Toncoin) on TON network to this official address',
          },
          'TON (Toncoin)': {
            currency: 'TON (Toncoin)',
            network: 'TON',
            address: tonAddr,
            hint: 'Send TON (Toncoin) on TON network to this official address',
          },
          GRAM: {
            currency: 'GRAM',
            network: 'TON',
            address: tonAddr,
            hint: 'Send TON or GRAM on TON network to this official address',
          },
          'USDT (BEP20)': {
            currency: 'USDT (BEP20)',
            network: 'BNB',
            address: evmAddr,
            hint: 'Send USDT (BEP20) on BNB Smart Chain to this address',
          },
          'USDT (TRC20)': {
            currency: 'USDT (TRC20)',
            network: 'Tron',
            address: tronAddr,
            hint: 'Send USDT (TRC20) on TRON network to this address',
          },
          BNB: {
            currency: 'BNB',
            network: 'BNB',
            address: evmAddr,
            hint: 'Send BNB on BNB Smart Chain to this address',
          },
          TRX: {
            currency: 'TRX',
            network: 'Tron',
            address: tronAddr,
            hint: 'Send TRX on TRON network to this address',
          },
          'SOL (Solana)': {
            currency: 'SOL (Solana)',
            network: 'Solana',
            address: solAddr,
            hint: 'Send SOL on Solana network to this address',
          },
          'Base (USDC / ETH)': {
            currency: 'Base (USDC / ETH)',
            network: 'Base',
            address: evmAddr,
            hint: 'Send USDC or ETH on Base network to this address',
          },
          // Direct ID mappings for foolproof lookup
          USDT_BEP20: {
            currency: 'USDT_BEP20',
            network: 'BNB',
            address: evmAddr,
            hint: 'Send USDT (BEP20) on BNB Smart Chain to this address',
          },
          USDT_TRC20: {
            currency: 'USDT_TRC20',
            network: 'Tron',
            address: tronAddr,
            hint: 'Send USDT (TRC20) on TRON network to this address',
          },
          SOL: {
            currency: 'SOL',
            network: 'Solana',
            address: solAddr,
            hint: 'Send SOL on Solana network to this address',
          },
          USDC_BASE: {
            currency: 'USDC_BASE',
            network: 'Base',
            address: evmAddr,
            hint: 'Send USDC on Base network to this address',
          },
          ETH_BASE: {
            currency: 'ETH_BASE',
            network: 'Base',
            address: evmAddr,
            hint: 'Send ETH on Base network to this address',
          },
          BASE: {
            currency: 'BASE',
            network: 'Base',
            address: evmAddr,
            hint: 'Send USDC or ETH on Base network to this address',
          },
        },
        rate: {
          poopsPerUsdt: env.POOPS_PER_USDT,
          minWithdrawalPoops: env.MIN_WITHDRAWAL_POOPS,
        },
      });
    } catch {
      sendError(res, 'Failed to fetch treasury wallets', 500, 'TREASURY_FETCH_ERROR');
    }
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
        let statusTitle: string = d.status;
        if (d.status === 'CONFIRMED' || d.status === 'COMPLETED') statusTitle = 'Completed';
        else if (d.status === 'REJECTED' || d.status === 'FAILED') statusTitle = 'Rejected';
        else if (d.status === 'CONFIRMING' || d.status === 'PAYMENT_DETECTED') statusTitle = 'Confirming';
        else statusTitle = 'Pending';

        return {
          id: d.id,
          timestamp: d.createdAt.getTime(),
          amountUsdt: Number(d.amountUsdt),
          amountPoops: Number(d.amountPoops),
          currency: d.currency,
          network: d.network,
          depositAddress: d.depositAddress || undefined,
          paymentReference: d.paymentReference || undefined,
          expectedCryptoAmount: d.expectedCryptoAmount ? Number(d.expectedCryptoAmount) : undefined,
          txHash: d.txHash || undefined,
          status: statusTitle,
          rawStatus: d.status,
          notes: d.notes || undefined,
          confirmedAt: d.confirmedAt?.getTime() || undefined,
        };
      });

      sendSuccess(res, response);
    } catch {
      sendError(res, 'Failed to fetch deposits', 500, 'DEPOSITS_FETCH_ERROR');
    }
  }

  /**
   * POST /api/v1/payouts/deposits/create
   * Creates a formal deposit intent matching Reference Image 1 with paymentReference (Telegram ID)
   */
  public static async createDeposit(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = createDepositSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Validation failed', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const { amountUsdt, currency, network, notes } = parse.data;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        sendError(res, 'User not found', 404, 'NOT_FOUND');
        return;
      }

      // 1. Resolve Treasury Receiving Address & TON Config
      const tonConfig = await prisma.tonPaymentConfig.findUnique({ where: { id: 'singleton' } }).catch(() => null);
      const dbSettings = await prisma.systemSetting.findMany({
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
      const settingsMap: Record<string, string> = {};
      dbSettings.forEach((s) => { settingsMap[s.key] = s.value; });

      const evmAddr = settingsMap['TRUST_WALLET_EVM_ADDRESS'] || settingsMap['TREASURY_EVM_ADDRESS'] || process.env.TREASURY_EVM_ADDRESS || process.env.TRUST_WALLET_EVM_ADDRESS || '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1';
      const tronAddr = settingsMap['TRUST_WALLET_TRON_ADDRESS'] || settingsMap['TREASURY_TRON_ADDRESS'] || process.env.TREASURY_TRON_ADDRESS || process.env.TREASURY_TRON_ADORESS || process.env.TRUST_WALLET_TRON_ADDRESS || 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv';
      const tonAddr = tonConfig?.tonReceivingAddress || settingsMap['TRUST_WALLET_TON_ADDRESS'] || settingsMap['TREASURY_TON_ADDRESS'] || process.env.TREASURY_TON_ADDRESS || process.env.TRUST_WALLET_TON_ADDRESS || 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR';
      const solAddr = settingsMap['TRUST_WALLET_SOL_ADDRESS'] || settingsMap['TREASURY_SOL_ADDRESS'] || settingsMap['TREASURY_SOLANA_ADDRESS'] || process.env.TREASURY_SOL_ADDRESS || process.env.TREASURY_SOLANA_ADDRESS || process.env.TRUST_WALLET_SOL_ADDRESS || 'ER74j5s2PgVPx9dsT7wqyMSM7RgY4LKrFt9c1NFp92Qk';

      const netUpper = network.toUpperCase();
      const currUpper = currency.toUpperCase();

      let depositAddress = tronAddr;
      if (
        netUpper.includes('TON') ||
        currUpper === 'TON' ||
        currUpper === 'GRAM' ||
        currUpper.includes('TON')
      ) {
        depositAddress = tonAddr;
      } else if (
        netUpper.includes('SOL') ||
        currUpper === 'SOL' ||
        currUpper.includes('SOLANA')
      ) {
        depositAddress = solAddr;
      } else if (
        netUpper.includes('BNB') ||
        netUpper.includes('BEP20') ||
        netUpper.includes('BASE') ||
        netUpper.includes('BSC') ||
        netUpper.includes('ETH') ||
        netUpper.includes('EVM') ||
        currUpper === 'BNB' ||
        currUpper === 'ETH' ||
        currUpper.includes('BASE') ||
        currUpper.includes('BEP20')
      ) {
        depositAddress = evmAddr;
      } else if (
        netUpper.includes('TRON') ||
        netUpper.includes('TRC20') ||
        currUpper === 'TRX' ||
        currUpper.includes('TRC20')
      ) {
        depositAddress = tronAddr;
      }

      // 2. Unique Payment Reference (DEP-[telegramId]-[randomHex])
      // Provides deterministic traceability and uniqueness across concurrent deposits
      const uniqueSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const paymentReference = `DEP-${user.telegramId}-${uniqueSuffix}`;

      // 3. Centralized Multi-Chain Quote with Decimal-Safe Math
      const quote = await DepositVerificationService.calculateMultiChainQuote(
        amountUsdt,
        currency,
        network,
        depositAddress,
        paymentReference
      );
      const amountPoops = BigInt(Math.round(amountUsdt * env.POOPS_PER_USDT));

      // 4. Synchronize deposit intent with WAITING_FOR_PAYMENT status
      // Reuse active unsubmitted intent if one already exists for this user to avoid database spam
      const expiryMinutes = tonConfig?.depositExpiryMinutes || 1440;
      const requiredConfirmations = DepositVerificationService.getRequiredConfirmations(network);
      const depositData = {
        amountUsdt,
        amountPoops,
        currency: quote.currency,
        network,
        depositAddress,
        paymentReference,
        expectedCryptoAmount: quote.cryptoAmount,
        tokenContract: quote.tokenContract,
        requiredConfirmations,
        status: 'WAITING_FOR_PAYMENT' as const,
        notes: notes ? notes.trim() : `Deposit intent for ${amountUsdt} USDT (${quote.cryptoAmount} ${quote.currency})`,
        expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      };

      const existingIntent = await prisma.deposit.findFirst({
        where: {
          userId,
          status: 'WAITING_FOR_PAYMENT',
          txHash: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      const deposit = existingIntent
        ? await prisma.deposit.update({
            where: { id: existingIntent.id },
            data: depositData,
          })
        : await prisma.deposit.create({
            data: {
              userId,
              ...depositData,
            },
          });

      sendSuccess(res, {
        id: deposit.id,
        telegramId: user.telegramId.toString(),
        amountUsdt: Number(deposit.amountUsdt),
        amountPoops: Number(deposit.amountPoops),
        currency: deposit.currency,
        network: deposit.network,
        depositAddress: deposit.depositAddress,
        paymentReference: deposit.paymentReference,
        expectedCryptoAmount: quote.cryptoAmount,
        cryptoPriceUsd: quote.cryptoPriceUsd,
        rawUnits: quote.rawUnits,
        decimals: quote.decimals,
        tokenContract: quote.tokenContract,
        nanoTonAmount: quote.currency === 'TON' ? quote.rawUnits : undefined,
        tonPriceUsd: quote.currency === 'TON' ? quote.cryptoPriceUsd : undefined,
        // Two-Wallet Protocol Links
        keeperSupported: quote.walletLinks.keeperSupported,
        keeperReasonIfNotSupported: quote.walletLinks.keeperReasonIfNotSupported,
        keeperUniversalUrl: quote.walletLinks.keeperUniversalUrl,
        keeperDeepLink: quote.walletLinks.keeperDeepLink,
        trustWalletSupported: quote.walletLinks.trustWalletSupported,
        trustWalletUrl: quote.walletLinks.trustWalletUrl,
        tonkeeperUniversalUrl: quote.walletLinks.tonkeeperUniversalUrl,
        tonDeepLink: quote.walletLinks.tonDeepLink,
        webLauncherUrl: quote.walletLinks.webLauncherUrl,
        eip681Uri: quote.walletLinks.eip681Uri,
        tronUri: quote.walletLinks.tronUri,
        solanaPayUri: quote.walletLinks.solanaPayUri,
        phantomUrl: quote.walletLinks.phantomUrl,
        walletLinks: quote.walletLinks,
        minDeposit: 1.0,
        status: deposit.status,
        expiresAt: deposit.expiresAt?.getTime(),
        createdAt: deposit.createdAt.getTime(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create deposit';
      sendError(res, msg, 500, 'DEPOSIT_CREATE_ERROR');
    }
  }

  /**
   * POST /api/v1/payouts/deposits/:id/check-onchain
   * Real-time on-chain blockchain query for native TON deposits.
   * Atomically credits balance upon matching verification without waiting for manual admin approval.
   */
  public static async checkDepositOnChain(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const result = await DepositVerificationService.checkOnChainDeposit(id, userId);
      sendSuccess(res, result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to verify on-chain deposit';
      sendError(res, msg, 400, 'ONCHAIN_VERIFY_ERROR');
    }
  }

  /**
   * GET /api/v1/payouts/deposits/:id/status
   */
  public static async getDepositStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const deposit = await prisma.deposit.findUnique({
        where: { id },
      });

      if (!deposit || deposit.userId !== userId) {
        sendError(res, 'Deposit record not found', 404, 'NOT_FOUND');
        return;
      }

      sendSuccess(res, {
        id: deposit.id,
        status: deposit.status,
        amountUsdt: Number(deposit.amountUsdt),
        amountPoops: Number(deposit.amountPoops),
        currency: deposit.currency,
        network: deposit.network,
        depositAddress: deposit.depositAddress,
        paymentReference: deposit.paymentReference,
        txHash: deposit.txHash || undefined,
        confirmations: deposit.confirmations,
        requiredConfirmations: deposit.requiredConfirmations,
        explorerUrl: deposit.explorerUrl || (deposit.txHash ? DepositVerificationService.getExplorerUrl(deposit.network, deposit.txHash) : undefined),
        receivedCryptoAmount: deposit.receivedCryptoAmount ? Number(deposit.receivedCryptoAmount) : undefined,
        failureReason: deposit.failureReason || undefined,
        verifiedAt: deposit.verifiedAt?.getTime() || undefined,
        creditedAt: deposit.creditedAt?.getTime() || undefined,
        confirmedAt: deposit.confirmedAt?.getTime() || undefined,
        isCompleted: ['COMPLETED', 'CONFIRMED', 'CREDITED', 'SUCCESS'].includes(deposit.status),
      });
    } catch {
      sendError(res, 'Failed to fetch deposit status', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/payouts/deposits/:id/verify
   * Secure, fully automated on-chain blockchain transaction verification endpoint.
   * NO USER MANIPULATION: Client-submitted amounts/currencies are strictly ignored.
   * Funds and rewards are ONLY credited upon authentic on-chain proof.
   */
  public static async verifyDeposit(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = verifyDepositSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid verification request', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const { txHash } = parse.data;
    let cleanTx = txHash.trim();
    if (cleanTx.includes('/')) {
      const parts = cleanTx.split('/');
      cleanTx = parts[parts.length - 1].replace(/^[#?]/, '').trim() || cleanTx;
    }

    if (cleanTx.length < 8) {
      sendError(res, 'Invalid transaction hash format.', 422, 'INVALID_TX_HASH');
      return;
    }

    try {
      const deposit = await prisma.deposit.findUnique({
        where: { id },
      });

      if (!deposit || deposit.userId !== userId) {
        sendError(res, 'Deposit record not found', 404, 'NOT_FOUND');
        return;
      }

      if (['COMPLETED', 'CONFIRMED', 'CREDITED', 'SUCCESS'].includes(deposit.status)) {
        sendError(res, 'This deposit has already been verified and credited.', 400, 'ALREADY_COMPLETED');
        return;
      }

      // Check transaction hash uniqueness across all other completed deposits
      const existingHash = await prisma.deposit.findFirst({
        where: {
          txHash: cleanTx,
          id: { not: id },
          status: { in: ['CONFIRMED', 'COMPLETED', 'CREDITED', 'SUCCESS'] },
        },
      });

      if (existingHash) {
        sendError(res, 'This transaction hash has already been credited to another deposit.', 400, 'DUPLICATE_TX_HASH');
        return;
      }

      // Execute on-chain blockchain verification and automatic crediting engine
      const verifyResult = await DepositVerificationService.verifyAndProcessDeposit(id, cleanTx);

      if (verifyResult.status === 'REJECTED') {
        sendError(res, verifyResult.message || 'Transaction verification failed on blockchain.', 400, 'VERIFICATION_REJECTED', {
          explorerUrl: verifyResult.explorerUrl,
        });
        return;
      }

      sendSuccess(res, {
        success: verifyResult.success,
        isCompleted: verifyResult.isCompleted,
        status: verifyResult.status,
        txHash: cleanTx,
        explorerUrl: verifyResult.explorerUrl,
        confirmations: verifyResult.confirmations,
        requiredConfirmations: verifyResult.requiredConfirmations,
        newBalance: verifyResult.newBalance,
        message: verifyResult.message,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      sendError(res, msg, 400, 'VERIFICATION_ERROR');
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
    let cleanHash = txHash.trim();
    if (cleanHash.includes('/')) {
      const parts = cleanHash.split('/');
      cleanHash = parts[parts.length - 1].replace(/^[#?]/, '').trim() || cleanHash;
    }

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
          status: 'DETECTING',
          notes: notes ? notes.trim() : `User submitted deposit on ${network}`,
        },
      });

      // Trigger automated on-chain verification cycle immediately in background
      AutoDepositMonitor.verifyPendingDeposits().catch((err) => {
        logger.warn(`[AutoDeposit] Verification trigger error for ${deposit.id}:`, err);
      });

      sendSuccess(res, {
        id: deposit.id,
        timestamp: deposit.createdAt.getTime(),
        amountUsdt: Number(deposit.amountUsdt),
        amountPoops: Number(deposit.amountPoops),
        network: deposit.network,
        txHash: deposit.txHash,
        status: 'DETECTING' as const,
        message: 'Deposit transaction received! Automated blockchain verification is verifying confirmations.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deposit submission failed';
      sendError(res, msg, 400, 'DEPOSIT_FAILED');
    }
  }

  /**
   * POST /api/v1/payouts/deposits/webhook
   * External blockchain indexer webhook endpoint (QuickNode, Alchemy, TronGrid, TonAPI)
   */
  public static async handleDepositWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { txHash, network } = (req.body as { txHash?: string; network?: string }) || {};
      logger.info(`[DepositWebhook] Received transaction webhook event: ${txHash || 'bulk'} on ${network || 'multi'}`);

      // Instantly trigger background verification sweep
      AutoDepositMonitor.verifyPendingDeposits().catch((err) => {
        logger.warn('[DepositWebhook] Background verification sweep error:', err);
      });

      sendSuccess(res, { received: true, message: 'Deposit webhook received and queued for verification' });
    } catch (err: unknown) {
      logger.error('[DepositWebhook] Error handling webhook:', err);
      sendSuccess(res, { received: true });
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

  /**
   * GET /api/v1/payouts/payment-methods
   * Returns live status and parameters of all 7 supported payment options.
   */
  public static async getPaymentMethods(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tonConfig = await prisma.tonPaymentConfig.findUnique({ where: { id: 'singleton' } }).catch(() => null);
      const dbSettings = await prisma.systemSetting.findMany({
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
      const settingsMap: Record<string, string> = {};
      dbSettings.forEach((s) => { settingsMap[s.key] = s.value; });

      const evmAddr = settingsMap['TRUST_WALLET_EVM_ADDRESS'] || settingsMap['TREASURY_EVM_ADDRESS'] || process.env.TREASURY_EVM_ADDRESS || process.env.TRUST_WALLET_EVM_ADDRESS || '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1';
      const tronAddr = settingsMap['TRUST_WALLET_TRON_ADDRESS'] || settingsMap['TREASURY_TRON_ADDRESS'] || process.env.TREASURY_TRON_ADDRESS || process.env.TREASURY_TRON_ADORESS || process.env.TRUST_WALLET_TRON_ADDRESS || 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv';
      const tonAddr = tonConfig?.tonReceivingAddress || settingsMap['TRUST_WALLET_TON_ADDRESS'] || settingsMap['TREASURY_TON_ADDRESS'] || process.env.TREASURY_TON_ADDRESS || process.env.TRUST_WALLET_TON_ADDRESS || 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR';
      const solAddr = settingsMap['TRUST_WALLET_SOL_ADDRESS'] || settingsMap['TREASURY_SOL_ADDRESS'] || process.env.TREASURY_SOL_ADDRESS || process.env.TRUST_WALLET_SOL_ADDRESS || 'ER74j5s2PgVPx9dsT7wqyMSM7RgY4LKrFt9c1NFp92Qk';

      const [tonPrice, bnbPrice, trxPrice, solPrice, ethPrice] = await Promise.all([
        DepositVerificationService.getCryptoPrice('TON'),
        DepositVerificationService.getCryptoPrice('BNB'),
        DepositVerificationService.getCryptoPrice('TRX'),
        DepositVerificationService.getCryptoPrice('SOL'),
        DepositVerificationService.getCryptoPrice('ETH'),
      ]);

        const isKeeperGlobalEnabled = settingsMap['KEEPER_WALLET_ENABLED'] !== 'false';
        const isTrustWalletGlobalEnabled = settingsMap['TRUST_WALLET_ENABLED'] !== 'false';

        const methods = [
          {
            id: 'TON',
            name: 'TON (Toncoin)',
            network: 'TON',
            symbol: 'TON',
            networkType: 'TON',
            decimals: 9,
            receivingAddress: tonAddr,
            tokenContract: null,
            minDepositUsd: tonConfig?.minDepositTon ? tonConfig.minDepositTon * tonPrice : 1.0,
            maxDepositUsd: tonConfig?.maxDepositTon ? tonConfig.maxDepositTon * tonPrice : 10000.0,
            currentPriceUsd: tonPrice,
            supportedWallets: [
              ...(isKeeperGlobalEnabled ? ['KEEPER'] : []),
              ...(isTrustWalletGlobalEnabled ? ['TRUST_WALLET'] : []),
            ],
            isAvailable: Boolean(tonAddr && tonAddr.length >= 48),
          },
          {
            id: 'USDT_BEP20',
            name: 'USDT (BEP20)',
            network: 'BNB',
            symbol: 'USDT',
            networkType: 'EVM',
            decimals: 18,
            receivingAddress: evmAddr,
            tokenContract: '0x55d398326f99059fF775485246999027B3197955',
            minDepositUsd: 1.0,
            maxDepositUsd: 10000.0,
            currentPriceUsd: 1.0,
            supportedWallets: isTrustWalletGlobalEnabled ? ['TRUST_WALLET'] : [],
            isAvailable: Boolean(evmAddr && evmAddr.startsWith('0x')),
          },
          {
            id: 'USDT_TRC20',
            name: 'USDT (TRC20)',
            network: 'Tron',
            symbol: 'USDT',
            networkType: 'TRON',
            decimals: 6,
            receivingAddress: tronAddr,
            tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            minDepositUsd: 1.0,
            maxDepositUsd: 10000.0,
            currentPriceUsd: 1.0,
            supportedWallets: isTrustWalletGlobalEnabled ? ['TRUST_WALLET'] : [],
            isAvailable: Boolean(tronAddr && tronAddr.startsWith('T')),
          },
          {
            id: 'BNB',
            name: 'BNB',
            network: 'BNB',
            symbol: 'BNB',
            networkType: 'EVM',
            decimals: 18,
            receivingAddress: evmAddr,
            tokenContract: null,
            minDepositUsd: 1.0,
            maxDepositUsd: 10000.0,
            currentPriceUsd: bnbPrice,
            supportedWallets: isTrustWalletGlobalEnabled ? ['TRUST_WALLET'] : [],
            isAvailable: Boolean(evmAddr && evmAddr.startsWith('0x')),
          },
          {
            id: 'TRX',
            name: 'TRX',
            network: 'Tron',
            symbol: 'TRX',
            networkType: 'TRON',
            decimals: 6,
            receivingAddress: tronAddr,
            tokenContract: null,
            minDepositUsd: 1.0,
            maxDepositUsd: 10000.0,
            currentPriceUsd: trxPrice,
            supportedWallets: isTrustWalletGlobalEnabled ? ['TRUST_WALLET'] : [],
            isAvailable: Boolean(tronAddr && tronAddr.startsWith('T')),
          },
          {
            id: 'SOL',
            name: 'SOL (Solana)',
            network: 'Solana',
            symbol: 'SOL',
            networkType: 'SOLANA',
            decimals: 9,
            receivingAddress: solAddr,
            tokenContract: null,
            minDepositUsd: 1.0,
            maxDepositUsd: 10000.0,
            currentPriceUsd: solPrice,
            supportedWallets: isTrustWalletGlobalEnabled ? ['TRUST_WALLET'] : [],
            isAvailable: Boolean(solAddr && solAddr.length >= 32),
          },
          {
            id: 'USDC_BASE',
            name: 'USDC (Base)',
            network: 'Base',
            symbol: 'USDC',
            networkType: 'EVM',
            decimals: 6,
            receivingAddress: evmAddr,
            tokenContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            minDepositUsd: 1.0,
            maxDepositUsd: 10000.0,
            currentPriceUsd: 1.0,
            supportedWallets: isTrustWalletGlobalEnabled ? ['TRUST_WALLET'] : [],
            isAvailable: Boolean(evmAddr && evmAddr.startsWith('0x')),
          },
          {
            id: 'ETH_BASE',
            name: 'ETH (Base)',
            network: 'Base',
            symbol: 'ETH',
            networkType: 'EVM',
            decimals: 18,
            receivingAddress: evmAddr,
            tokenContract: null,
            minDepositUsd: 1.0,
            maxDepositUsd: 10000.0,
            currentPriceUsd: 3100.0, // Reference price if dynamic rate pending
            supportedWallets: isTrustWalletGlobalEnabled ? ['TRUST_WALLET'] : [],
            isAvailable: Boolean(evmAddr && evmAddr.startsWith('0x')),
          },
        ];

      sendSuccess(res, { methods });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch payment methods';
      sendError(res, msg, 500, 'PAYMENT_METHODS_ERROR');
    }
  }
}
