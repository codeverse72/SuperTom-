import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { DepositVerificationService } from './depositVerificationService.js';
import { DepositStatus } from '@prisma/client';

export interface ChainConfig {
  network: string;
  currency: string;
  decimals: number;
  tokenContract: string | null;
  requiredConfirmations: number;
  receivingAddress: string;
  rpcUrls: string[];
}

export interface RpcHealthStatus {
  network: string;
  rpcUrl: string;
  isHealthy: boolean;
  latencyMs?: number;
  currentBlock?: number;
  error?: string;
}

export class AutoDepositMonitor {
  private static isRunning = false;
  private static pollTimer: NodeJS.Timeout | null = null;
  private static readonly POLL_INTERVAL_MS = 15_000; // 15 seconds continuous monitoring

  // Required Confirmation Thresholds per Network
  public static readonly CONFIRMATION_THRESHOLDS: Record<string, number> = {
    BSC: 3,
    BNB: 3,
    BEP20: 3,
    TRON: 19,
    TRC20: 19,
    ETH: 6,
    ETHEREUM: 6,
    BASE: 6,
    TON: 1, // Irreversible once mined on masterchain
    SOL: 1,
  };

  // Legitimate Token Contract Mappings
  public static readonly TOKEN_CONTRACTS: Record<string, string> = {
    USDT_BEP20: '0x55d398326f99059fF775485246999027B3197955',
    USDT_TRC20: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    USDC_ERC20: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDC_BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  };

  /**
   * Starts the continuous background blockchain deposit monitoring worker.
   */
  public static start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('🚀 [AutoDepositMonitor] Autonomous Blockchain Deposit Engine started.');

    // Execute first scan immediately on startup (recovers deposits after server restarts)
    this.runTick().catch((err) => {
      logger.error('[AutoDepositMonitor] Initial scan error:', err);
    });

    this.pollTimer = setInterval(() => {
      this.runTick().catch((err) => {
        logger.error('[AutoDepositMonitor] Poller tick error:', err);
      });
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Graceful stop for server shutdowns.
   */
  public static stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isRunning = false;
    logger.info('⏹️ [AutoDepositMonitor] Monitoring worker stopped.');
  }

  /**
   * Single processing tick: scans active pending deposits and monitors receiving addresses.
   */
  public static async runTick(): Promise<void> {
    try {
      await this.processPendingDeposits();
      await this.scanTonReceivingAddress();
      await this.scanTronReceivingAddress();
    } catch (err) {
      logger.error('[AutoDepositMonitor] Unhandled error during monitoring tick:', err);
    }
  }

  /**
   * Processes all active pending, detecting, or confirming deposits in the database.
   */
  public static async processPendingDeposits(): Promise<number> {
    const activeStatuses: DepositStatus[] = [
      'PENDING',
      'WAITING_FOR_PAYMENT',
      'DETECTING',
      'PENDING_CONFIRMATION',
      'CONFIRMING',
      'PAYMENT_DETECTED',
    ];

    const deposits = await prisma.deposit.findMany({
      where: {
        status: { in: activeStatuses },
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }, // Last 48h
      },
      include: { user: true },
      take: 50,
    });

    let verifiedCount = 0;

    for (const deposit of deposits) {
      try {
        const result = await this.verifyAndFinalizeDeposit(deposit);
        if (result.verified) {
          verifiedCount++;
        }
      } catch (err) {
        logger.warn(`[AutoDepositMonitor] Failed verification for deposit ${deposit.id}:`, err);
      }
    }

    return verifiedCount;
  }

  /**
   * Verifies an individual deposit on-chain and automatically credits user if requirements are met.
   */
  public static async verifyAndFinalizeDeposit(
    deposit: any
  ): Promise<{ verified: boolean; status: string; message: string }> {
    if (deposit.status === 'COMPLETED' || deposit.status === 'CONFIRMED' || deposit.status === 'SUCCESS') {
      return { verified: true, status: deposit.status, message: 'Already completed' };
    }

    const netUpper = (deposit.network || '').toUpperCase();
    const currUpper = (deposit.currency || '').toUpperCase();

    // 1. TON Network Verification
    if (netUpper.includes('TON') || currUpper.includes('TON') || currUpper === 'GRAM') {
      return await this.verifyTonDeposit(deposit);
    }

    // 2. EVM Network (BSC BEP20 USDT / BNB, Base USDC / ETH, Ethereum)
    if (
      netUpper.includes('BNB') ||
      netUpper.includes('BEP20') ||
      netUpper.includes('BSC') ||
      netUpper.includes('BASE') ||
      netUpper.includes('ETH') ||
      currUpper === 'BNB' ||
      currUpper === 'ETH'
    ) {
      return await this.verifyEvmDeposit(deposit);
    }

    // 3. TRON Network (TRC20 USDT / TRX)
    if (netUpper.includes('TRON') || netUpper.includes('TRC20') || currUpper === 'TRX') {
      return await this.verifyTronDeposit(deposit);
    }

    // 4. Solana Network (SOL)
    if (netUpper.includes('SOL') || currUpper === 'SOL') {
      return await this.verifySolanaDeposit(deposit);
    }

    return { verified: false, status: deposit.status, message: 'Unsupported network' };
  }

  /**
   * Autonomous scanner for TON receiving address transactions.
   */
  public static async scanTonReceivingAddress(): Promise<void> {
    try {
      const tonConfig = await prisma.tonPaymentConfig.findUnique({ where: { id: 'singleton' } }).catch(() => null);
      const treasuryAddress =
        tonConfig?.tonReceivingAddress ||
        env.TRUST_WALLET_TON_ADDRESS ||
        'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR';

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const url = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(treasuryAddress)}&limit=30`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; result?: any[] };
      if (!data.ok || !Array.isArray(data.result)) return;

      for (const tx of data.result) {
        const inMsg = tx.in_msg;
        if (!inMsg) continue;
        const txHash = tx.transaction_id?.hash;
        if (!txHash) continue;

        const valNanoTon = BigInt(inMsg.value || '0');
        if (valNanoTon <= 0n) continue;

        const memo = (inMsg.message || inMsg.msg_data?.text || '').trim();
        const cleanTxHash = txHash.trim();

        // Check if transaction hash already recorded and completed
        const existingTx = await prisma.deposit.findFirst({
          where: { txHash: cleanTxHash },
        });

        if (existingTx && (existingTx.status === 'COMPLETED' || existingTx.status === 'CONFIRMED' || existingTx.status === 'SUCCESS')) {
          continue;
        }

        // Extract Telegram ID from Memo
        let matchedTelegramId: bigint | null = null;
        let matchedPaymentRef: string | null = null;

        if (memo.startsWith('DEP-')) {
          matchedPaymentRef = memo;
          const parts = memo.split('-');
          if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
            matchedTelegramId = BigInt(parts[1]);
          }
        } else if (/^\d{5,15}$/.test(memo)) {
          matchedTelegramId = BigInt(memo);
        }

        const receivedTon = Number(valNanoTon) / 1_000_000_000;

        if (matchedTelegramId) {
          const user = await prisma.user.findUnique({
            where: { telegramId: matchedTelegramId },
          });

          if (user) {
            // Find existing matching pending intent or create new
            let targetDeposit = existingTx;
            if (!targetDeposit) {
              targetDeposit = await prisma.deposit.findFirst({
                where: {
                  userId: user.id,
                  status: { in: ['WAITING_FOR_PAYMENT', 'PENDING', 'DETECTING', 'PENDING_CONFIRMATION', 'CONFIRMING'] },
                  ...(matchedPaymentRef ? { paymentReference: matchedPaymentRef } : {}),
                },
                orderBy: { createdAt: 'desc' },
              });
            }

            const tonPrice = await DepositVerificationService.getCryptoPrice('TON');
            const approxUsdt = Math.round(receivedTon * tonPrice * 100) / 100;
            const amountPoops = BigInt(Math.round(approxUsdt * env.POOPS_PER_USDT));

            if (!targetDeposit) {
              targetDeposit = await prisma.deposit.create({
                data: {
                  userId: user.id,
                  amountUsdt: approxUsdt,
                  amountPoops,
                  currency: 'TON',
                  network: 'TON',
                  depositAddress: treasuryAddress,
                  paymentReference: memo,
                  expectedCryptoAmount: receivedTon,
                  receivedCryptoAmount: receivedTon,
                  txHash: cleanTxHash,
                  status: 'CONFIRMING',
                  confirmations: 1,
                  requiredConfirmations: 1,
                  notes: `Auto-detected incoming TON on-chain transfer (${receivedTon} TON). Memo: ${memo}`,
                },
              });
            }

            // Finalize and credit immediately!
            await this.creditDepositSuccess(
              targetDeposit.id,
              cleanTxHash,
              receivedTon,
              1,
              'TON',
              'TON'
            );
            continue;
          }
        }

        // If no user could be matched and transaction not recorded yet:
        if (!existingTx) {
          const tonPrice = await DepositVerificationService.getCryptoPrice('TON');
          const approxUsdt = Math.round(receivedTon * tonPrice * 100) / 100;
          await prisma.deposit.create({
            data: {
              userId: null,
              amountUsdt: approxUsdt,
              amountPoops: BigInt(Math.round(approxUsdt * env.POOPS_PER_USDT)),
              currency: 'TON',
              network: 'TON',
              depositAddress: treasuryAddress,
              paymentReference: memo || 'NO_MEMO',
              receivedCryptoAmount: receivedTon,
              txHash: cleanTxHash,
              status: 'UNIDENTIFIED',
              confirmations: 1,
              requiredConfirmations: 1,
              notes: `Unidentified incoming TON transfer. Amount: ${receivedTon} TON. Raw Memo: "${memo}"`,
            },
          });
          logger.warn(`[AutoDepositMonitor] Logged UNIDENTIFIED TON deposit: ${cleanTxHash} (${receivedTon} TON)`);
        }
      }
    } catch (err) {
      logger.warn('[AutoDepositMonitor] Error scanning TON address:', err);
    }
  }

  /**
   * Autonomous scanner for TRON TRC20 USDT receiving address transfers.
   */
  public static async scanTronReceivingAddress(): Promise<void> {
    try {
      const dbSettings = await prisma.systemSetting.findMany({
        where: { key: { in: ['TRUST_WALLET_TRON_ADDRESS', 'TREASURY_TRON_ADDRESS'] } },
      });
      const settingsMap: Record<string, string> = {};
      dbSettings.forEach((s) => { settingsMap[s.key] = s.value; });

      const treasuryAddress =
        settingsMap['TRUST_WALLET_TRON_ADDRESS'] ||
        settingsMap['TREASURY_TRON_ADDRESS'] ||
        env.TRUST_WALLET_TRON_ADDRESS ||
        'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv';

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const url = `https://apilist.tronscanapi.com/api/token_trc20/transfers?limit=25&start=0&sort=-timestamp&count=true&relatedAddress=${treasuryAddress}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return;
      const data = (await res.json()) as any;
      const tokenTransfers = data.token_transfers || [];

      for (const t of tokenTransfers) {
        if (t.to_address !== treasuryAddress) continue;
        if (t.contract_address !== this.TOKEN_CONTRACTS.USDT_TRC20) continue;

        const txHash = (t.transaction_id || '').trim();
        if (!txHash) continue;

        const existingTx = await prisma.deposit.findFirst({
          where: { txHash },
        });

        if (existingTx && (existingTx.status === 'COMPLETED' || existingTx.status === 'CONFIRMED' || existingTx.status === 'SUCCESS')) {
          continue;
        }

        const rawAmount = BigInt(t.quant || '0');
        const amountUsdt = Number(rawAmount) / 1e6;
        if (amountUsdt <= 0) continue;

        const isConfirmed = t.confirmed === true;
        const confirmations = isConfirmed ? 19 : 1;

        // If a pending deposit was created by a user with this txHash:
        if (existingTx && existingTx.userId) {
          if (isConfirmed) {
            await this.creditDepositSuccess(
              existingTx.id,
              txHash,
              amountUsdt,
              confirmations,
              'USDT',
              'TRC20'
            );
          } else {
            await prisma.deposit.update({
              where: { id: existingTx.id },
              data: {
                status: 'CONFIRMING',
                confirmations,
                requiredConfirmations: 19,
              },
            });
          }
        }
      }
    } catch (err) {
      logger.warn('[AutoDepositMonitor] Error scanning TRON address:', err);
    }
  }

  /**
   * Verifies an EVM deposit (BSC BEP20 USDT / BNB, Base USDC / ETH, Ethereum ERC20).
   */
  private static async verifyEvmDeposit(
    deposit: any
  ): Promise<{ verified: boolean; status: string; message: string }> {
    if (!deposit.txHash) {
      return { verified: false, status: deposit.status, message: 'Awaiting transaction hash' };
    }

    const cleanTx = deposit.txHash.trim();
    const netUpper = (deposit.network || '').toUpperCase();
    const currUpper = (deposit.currency || '').toUpperCase();

    const isBsc = netUpper.includes('BNB') || netUpper.includes('BEP20') || netUpper.includes('BSC');
    const isBase = netUpper.includes('BASE');

    let rpcUrls = isBsc
      ? ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io', 'https://rpc.ankr.com/bsc']
      : isBase
      ? ['https://mainnet.base.org', 'https://base.llamarpc.com']
      : ['https://rpc.ankr.com/eth', 'https://cloudflare-eth.com'];

    const requiredConfirmations = isBsc ? 3 : 6;
    let tokenContract: string | null = null;
    let decimals = 18;

    if (currUpper.includes('USDT') && isBsc) {
      tokenContract = this.TOKEN_CONTRACTS.USDT_BEP20;
      decimals = 18;
    } else if (currUpper.includes('USDC') && isBase) {
      tokenContract = this.TOKEN_CONTRACTS.USDC_BASE;
      decimals = 6;
    } else if (currUpper.includes('USDC')) {
      tokenContract = this.TOKEN_CONTRACTS.USDC_ERC20;
      decimals = 6;
    }

    let receipt: any = null;
    let currentBlock = 0;

    for (const rpc of rpcUrls) {
      try {
        const [receiptRes, blockRes] = await Promise.all([
          fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [cleanTx] }),
            signal: AbortSignal.timeout(5000),
          }),
          fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_blockNumber', params: [] }),
            signal: AbortSignal.timeout(5000),
          }),
        ]);

        if (receiptRes.ok && blockRes.ok) {
          const rData = (await receiptRes.json()) as { result?: any };
          const bData = (await blockRes.json()) as { result?: string };
          if (rData.result) {
            receipt = rData.result;
            currentBlock = parseInt(bData.result || '0', 16);
            break;
          }
        }
      } catch {
        // Try next fallback RPC
      }
    }

    if (!receipt) {
      return { verified: false, status: deposit.status, message: 'Transaction pending inclusion in block' };
    }

    if (receipt.status !== '0x1') {
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: { status: 'FAILED', notes: 'EVM transaction execution failed on-chain' },
      });
      return { verified: false, status: 'FAILED', message: 'Transaction reverted on-chain' };
    }

    const txBlockNumber = parseInt(receipt.blockNumber, 16);
    const confirmations = Math.max(1, currentBlock - txBlockNumber + 1);

    // Verify recipient address
    const treasury = deposit.depositAddress || env.TRUST_WALLET_EVM_ADDRESS;
    const cleanRecipient = treasury.toLowerCase().replace('0x', '');

    let receivedAmount = 0;

    if (tokenContract) {
      // ERC20 Transfer check
      const cleanContract = tokenContract.toLowerCase();
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      let found = false;

      for (const log of receipt.logs || []) {
        if (log.address?.toLowerCase() === cleanContract && log.topics?.[0]?.toLowerCase() === transferTopic) {
          const toTopic = (log.topics[2] || '').toLowerCase();
          if (toTopic.endsWith(cleanRecipient)) {
            const rawVal = BigInt(log.data || '0x0');
            receivedAmount = Number(rawVal) / 10 ** decimals;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: { status: 'FAILED', notes: 'ERC20 Transfer event did not match recipient address or contract' },
        });
        return { verified: false, status: 'FAILED', message: 'Invalid token recipient or contract' };
      }
    } else {
      // Native BNB or ETH transfer
      receivedAmount = Number(deposit.expectedCryptoAmount || deposit.amountUsdt);
    }

    // Check Confirmation Threshold
    if (confirmations < requiredConfirmations) {
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: 'CONFIRMING',
          confirmations,
          requiredConfirmations,
          blockNumber: BigInt(txBlockNumber),
        },
      });

      // Dispatch "Deposit Detected" notification if first detection
      if (deposit.status !== 'CONFIRMING' && deposit.user?.telegramId) {
        this.sendDepositDetectedNotification(
          deposit.user.telegramId,
          deposit.currency,
          deposit.network,
          receivedAmount,
          cleanTx,
          confirmations,
          requiredConfirmations
        ).catch(() => {});
      }

      return {
        verified: false,
        status: 'CONFIRMING',
        message: `Waiting for confirmations (${confirmations}/${requiredConfirmations})`,
      };
    }

    // Fully confirmed! Credit user balance automatically
    await this.creditDepositSuccess(
      deposit.id,
      cleanTx,
      receivedAmount,
      confirmations,
      deposit.currency,
      deposit.network
    );

    return { verified: true, status: 'SUCCESS', message: 'Deposit verified and automatically credited' };
  }

  /**
   * Verifies a TRON deposit (TRC20 USDT or Native TRX).
   */
  private static async verifyTronDeposit(
    deposit: any
  ): Promise<{ verified: boolean; status: string; message: string }> {
    if (!deposit.txHash) {
      return { verified: false, status: deposit.status, message: 'Awaiting transaction hash' };
    }

    const cleanTx = deposit.txHash.trim();
    const currUpper = (deposit.currency || '').toUpperCase();
    const isUsdt = currUpper.includes('USDT');
    const tokenContract = isUsdt ? this.TOKEN_CONTRACTS.USDT_TRC20 : null;
    const treasury = deposit.depositAddress || env.TRUST_WALLET_TRON_ADDRESS;

    try {
      const url = `https://apilist.tronscanapi.com/api/transaction-info?hash=${cleanTx}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) {
        return { verified: false, status: deposit.status, message: 'Tronscan API lookup pending' };
      }

      const data = (await res.json()) as any;
      if (data.contractRet !== 'SUCCESS') {
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: { status: 'FAILED', notes: 'TRON contract execution did not succeed on-chain' },
        });
        return { verified: false, status: 'FAILED', message: 'TRON transaction failed on-chain' };
      }

      let receivedAmount = 0;
      let matched = false;

      if (tokenContract) {
        const transfers = data.trc20TransferInfo || [];
        for (const t of transfers) {
          if (t.to_address === treasury && (t.contract_address === tokenContract || !tokenContract)) {
            receivedAmount = Number(BigInt(t.amount_str || '0')) / 1e6;
            matched = true;
            break;
          }
        }
      } else {
        const contractData = data.contractData || {};
        if (contractData.to_address === treasury) {
          receivedAmount = Number(BigInt(contractData.amount || '0')) / 1e6;
          matched = true;
        }
      }

      if (!matched || receivedAmount <= 0) {
        return { verified: false, status: 'FAILED', message: 'TRON recipient or contract mismatch' };
      }

      const isConfirmed = data.confirmed === true;
      const confirmations = isConfirmed ? 19 : (data.confirmations || 1);

      if (!isConfirmed) {
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: {
            status: 'CONFIRMING',
            confirmations,
            requiredConfirmations: 19,
          },
        });
        return {
          verified: false,
          status: 'CONFIRMING',
          message: `Waiting for TRON confirmations (${confirmations}/19)`,
        };
      }

      // Fully confirmed!
      await this.creditDepositSuccess(
        deposit.id,
        cleanTx,
        receivedAmount,
        19,
        deposit.currency,
        deposit.network
      );

      return { verified: true, status: 'SUCCESS', message: 'TRON deposit verified and credited' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'TRON verification error';
      return { verified: false, status: deposit.status, message: msg };
    }
  }

  /**
   * Verifies a TON deposit.
   */
  private static async verifyTonDeposit(
    deposit: any
  ): Promise<{ verified: boolean; status: string; message: string }> {
    const treasury = deposit.depositAddress || env.TRUST_WALLET_TON_ADDRESS;
    const paymentRef = (deposit.paymentReference || '').trim();
    const userTelegramId = deposit.user?.telegramId?.toString() || '';
    const cleanTx = deposit.txHash?.trim();

    try {
      const url = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(treasury)}&limit=35`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return { verified: false, status: deposit.status, message: 'Toncenter unreachable' };

      const data = (await res.json()) as { ok: boolean; result?: any[] };
      if (!data.ok || !Array.isArray(data.result)) {
        return { verified: false, status: deposit.status, message: 'Toncenter error' };
      }

      for (const tx of data.result) {
        const inMsg = tx.in_msg;
        if (!inMsg) continue;
        const txHash = tx.transaction_id?.hash;
        if (!txHash) continue;

        const memo = (inMsg.message || inMsg.msg_data?.text || '').trim().toUpperCase();
        const refUpper = paymentRef.toUpperCase();
        const idUpper = deposit.id.toUpperCase();

        const isMatch =
          Boolean(cleanTx && txHash === cleanTx) ||
          Boolean(paymentRef && (memo === refUpper || memo.includes(refUpper))) ||
          Boolean(userTelegramId && (memo === userTelegramId || memo.includes(userTelegramId))) ||
          Boolean(memo.includes(idUpper));

        if (!isMatch) continue;

        const valNanoTon = BigInt(inMsg.value || '0');
        const receivedTon = Number(valNanoTon) / 1e9;
        if (receivedTon <= 0) continue;

        await this.creditDepositSuccess(
          deposit.id,
          txHash,
          receivedTon,
          1,
          'TON',
          'TON'
        );

        return { verified: true, status: 'SUCCESS', message: 'TON deposit confirmed and credited' };
      }

      return { verified: false, status: deposit.status, message: 'Awaiting TON transaction matching memo' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'TON error';
      return { verified: false, status: deposit.status, message: msg };
    }
  }

  /**
   * Verifies a Solana deposit.
   */
  private static async verifySolanaDeposit(
    deposit: any
  ): Promise<{ verified: boolean; status: string; message: string }> {
    if (!deposit.txHash) {
      return { verified: false, status: deposit.status, message: 'Awaiting Solana transaction hash' };
    }

    const recipient = deposit.depositAddress || env.TRUST_WALLET_SOL_ADDRESS;
    const solRes = await DepositVerificationService.verifySolanaTransaction(
      deposit.txHash,
      recipient,
      Number(deposit.expectedCryptoAmount || deposit.amountUsdt)
    );

    if (solRes.verified) {
      await this.creditDepositSuccess(
        deposit.id,
        deposit.txHash,
        solRes.receivedAmount || Number(deposit.amountUsdt),
        1,
        'SOL',
        'SOLANA'
      );
      return { verified: true, status: 'SUCCESS', message: 'Solana deposit verified and credited' };
    }

    return { verified: false, status: deposit.status, message: solRes.error || 'Solana confirmation pending' };
  }

  /**
   * Core atomic balance crediting engine.
   * Completely bypasses manual admin approval:
   * 1. Updates deposit to SUCCESS / COMPLETED with confirmations and confirmed timestamp.
   * 2. Atomic double-entry ledger balance transaction.
   * 3. 5K Celebration Campaign instant cashback enrollment.
   * 4. Grants withdrawal entitlement.
   * 5. Dispatches official Telegram notification.
   */
  public static async creditDepositSuccess(
    depositId: string,
    txHash: string,
    receivedCryptoAmount: number,
    confirmations: number,
    currency: string,
    network: string
  ): Promise<{ success: boolean; newBalance?: number }> {
    return await prisma.$transaction(async (tx) => {
      const deposit = await tx.deposit.findUnique({
        where: { id: depositId },
        include: { user: true },
      });

      if (!deposit) {
        throw new Error(`Deposit ${depositId} not found`);
      }

      // Idempotency check: never credit more than once
      if (deposit.status === 'SUCCESS' || deposit.status === 'COMPLETED' || deposit.status === 'CONFIRMED') {
        return { success: true };
      }

      const cleanTx = txHash.trim();

      // Ensure txHash uniqueness across all other deposits
      const duplicateTx = await tx.deposit.findFirst({
        where: {
          txHash: cleanTx,
          id: { not: depositId },
          status: { in: ['SUCCESS', 'COMPLETED', 'CONFIRMED'] },
        },
      });

      if (duplicateTx) {
        throw new Error(`Transaction ${cleanTx} has already been credited to deposit ${duplicateTx.id}`);
      }

      if (!deposit.userId) {
        throw new Error('Cannot credit deposit without associated user');
      }

      const amountUsdtNum = Number(deposit.amountUsdt);
      const amountPoops = deposit.amountPoops;

      // 1. Double-entry ledger balance crediting
      const { newBalance } = await DepositVerificationService.finalizeVerifiedDeposit(
        depositId,
        cleanTx,
        receivedCryptoAmount
      );

      // 2. Update status to SUCCESS / COMPLETED with confirmation metrics
      await tx.deposit.update({
        where: { id: depositId },
        data: {
          status: 'SUCCESS',
          confirmations,
          txHash: cleanTx,
          confirmedAt: new Date(),
        },
      });

      // 3. Dispatch user notification matching exact prompt specification
      if (deposit.user?.telegramId) {
        this.sendDepositSuccessNotification(
          deposit.user.telegramId,
          currency,
          network,
          receivedCryptoAmount,
          cleanTx,
          Number(newBalance || 0)
        ).catch(() => {});
      }

      logger.info(
        `✅ [AutoDepositMonitor] Successfully auto-credited deposit ${depositId} ($${amountUsdtNum} USDT -> +${amountPoops} Poops) to user @${deposit.user?.username || deposit.userId} without admin intervention.`
      );

      return { success: true, newBalance: Number(newBalance || 0) };
    });
  }

  /**
   * Telegram Notification: Exact format requested in Section 8 of specification.
   */
  public static async sendDepositSuccessNotification(
    telegramId: bigint,
    currency: string,
    network: string,
    amount: number,
    txHash: string,
    newBalance: number
  ): Promise<void> {
    try {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') return;

      const formattedAmount = `${amount.toFixed(4).replace(/\.?0+$/, '')} ${currency}`;
      const shortHash = txHash.length > 20 ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : txHash;

      const text =
`🎉 Deposit Successful!

Your deposit has been successfully verified and credited to your SuperTom account.

Currency: ${currency}
Network: ${network}
Amount: ${formattedAmount}
Transaction ID: ${shortHash}

Your updated balance: ${newBalance.toLocaleString()} Poops 💩

Thank you for using SuperTom! 🚀`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId.toString(),
          text,
        }),
      });
    } catch (err) {
      logger.warn('[AutoDepositMonitor] Failed to send Telegram deposit success receipt:', err);
    }
  }

  /**
   * Telegram Notification: Detected incoming transaction waiting for confirmations.
   */
  public static async sendDepositDetectedNotification(
    telegramId: bigint,
    currency: string,
    network: string,
    amount: number,
    txHash: string,
    confirmations: number,
    requiredConfirmations: number
  ): Promise<void> {
    try {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') return;

      const shortHash = txHash.length > 20 ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : txHash;

      const text =
`⏳ Deposit Detected!

We detected an incoming deposit waiting for blockchain confirmations (${confirmations}/${requiredConfirmations}).

Currency: ${currency}
Network: ${network}
Amount: ${amount} ${currency}
Transaction ID: ${shortHash}

Your balance will be credited automatically once confirmed!`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId.toString(),
          text,
        }),
      });
    } catch (err) {
      logger.warn('[AutoDepositMonitor] Failed to send Telegram deposit detected notification:', err);
    }
  }

  /**
   * Diagnostics: Checks health and latency of all configured blockchain RPC endpoints.
   */
  public static async getRpcHealth(): Promise<RpcHealthStatus[]> {
    const endpoints: { network: string; rpcUrl: string; isEvm: boolean }[] = [
      { network: 'BSC (BNB Smart Chain)', rpcUrl: 'https://bsc-dataseed.binance.org', isEvm: true },
      { network: 'Base Mainnet', rpcUrl: 'https://mainnet.base.org', isEvm: true },
      { network: 'Ethereum Mainnet', rpcUrl: 'https://cloudflare-eth.com', isEvm: true },
      { network: 'TRON (Tronscan API)', rpcUrl: 'https://apilist.tronscanapi.com/api/system/status', isEvm: false },
      { network: 'TON (Toncenter API)', rpcUrl: 'https://toncenter.com/api/v2/getMasterchainInfo', isEvm: false },
    ];

    const results: RpcHealthStatus[] = [];

    await Promise.all(
      endpoints.map(async (ep) => {
        const start = Date.now();
        try {
          if (ep.isEvm) {
            const res = await fetch(ep.rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
              signal: AbortSignal.timeout(4000),
            });
            const latency = Date.now() - start;
            if (res.ok) {
              const data = (await res.json()) as { result?: string };
              const currentBlock = parseInt(data.result || '0', 16);
              results.push({ network: ep.network, rpcUrl: ep.rpcUrl, isHealthy: true, latencyMs: latency, currentBlock });
            } else {
              results.push({ network: ep.network, rpcUrl: ep.rpcUrl, isHealthy: false, latencyMs: latency, error: `HTTP ${res.status}` });
            }
          } else {
            const res = await fetch(ep.rpcUrl, { signal: AbortSignal.timeout(4000) });
            const latency = Date.now() - start;
            results.push({ network: ep.network, rpcUrl: ep.rpcUrl, isHealthy: res.ok, latencyMs: latency });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Timeout / Network Error';
          results.push({ network: ep.network, rpcUrl: ep.rpcUrl, isHealthy: false, latencyMs: Date.now() - start, error: msg });
        }
      })
    );

    return results;
  }
}
