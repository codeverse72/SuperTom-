import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { logger } from '../../utils/logger.js';
import { CampaignService } from '../campaign/campaignService.js';
import { WithdrawalEntitlementService } from './withdrawalEntitlementService.js';

export interface CryptoPriceMap {
  [currency: string]: number; // price in USD
}

export class DepositVerificationService {
  /**
   * In-memory exchange rate cache with 60s TTL to prevent external rate-limiting
   * and ensure zero unnecessary requests during frontend renders.
   */
  private static priceCache: Map<string, { price: number; expiresAt: number }> = new Map();
  private static readonly PRICE_CACHE_TTL_MS = 60 * 1000; // 60 seconds

  /**
   * Fallback rates in USD per 1 unit of cryptocurrency
   */
  private static readonly FALLBACK_PRICES: CryptoPriceMap = {
    USDT: 1.0,
    USDC: 1.0,
    GRAM: 0.05,
    TON: 5.20,
    BNB: 650.0,
    TRX: 0.25,
    SOL: 180.0,
    ETH: 2600.0,
    BASE: 1.0,
  };

  /**
   * Fetch current market price in USD for a given currency.
   * Utilizes an in-memory 60s cache, Binance ticker (fast, no rate-limits),
   * CoinGecko fallback, and resilient static fallback.
   */
  public static async getCryptoPrice(currencySymbol: string): Promise<number> {
    const sym = currencySymbol.toUpperCase();
    if (sym === 'USDT' || sym === 'USDC' || sym.includes('USDT') || sym.includes('USDC')) {
      return 1.0;
    }

    // 1. Check in-memory cache first
    const cached = this.priceCache.get(sym);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.price;
    }

    let fetchedPrice: number | null = null;

    // 2. Fast Binance Price Check for high-volume pairs (TON, BNB, TRX, SOL, ETH)
    try {
      const binancePairMap: Record<string, string> = {
        TON: 'TONUSDT',
        GRAM: 'TONUSDT',
        BNB: 'BNBUSDT',
        TRX: 'TRXUSDT',
        SOL: 'SOLUSDT',
        ETH: 'ETHUSDT',
      };

      const pair = binancePairMap[sym];
      if (pair) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const bData = (await res.json()) as { symbol: string; price: string };
          const p = parseFloat(bData.price);
          if (!isNaN(p) && p > 0) {
            fetchedPrice = p;
          }
        }
      }
    } catch {
      // Graceful fallback to CoinGecko
    }

    // 3. CoinGecko fallback if Binance did not return a price
    if (!fetchedPrice) {
      try {
        const coingeckoMap: Record<string, string> = {
          TON: 'the-open-network',
          GRAM: 'the-open-network',
          BNB: 'binancecoin',
          TRX: 'tron',
          SOL: 'solana',
          ETH: 'ethereum',
        };

        const coinId = coingeckoMap[sym];
        if (coinId) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
            { signal: controller.signal }
          );
          clearTimeout(timeout);

          if (res.ok) {
            const data = (await res.json()) as Record<string, { usd: number }>;
            if (data[coinId]?.usd) {
              fetchedPrice = data[coinId].usd;
            }
          }
        }
      } catch {
        // Fallback to static reference rates
      }
    }

    const finalPrice = fetchedPrice || this.FALLBACK_PRICES[sym] || 1.0;

    // Store in cache
    this.priceCache.set(sym, {
      price: finalPrice,
      expiresAt: Date.now() + this.PRICE_CACHE_TTL_MS,
    });

    return finalPrice;
  }

  /**
   * Calculate precise TON amount and nanoTON quote with decimal-safe arithmetic.
   * TON Amount = USD Amount / TON Price in USD
   * NanoTON = TON Amount * 1,000,000,000
   */
  public static async calculateTonQuote(amountUsd: number): Promise<{
    amountUsd: number;
    tonPriceUsd: number;
    tonAmount: number;
    nanoTonAmount: string;
    quoteExpiresAt: number;
  }> {
    const tonPriceUsd = await this.getCryptoPrice('TON');
    const safePrice = tonPriceUsd > 0 ? tonPriceUsd : 5.20;

    // Decimal-safe rounding to 4 decimal places for TON amount
    const rawTon = amountUsd / safePrice;
    const tonAmount = Math.round(rawTon * 10000) / 10000;
    const nanoTonAmount = BigInt(Math.round(tonAmount * 1_000_000_000)).toString();
    const quoteExpiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes quote validity

    return {
      amountUsd,
      tonPriceUsd: safePrice,
      tonAmount,
      nanoTonAmount,
      quoteExpiresAt,
    };
  }

  /**
   * Calculate expected crypto amount for a given USD target
   */
  public static async calculateCryptoAmount(amountUsd: number, currencySymbol: string): Promise<number> {
    const sym = currencySymbol.toUpperCase();
    if (sym === 'TON' || sym === 'GRAM') {
      const quote = await this.calculateTonQuote(amountUsd);
      return quote.tonAmount;
    }
    const price = await this.getCryptoPrice(currencySymbol);
    if (price <= 0) return amountUsd;
    const cryptoAmount = amountUsd / price;
    // Format to 6 decimal places
    return Math.round(cryptoAmount * 1000000) / 1000000;
  }

  /**
   * Send verified payment receipt notification to user's Telegram
   */
  public static async sendTelegramDepositNotification(
    telegramId: bigint,
    amountUsdt: number,
    amountPoops: bigint,
    network: string,
    txHash: string
  ): Promise<void> {
    try {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') {
        return;
      }

      const text =
        `✅ *Deposit Successful!*

💰 *Amount:* $${amountUsdt.toFixed(2)} USDT
🌐 *Network:* ${network}
⚡ *Status:* Completed
🔗 *TXID:* \`${txHash.slice(0, 10)}...${txHash.slice(-8)}\`

🪙 *Balance Credited:* +${amountPoops.toLocaleString()} Poops 💩

Your account balance has been updated immediately!`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId.toString(),
          text,
          parse_mode: 'Markdown',
        }),
      });
    } catch (err) {
      logger.warn('Failed to dispatch Telegram deposit notification:', err);
    }
  }

  /**
   * Atomically finalize and credit a verified deposit
   */
  public static async finalizeVerifiedDeposit(
    depositId: string,
    txHash: string,
    receivedCryptoAmount?: number
  ): Promise<{ success: boolean; message: string; newBalance?: number }> {
    return await prisma.$transaction(async (tx) => {
      const deposit = await tx.deposit.findUnique({
        where: { id: depositId },
        include: { user: true },
      });

      if (!deposit) {
        throw new Error('Deposit record not found');
      }

      if (deposit.status === 'COMPLETED' || deposit.status === 'CONFIRMED') {
        return { success: true, message: 'Deposit has already been verified and credited' };
      }

      // Check transaction hash uniqueness across all other deposits
      const cleanTx = txHash.trim();
      const existingHash = await tx.deposit.findFirst({
        where: {
          txHash: cleanTx,
          id: { not: depositId },
        },
      });

      if (existingHash) {
        throw new Error('This transaction hash has already been credited to another deposit');
      }

      const amountUsdtNum = Number(deposit.amountUsdt);
      const amountPoops = deposit.amountPoops;

      // 1. Double-entry ledger balance transaction
      const { balanceAfter } = await LedgerService.executeBalanceTransaction(tx, {
        userId: deposit.userId,
        type: 'DEPOSIT_CREDIT',
        amount: amountPoops,
        description: `Verified ${deposit.network} deposit ($${amountUsdtNum.toFixed(2)} USDT) [${cleanTx.slice(0, 8)}...]`,
        referenceId: deposit.id,
        idempotencyKey: `deposit_${deposit.id}_${cleanTx}`,
      });

      // 2. Update deposit status to COMPLETED
      await tx.deposit.update({
        where: { id: depositId },
        data: {
          status: 'COMPLETED',
          txHash: cleanTx,
          receivedCryptoAmount: receivedCryptoAmount ? receivedCryptoAmount : deposit.expectedCryptoAmount,
          confirmedAt: new Date(),
        },
      });

      // 2.5 Process 5K Members Celebration Campaign Enrollment & 30% Instant Cashback
      try {
        await CampaignService.processDepositForCampaign(tx, {
          id: deposit.id,
          userId: deposit.userId,
          amountUsdt: deposit.amountUsdt,
        });
      } catch (cErr) {
        logger.error('[DepositVerification] Campaign processing error:', cErr);
      }

      // 2.6 Grant withdrawal entitlement ($3 for 3 withdrawals, $5 for unlimited)
      try {
        await WithdrawalEntitlementService.processDepositConfirmed(tx, {
          userId: deposit.userId,
          amountUsdt: amountUsdtNum,
        });
      } catch (wErr) {
        logger.error('[DepositVerification] Withdrawal entitlement error:', wErr);
      }

      // 3. Dispatch Telegram Notification
      if (deposit.user?.telegramId) {
        DepositVerificationService.sendTelegramDepositNotification(
          deposit.user.telegramId,
          amountUsdtNum,
          amountPoops,
          deposit.network,
          cleanTx
        ).catch(() => { });
      }

      return {
        success: true,
        message: 'Deposit confirmed and balance credited successfully!',
        newBalance: Number(balanceAfter),
      };
    });
  }

  /**
   * Real-time on-chain verification of a TON deposit.
   * Queries TON blockchain (Toncenter v2 API), validates recipient, nanoTON amount, memo/deposit_id,
   * ensures transaction uniqueness, and atomically credits user balance.
   */
  public static async checkOnChainDeposit(
    depositId: string,
    userId: string
  ): Promise<{
    success: boolean;
    isCompleted: boolean;
    status: string;
    txHash?: string;
    newBalance?: number;
    message: string;
  }> {
    const deposit = await prisma.deposit.findUnique({
      where: { id: depositId },
      include: { user: true },
    });

    if (!deposit || deposit.userId !== userId) {
      throw new Error('Deposit record not found');
    }

    if (deposit.status === 'COMPLETED' || deposit.status === 'CONFIRMED') {
      return {
        success: true,
        isCompleted: true,
        status: 'COMPLETED',
        txHash: deposit.txHash || undefined,
        message: 'Deposit has already been verified and credited.',
      };
    }

    // Resolve official receiving address
    const treasury = deposit.depositAddress || env.TRUST_WALLET_TON_ADDRESS || 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR';
    const paymentRef = (deposit.paymentReference || '').trim();
    const userTelegramId = deposit.user?.telegramId?.toString() || '';
    const expectedTon = Number(deposit.expectedCryptoAmount || 0);
    const expectedNanoTon = BigInt(Math.round(expectedTon * 1_000_000_000));

    // Query Toncenter v2 API for incoming transactions with bounded 5s timeout
    let matchingTx: { hash: string; valueNanoTon: bigint; comment: string } | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const url = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(treasury)}&limit=35`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; result?: any[] };
        if (data.ok && Array.isArray(data.result)) {
          for (const tx of data.result) {
            const inMsg = tx.in_msg;
            if (!inMsg) continue;

            const txHash = tx.transaction_id?.hash;
            if (!txHash) continue;

            // In TON, in_msg.value is string in nanoTON
            const valStr = inMsg.value || '0';
            const valNanoTon = BigInt(valStr);

            // Extract message/memo/comment
            const memo = (inMsg.message || inMsg.msg_data?.text || '').trim();

            // Match memo against deposit reference or user Telegram ID or depositId
            const memoUpper = memo.toUpperCase();
            const refUpper = paymentRef.toUpperCase();
            const idUpper = deposit.id.toUpperCase();

            const isMemoMatch =
              Boolean(paymentRef && (memoUpper === refUpper || memoUpper.includes(refUpper))) ||
              Boolean(userTelegramId && (memo === userTelegramId || memoUpper.includes(userTelegramId))) ||
              Boolean(deposit.id && memoUpper.includes(idUpper));

            if (!isMemoMatch) continue;

            // Amount check with 2% slippage tolerance
            const minAcceptableNanoTon = (expectedNanoTon * 98n) / 100n;
            if (expectedNanoTon > 0n && valNanoTon < minAcceptableNanoTon) {
              logger.warn(`[OnChainVerify] Partial amount detected for deposit ${depositId}: expected ${expectedNanoTon}, got ${valNanoTon}`);
              continue;
            }

            // Check if txHash has already been credited in DB
            const existingTx = await prisma.deposit.findFirst({
              where: {
                txHash,
                id: { not: deposit.id },
                status: { in: ['COMPLETED', 'CONFIRMED'] },
              },
            });

            if (existingTx) {
              logger.warn(`[OnChainVerify] TX ${txHash} already credited to deposit ${existingTx.id}`);
              continue;
            }

            // Valid matching incoming transaction found!
            matchingTx = {
              hash: txHash,
              valueNanoTon: valNanoTon,
              comment: memo,
            };
            break;
          }
        }
      }
    } catch (apiErr) {
      logger.warn('[OnChainVerify] Toncenter request failed or timed out:', apiErr);
    }

    if (matchingTx) {
      const receivedTon = Number(matchingTx.valueNanoTon) / 1_000_000_000;
      const finalizeResult = await this.finalizeVerifiedDeposit(
        deposit.id,
        matchingTx.hash,
        receivedTon
      );

      return {
        success: true,
        isCompleted: true,
        status: 'COMPLETED',
        txHash: matchingTx.hash,
        newBalance: finalizeResult.newBalance,
        message: 'Deposit confirmed and balance credited successfully!',
      };
    }

    return {
      success: false,
      isCompleted: false,
      status: deposit.status,
      message: 'No matching transaction detected on TON blockchain yet. Please wait a few moments and try again.',
    };
  }
}

