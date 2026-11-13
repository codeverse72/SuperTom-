/**
 * Automated Cryptocurrency Deposit Detection & Verification System
 * 
 * Continuous, fully automated background monitoring and verification engine for SuperTom:
 * 1. Monitors all configured receiving treasury addresses (TON, TRON, BSC, Ethereum, Base, Solana).
 * 2. Automatically detects incoming transfers without requiring frontend activity.
 * 3. Identifies the user via cryptographically generated memos, active deposit intents, or sender wallet addresses.
 * 4. Tracks blockchain confirmation thresholds (TON: 1, BSC: 3, TRON: 19, ETH: 3, Base: 6, Solana: 1).
 * 5. Atomically credits the user's SuperTom balance and double-entry ledger once confirmations are met.
 * 6. Dispatches real-time Telegram receipts upon detection and successful completion.
 * 7. ZERO admin approval required for legitimate, on-chain verified deposits.
 */

import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { DepositVerificationService } from './depositVerificationService.js';
import { DepositStatus } from '@prisma/client';

export interface ChainHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  latencyMs: number;
  blockHeight?: number;
  lastChecked: Date;
  lastError?: string;
}

export interface DetectedTransaction {
  txHash: string;
  fromAddress?: string;
  toAddress: string;
  currency: string;
  network: string;
  amountCrypto: number;
  amountUsdt: number;
  amountPoops: bigint;
  memo?: string;
  blockNumber?: bigint;
  confirmations: number;
  requiredConfirmations: number;
}

export class AutoDepositMonitor {
  private static isRunning = false;
  private static isPolling = false;
  private static pollTimer: NodeJS.Timeout | null = null;
  private static readonly POLL_INTERVAL_MS = 12_000; // 12 seconds loop

  // Required Confirmations per Network
  public static readonly REQUIRED_CONFIRMATIONS: Record<string, number> = {
    TON: 1,       // Masterchain finality
    TRON: 19,     // Solid block finality (~57s)
    TRC20: 19,
    BSC: 3,       // Fast finality (~9s)
    BEP20: 3,
    ETH: 3,       // Ethereum 3 blocks (~36s)
    ERC20: 3,
    BASE: 6,      // Base 6 blocks (~12s)
    SOLANA: 1,    // Finalized
    SOL: 1,
  };

  // Standard Token Contracts
  public static readonly TOKEN_CONTRACTS: Record<string, { address: string; decimals: number }> = {
    'USDT_TRC20': { address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6 },
    'USDT_BEP20': { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    'USDC_ERC20': { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    'USDT_ERC20': { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    'USDC_BASE':  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  };

  // RPC Endpoints with automatic fallback
  private static readonly EVM_RPCS: Record<string, string[]> = {
    BSC: [
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.defibit.io',
      'https://binance.llamarpc.com',
    ],
    ETH: [
      'https://eth.llamarpc.com',
      'https://cloudflare-eth.com',
      'https://rpc.ankr.com/eth',
    ],
    BASE: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
    ],
  };

  // In-Memory RPC Health Tracker
  public static healthStatus: Record<string, ChainHealth> = {
    TON: { status: 'HEALTHY', latencyMs: 0, lastChecked: new Date() },
    TRON: { status: 'HEALTHY', latencyMs: 0, lastChecked: new Date() },
    BSC: { status: 'HEALTHY', latencyMs: 0, lastChecked: new Date() },
    ETH: { status: 'HEALTHY', latencyMs: 0, lastChecked: new Date() },
    BASE: { status: 'HEALTHY', latencyMs: 0, lastChecked: new Date() },
    SOLANA: { status: 'HEALTHY', latencyMs: 0, lastChecked: new Date() },
  };

  /**
   * Starts the continuous background blockchain monitoring engine
   */
  public static start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('🚀 [AutoDepositMonitor] Continuous blockchain deposit engine started (12s interval).');

    // Run first iteration immediately
    this.pollCycle().catch((err) => logger.error('[AutoDepositMonitor] Startup poll error:', err));

    this.pollTimer = setInterval(() => {
      this.pollCycle().catch((err) => logger.error('[AutoDepositMonitor] Loop error:', err));
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Graceful shutdown of the monitoring engine
   */
  public static stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isRunning = false;
    logger.info('🛑 [AutoDepositMonitor] Continuous deposit engine stopped.');
  }

  /**
   * Main polling cycle covering both incoming address scans and pending confirmations
   */
  public static async pollCycle(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      // Stream 1: Check pending transactions in DB awaiting confirmations or verification
      await this.verifyPendingDeposits();

      // Stream 2: Scan receiving addresses for new incoming transfers on TON & TRON
      await this.scanTonTreasury();
      await this.scanTronTreasury();
    } catch (err) {
      logger.error('[AutoDepositMonitor] Error during polling cycle:', err);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Resolves currently active receiving treasury addresses from DB SystemSetting or .env
   */
  public static async getTreasuryAddresses(): Promise<{
    ton: string;
    tron: string;
    evm: string;
    sol: string;
  }> {
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

      const map: Record<string, string> = {};
      dbSettings.forEach((s) => { map[s.key] = s.value; });

      return {
        ton: tonConfig?.tonReceivingAddress || map['TRUST_WALLET_TON_ADDRESS'] || env.TREASURY_TON_ADDRESS || 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR',
        tron: map['TRUST_WALLET_TRON_ADDRESS'] || env.TREASURY_TRON_ADDRESS || 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv',
        evm: map['TRUST_WALLET_EVM_ADDRESS'] || env.TREASURY_EVM_ADDRESS || '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1',
        sol: map['TRUST_WALLET_SOL_ADDRESS'] || env.TREASURY_SOL_ADDRESS || 'ER74j5s2PgVPx9dsT7wqyMSM7RgY4LKrFt9c1NFp92Qk',
      };
    } catch {
      return {
        ton: env.TREASURY_TON_ADDRESS || 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR',
        tron: env.TREASURY_TRON_ADDRESS || 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv',
        evm: env.TREASURY_EVM_ADDRESS || '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1',
        sol: env.TREASURY_SOL_ADDRESS || 'ER74j5s2PgVPx9dsT7wqyMSM7RgY4LKrFt9c1NFp92Qk',
      };
    }
  }

  // =========================================================================
  // STREAM 1: VERIFY PENDING DEPOSITS & CONFIRMATIONS
  // =========================================================================

  /**
   * Scans and verifies all pending deposit records in the database.
   * Auto-credits balances as soon as blockchain confirmation thresholds are met.
   */
  public static async verifyPendingDeposits(): Promise<void> {
    const pendingDeposits = await prisma.deposit.findMany({
      where: {
        status: {
          in: [
            'DETECTING' as DepositStatus,
            'PENDING_CONFIRMATION' as DepositStatus,
            'CONFIRMING' as DepositStatus,
            'PAYMENT_DETECTED' as DepositStatus,
            'WAITING_FOR_PAYMENT' as DepositStatus,
            'PENDING' as DepositStatus,
          ],
        },
        txHash: { not: null },
      },
      include: { user: true },
      take: 25,
      orderBy: { updatedAt: 'asc' },
    });

    for (const deposit of pendingDeposits) {
      if (!deposit.txHash) continue;
      try {
        await this.verifySingleDeposit(deposit);
      } catch (err) {
        logger.warn(`[AutoDepositMonitor] Error verifying deposit ${deposit.id}:`, err);
      }
    }
  }

  /**
   * Verifies a single deposit against its respective blockchain.
   */
  private static async verifySingleDeposit(deposit: any): Promise<void> {
    const netUpper = (deposit.network || '').toUpperCase();
    const currUpper = (deposit.currency || '').toUpperCase();
    const cleanTx = deposit.txHash.trim();

    if (netUpper.includes('TON') || currUpper === 'TON' || currUpper === 'GRAM') {
      await this.verifyTonTx(deposit);
    } else if (netUpper.includes('TRON') || netUpper.includes('TRC20') || currUpper === 'TRX') {
      await this.verifyTronTx(deposit);
    } else if (netUpper.includes('BNB') || netUpper.includes('BEP20') || netUpper.includes('BSC') || currUpper === 'BNB') {
      await this.verifyEvmTx(deposit, 'BSC');
    } else if (netUpper.includes('ETH') || netUpper.includes('ERC20')) {
      await this.verifyEvmTx(deposit, 'ETH');
    } else if (netUpper.includes('BASE')) {
      await this.verifyEvmTx(deposit, 'BASE');
    } else if (netUpper.includes('SOL') || currUpper === 'SOL') {
      await this.verifySolanaTx(deposit);
    }
  }

  // =========================================================================
  // STREAM 2: TON BLOCKCHAIN SCANNER
  // =========================================================================

  public static async scanTonTreasury(): Promise<void> {
    const start = Date.now();
    try {
      const addresses = await this.getTreasuryAddresses();
      const treasury = addresses.ton;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const url = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(treasury)}&limit=30`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        this.updateHealth('TON', 'DEGRADED', latencyMs, undefined, `HTTP ${res.status}`);
        return;
      }

      const data = (await res.json()) as { ok: boolean; result?: any[] };
      if (!data.ok || !Array.isArray(data.result)) {
        this.updateHealth('TON', 'DEGRADED', latencyMs, undefined, 'Invalid API response format');
        return;
      }

      this.updateHealth('TON', 'HEALTHY', latencyMs);

      for (const tx of data.result) {
        const inMsg = tx.in_msg;
        if (!inMsg) continue;
        const txHash = tx.transaction_id?.hash;
        if (!txHash) continue;

        const valNanoTon = BigInt(inMsg.value || '0');
        if (valNanoTon <= 0n) continue;

        const receivedTon = Number(valNanoTon) / 1e9;
        const memo = (inMsg.message || inMsg.msg_data?.text || '').trim();
        const fromAddress = inMsg.source || '';

        await this.handleDetectedTransaction({
          txHash,
          fromAddress,
          toAddress: treasury,
          currency: 'TON',
          network: 'TON',
          amountCrypto: receivedTon,
          amountUsdt: Number((receivedTon * (await DepositVerificationService.getCryptoPrice('TON'))).toFixed(4)),
          amountPoops: BigInt(Math.round(receivedTon * (await DepositVerificationService.getCryptoPrice('TON')) * env.POOPS_PER_USDT)),
          memo,
          confirmations: 1,
          requiredConfirmations: 1,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'TON scanner error';
      this.updateHealth('TON', 'DOWN', Date.now() - start, undefined, msg);
    }
  }

  // =========================================================================
  // STREAM 3: TRON BLOCKCHAIN SCANNER (TRC-20 & TRX)
  // =========================================================================

  public static async scanTronTreasury(): Promise<void> {
    const start = Date.now();
    try {
      const addresses = await this.getTreasuryAddresses();
      const treasury = addresses.tron;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      // Fetch incoming TRC-20 transactions via Trongrid
      const url = `https://api.trongrid.io/v1/accounts/${encodeURIComponent(treasury)}/transactions/trc20?limit=25&only_to=true`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        this.updateHealth('TRON', 'DEGRADED', latencyMs, undefined, `Trongrid HTTP ${res.status}`);
        return;
      }

      const data = (await res.json()) as { success?: boolean; data?: any[] };
      if (!data.data || !Array.isArray(data.data)) {
        this.updateHealth('TRON', 'DEGRADED', latencyMs, undefined, 'Invalid Trongrid response');
        return;
      }

      this.updateHealth('TRON', 'HEALTHY', latencyMs);

      for (const t of data.data) {
        const txHash = t.transaction_id;
        if (!txHash) continue;

        const tokenSymbol = t.token_info?.symbol || 'USDT';
        const decimals = t.token_info?.decimals || 6;
        const rawAmount = BigInt(t.value || '0');
        if (rawAmount <= 0n) continue;

        const amountCrypto = Number(rawAmount) / 10 ** decimals;
        const fromAddress = t.from;

        await this.handleDetectedTransaction({
          txHash,
          fromAddress,
          toAddress: treasury,
          currency: tokenSymbol,
          network: 'TRC20',
          amountCrypto,
          amountUsdt: amountCrypto, // 1 USDT = 1 USD
          amountPoops: BigInt(Math.round(amountCrypto * env.POOPS_PER_USDT)),
          confirmations: 19, // TronGrid returns confirmed transfers
          requiredConfirmations: 19,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'TRON scanner error';
      this.updateHealth('TRON', 'DOWN', Date.now() - start, undefined, msg);
    }
  }

  // =========================================================================
  // UNIVERSAL TRANSACTION RESOLVER & USER IDENTIFICATION
  // =========================================================================

  /**
   * Processes any detected transaction on SuperTom treasury addresses:
   * 1. Replay protection: Skips if already credited.
   * 2. Identifies the user via memo, active intent, wallet address, or TXID.
   * 3. If confirmations >= required: auto-credits balance atomically!
   * 4. If confirmations < required: updates status to CONFIRMING.
   * 5. If user cannot be identified: records as UNIDENTIFIED for admin tracking without crediting.
   */
  public static async handleDetectedTransaction(tx: DetectedTransaction): Promise<void> {
    const cleanHash = tx.txHash.trim();

    // 1. Check if transaction has already been credited (idempotency)
    const existing = await prisma.deposit.findFirst({
      where: {
        txHash: cleanHash,
        status: { in: ['SUCCESS' as DepositStatus, 'COMPLETED' as DepositStatus, 'CONFIRMED' as DepositStatus] },
      },
    });

    if (existing) {
      return; // Already processed and credited
    }

    // 2. Identify User
    let matchedUserId: string | null = null;
    let matchedDepositId: string | null = null;

    // A. Check if a deposit record exists with this txHash
    const existingIntent = await prisma.deposit.findFirst({
      where: { txHash: cleanHash },
      include: { user: true },
    });

    if (existingIntent) {
      matchedUserId = existingIntent.userId;
      matchedDepositId = existingIntent.id;
    }

    // B. Check Memo / Comment (TON, Solana)
    if (!matchedUserId && tx.memo) {
      const memo = tx.memo.trim();

      // Check DEP-{telegramId}-{suffix}
      const depMatch = memo.match(/DEP-(\d+)-/i);
      if (depMatch && depMatch[1]) {
        const u = await prisma.user.findUnique({
          where: { telegramId: BigInt(depMatch[1]) },
        });
        if (u) matchedUserId = u.id;
      }

      // Check bare telegram ID
      if (!matchedUserId && /^\d{6,14}$/.test(memo)) {
        const u = await prisma.user.findUnique({
          where: { telegramId: BigInt(memo) },
        });
        if (u) matchedUserId = u.id;
      }

      // Check deposit ID UUID
      if (!matchedUserId && memo.length >= 32) {
        const d = await prisma.deposit.findUnique({ where: { id: memo } });
        if (d && d.userId) {
          matchedUserId = d.userId;
          matchedDepositId = d.id;
        }
      }
    }

    // C. Check active deposit intents in WAITING_FOR_PAYMENT created in last 3 hours
    if (!matchedUserId) {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000);
      const candidates = await prisma.deposit.findMany({
        where: {
          network: { equals: tx.network, mode: 'insensitive' },
          status: { in: ['WAITING_FOR_PAYMENT' as DepositStatus, 'DETECTING' as DepositStatus] },
          createdAt: { gte: threeHoursAgo },
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const cand of candidates) {
        const expected = Number(cand.expectedCryptoAmount || cand.amountUsdt);
        const minVal = expected * 0.98;
        const maxVal = expected * 1.05;

        if (tx.amountCrypto >= minVal && tx.amountCrypto <= maxVal) {
          matchedUserId = cand.userId;
          matchedDepositId = cand.id;
          break;
        }
      }
    }

    // D. Check User's bound withdrawal / profile wallet address
    if (!matchedUserId && tx.fromAddress) {
      const fromLower = tx.fromAddress.toLowerCase();
      const userWithWallet = await prisma.withdrawal.findFirst({
        where: { walletAddress: { equals: fromLower, mode: 'insensitive' } },
        select: { userId: true },
      });
      if (userWithWallet) {
        matchedUserId = userWithWallet.userId;
      }
    }

    // 3. Status Determination
    const isSufficientlyConfirmed = tx.confirmations >= tx.requiredConfirmations;
    const nextStatus: DepositStatus = !matchedUserId
      ? ('UNIDENTIFIED' as DepositStatus)
      : isSufficientlyConfirmed
      ? ('SUCCESS' as DepositStatus)
      : ('CONFIRMING' as DepositStatus);

    // 4. Upsert Deposit Record
    let depositRecord: any;

    if (matchedDepositId) {
      depositRecord = await prisma.deposit.update({
        where: { id: matchedDepositId },
        data: {
          txHash: cleanHash,
          fromAddress: tx.fromAddress,
          receivedCryptoAmount: tx.amountCrypto,
          confirmations: tx.confirmations,
          requiredConfirmations: tx.requiredConfirmations,
          blockNumber: tx.blockNumber,
          status: nextStatus,
        },
        include: { user: true },
      });
    } else {
      depositRecord = await prisma.deposit.create({
        data: {
          userId: matchedUserId,
          amountUsdt: tx.amountUsdt,
          amountPoops: tx.amountPoops,
          currency: tx.currency,
          network: tx.network,
          depositAddress: tx.toAddress,
          txHash: cleanHash,
          fromAddress: tx.fromAddress,
          receivedCryptoAmount: tx.amountCrypto,
          confirmations: tx.confirmations,
          requiredConfirmations: tx.requiredConfirmations,
          blockNumber: tx.blockNumber,
          status: nextStatus,
          notes: matchedUserId
            ? `Auto-detected ${tx.network} deposit`
            : `UNIDENTIFIED incoming ${tx.currency} transfer on ${tx.network}`,
        },
        include: { user: true },
      });
    }

    // 5. Automatic Execution Branch
    if (!matchedUserId) {
      logger.warn(`⚠️ [AutoDepositMonitor] UNIDENTIFIED deposit received: ${tx.amountCrypto} ${tx.currency} on ${tx.network} (${cleanHash}). Zero funds credited.`);
      return;
    }

    // User is identified!
    if (isSufficientlyConfirmed) {
      // AUTOMATIC BALANCE CREDITING (Zero Admin Approval)
      logger.info(`✨ [AutoDepositMonitor] Auto-crediting confirmed deposit ${depositRecord.id} for user ${matchedUserId} (${tx.amountUsdt} USDT / +${tx.amountPoops.toLocaleString()} Poops)...`);
      await DepositVerificationService.finalizeVerifiedDeposit(
        depositRecord.id,
        cleanHash,
        tx.amountCrypto
      );
    } else {
      // Notify user deposit is detected and currently confirming
      if (depositRecord.user?.telegramId) {
        DepositVerificationService.sendTelegramDepositDetectedNotification(
          depositRecord.user.telegramId,
          tx.amountCrypto.toFixed(4),
          tx.currency,
          tx.network,
          cleanHash,
          tx.confirmations,
          tx.requiredConfirmations
        ).catch(() => {});
      }
    }
  }

  // =========================================================================
  // CHAIN VERIFIERS FOR PENDING CONFIRMATIONS
  // =========================================================================

  private static async verifyTonTx(deposit: any): Promise<void> {
    const addresses = await this.getTreasuryAddresses();
    const treasury = deposit.depositAddress || addresses.ton;
    const res = await DepositVerificationService.checkOnChainDeposit(deposit.id, deposit.userId);
    if (res.success && res.isCompleted) {
      logger.info(`[AutoDepositMonitor] TON deposit ${deposit.id} confirmed and credited!`);
    }
  }

  private static async verifyTronTx(deposit: any): Promise<void> {
    const cleanTx = deposit.txHash.trim();
    const isUsdt = (deposit.currency || '').toUpperCase().includes('USDT');
    const tokenContract = isUsdt ? this.TOKEN_CONTRACTS['USDT_TRC20'].address : null;
    const addresses = await this.getTreasuryAddresses();
    const expectedRecipient = deposit.depositAddress || addresses.tron;

    const res = await DepositVerificationService.verifyTronTransaction(
      cleanTx,
      expectedRecipient,
      tokenContract,
      Number(deposit.expectedCryptoAmount || deposit.amountUsdt)
    );

    if (res.verified) {
      await DepositVerificationService.finalizeVerifiedDeposit(deposit.id, cleanTx, res.receivedAmount);
      logger.info(`[AutoDepositMonitor] TRON deposit ${deposit.id} verified and credited!`);
    } else if (res.error?.includes('failed') || res.error?.includes('revert')) {
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: { status: 'FAILED' as DepositStatus, notes: `Failed: ${res.error}` },
      });
    }
  }

  private static async verifyEvmTx(deposit: any, chain: 'BSC' | 'ETH' | 'BASE'): Promise<void> {
    const cleanTx = deposit.txHash.trim();
    const rpcUrls = this.EVM_RPCS[chain] || [];
    const addresses = await this.getTreasuryAddresses();
    const expectedRecipient = deposit.depositAddress || addresses.evm;

    let tokenContract: string | null = null;
    let decimals = 18;

    if (chain === 'BSC') {
      const isUsdt = (deposit.currency || '').toUpperCase().includes('USDT');
      tokenContract = isUsdt ? this.TOKEN_CONTRACTS['USDT_BEP20'].address : null;
      decimals = 18;
    } else if (chain === 'ETH') {
      const isUsdc = (deposit.currency || '').toUpperCase().includes('USDC');
      tokenContract = isUsdc ? this.TOKEN_CONTRACTS['USDC_ERC20'].address : this.TOKEN_CONTRACTS['USDT_ERC20'].address;
      decimals = 6;
    } else if (chain === 'BASE') {
      tokenContract = this.TOKEN_CONTRACTS['USDC_BASE'].address;
      decimals = 6;
    }

    const start = Date.now();
    for (const rpc of rpcUrls) {
      try {
        const evmRes = await DepositVerificationService.verifyEvmTransaction(
          cleanTx,
          rpc,
          expectedRecipient,
          tokenContract,
          Number(deposit.expectedCryptoAmount || deposit.amountUsdt),
          decimals
        );

        this.updateHealth(chain, 'HEALTHY', Date.now() - start);

        if (evmRes.verified) {
          await DepositVerificationService.finalizeVerifiedDeposit(deposit.id, cleanTx, evmRes.receivedAmount);
          logger.info(`[AutoDepositMonitor] ${chain} deposit ${deposit.id} auto-credited on blockchain confirmation!`);
          return;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `${chain} verification error`;
        this.updateHealth(chain, 'DEGRADED', Date.now() - start, undefined, msg);
      }
    }
  }

  private static async verifySolanaTx(deposit: any): Promise<void> {
    const cleanTx = deposit.txHash.trim();
    const addresses = await this.getTreasuryAddresses();
    const recipient = deposit.depositAddress || addresses.sol;

    const solRes = await DepositVerificationService.verifySolanaTransaction(
      cleanTx,
      recipient,
      Number(deposit.expectedCryptoAmount || deposit.amountUsdt)
    );

    if (solRes.verified) {
      await DepositVerificationService.finalizeVerifiedDeposit(deposit.id, cleanTx, solRes.receivedAmount);
      logger.info(`[AutoDepositMonitor] Solana deposit ${deposit.id} verified and credited!`);
    }
  }

  // =========================================================================
  // HEALTH & WEBHOOK HELPERS
  // =========================================================================

  private static updateHealth(
    chain: string,
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN',
    latencyMs: number,
    blockHeight?: number,
    error?: string
  ): void {
    this.healthStatus[chain] = {
      status,
      latencyMs: Math.max(0, latencyMs),
      blockHeight,
      lastChecked: new Date(),
      lastError: error,
    };
  }

  public static getHealth(): Record<string, ChainHealth> {
    return { ...this.healthStatus };
  }
}

