import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { logger } from '../../utils/logger.js';

export interface CryptoPriceMap {
  [currency: string]: number; // price in USD
}

export class DepositVerificationService {
  /**
   * Fallback rates in USD per 1 unit of cryptocurrency
   */
  private static readonly FALLBACK_PRICES: CryptoPriceMap = {
    USDT: 1.0,
    USDC: 1.0,
    GRAM: 0.05,
    TON: 2.5,
    BNB: 650.0,
    TRX: 0.25,
    SOL: 180.0,
    ETH: 2600.0,
    BASE: 1.0,
  };

  /**
   * Fetch current market price in USD for a given currency
   */
  public static async getCryptoPrice(currencySymbol: string): Promise<number> {
    const sym = currencySymbol.toUpperCase();
    if (sym === 'USDT' || sym === 'USDC' || sym.includes('USDT') || sym.includes('USDC')) {
      return 1.0;
    }

    // Try fetching live price with timeout
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
            return data[coinId].usd;
          }
        }
      }
    } catch {
      // Graceful fallback to static reference rates
    }

    return this.FALLBACK_PRICES[sym] || 1.0;
  }

  /**
   * Calculate expected crypto amount for a given USD target
   */
  public static async calculateCryptoAmount(amountUsd: number, currencySymbol: string): Promise<number> {
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

      // 3. Dispatch Telegram Notification
      if (deposit.user?.telegramId) {
        DepositVerificationService.sendTelegramDepositNotification(
          deposit.user.telegramId,
          amountUsdtNum,
          amountPoops,
          deposit.network,
          cleanTx
        ).catch(() => {});
      }

      return {
        success: true,
        message: 'Deposit confirmed and balance credited successfully!',
        newBalance: Number(balanceAfter),
      };
    });
  }
}
