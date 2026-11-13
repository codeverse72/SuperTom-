import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { logger } from '../../utils/logger.js';
import { CampaignService } from '../campaign/campaignService.js';
import { WithdrawalEntitlementService } from './withdrawalEntitlementService.js';

export interface CryptoPriceMap {
  [currency: string]: number; // price in USD
}

export interface VerificationResult {
  verified: boolean;
  receivedAmount?: number;
  confirmations?: number;
  requiredConfirmations?: number;
  isAwaitingConfirmations?: boolean;
  blockNumber?: bigint;
  failureReason?: string;
  error?: string;
  explorerUrl?: string;
}

export interface MultiChainQuote {
  currency: string;
  network: string;
  amountUsd: number;
  cryptoPriceUsd: number;
  cryptoAmount: number;
  rawUnits: string;
  decimals: number;
  tokenContract?: string | null;
  walletLinks: {
    // Two-Wallet Protocol Links (Keeper & Trust Wallet)
    keeperSupported: boolean;
    keeperReasonIfNotSupported?: string;
    keeperUniversalUrl?: string;
    keeperDeepLink?: string;

    trustWalletSupported: boolean;
    trustWalletUrl?: string;

    // Backward-compatible fields
    tonkeeperUniversalUrl?: string;
    tonDeepLink?: string;
    webLauncherUrl?: string;
    telegramWalletUrl?: string;
    eip681Uri?: string;
    tronUri?: string;
    solanaPayUri?: string;
    phantomUrl?: string;
  };
  quoteExpiresAt: number;
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
    GRAM: 1.15,
    TON: 1.15,
    BNB: 650.0,
    TRX: 0.32,
    SOL: 85.0,
    ETH: 2100.0,
    BASE: 1.0,
  };

  /**
   * Decimal-safe conversion of human amount to blockchain base integer units (without float drift).
   */
  public static toBaseUnits(amount: number, decimals: number): string {
    if (amount <= 0 || isNaN(amount)) return '0';
    const parts = amount.toFixed(Math.min(decimals, 8)).split('.');
    const whole = BigInt(parts[0]);
    const fracStr = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
    const frac = BigInt(fracStr);
    return (whole * (10n ** BigInt(decimals)) + frac).toString();
  }

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

    // 2. TON Native Price Check via TonAPI (Tonkeeper's official live rate source)
    if (sym === 'TON' || sym === 'GRAM') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const tonRes = await fetch('https://tonapi.io/v2/rates?tokens=ton&currencies=usd', {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (tonRes.ok) {
          const tData = (await tonRes.json()) as { rates?: { TON?: { prices?: { USD?: number } } } };
          const p = tData.rates?.TON?.prices?.USD;
          if (p && p > 0) {
            fetchedPrice = p;
          }
        }
      } catch {
        // Fallback to CoinGecko below
      }
    }

    // 3. Fast Binance Price Check for BNB, TRX, SOL, ETH (high volume spot pairs)
    if (!fetchedPrice && sym !== 'TON' && sym !== 'GRAM') {
      try {
        const binancePairMap: Record<string, string> = {
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
    }

    // 4. CoinGecko fallback if TonAPI / Binance did not return a price
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
   * Centralized financial amount conversion service for all 7 supported payment options.
   * Uses exact decimal arithmetic and verifies tokens, decimals, and deep links.
   */
  public static async calculateMultiChainQuote(
    amountUsd: number,
    currencySymbol: string,
    networkName: string,
    recipientAddress: string,
    paymentReference: string,
    baseOrigin: string = 'https://super-tom.vercel.app'
  ): Promise<MultiChainQuote> {
    const sym = currencySymbol.toUpperCase();
    const net = networkName.toUpperCase();

    // Determine asset profile
    let decimals = 18;
    let tokenContract: string | null = null;
    let isStable = false;
    let priceSymbol = sym;
    let normalizedCurrency = sym;

    const isTon = sym === 'TON' || sym === 'GRAM' || net.includes('TON');
    const isUsdtBep20 = (sym === 'USDT' || sym === 'USDT_BEP20') && (net.includes('BNB') || net.includes('BEP20') || net.includes('BSC'));
    const isUsdtTrc20 = (sym === 'USDT' || sym === 'USDT_TRC20') && (net.includes('TRON') || net.includes('TRC20'));
    const isBnb = sym === 'BNB' && (net.includes('BNB') || net.includes('BEP20') || net.includes('BSC'));
    const isTrx = sym === 'TRX' && (net.includes('TRON') || net.includes('TRC20'));
    const isSol = sym === 'SOL' || net.includes('SOL');
    const isUsdcBase = (sym === 'USDC' || sym === 'USDC_BASE' || (net.includes('BASE') && sym.includes('USDC')));
    const isEthBase = (sym === 'ETH' || sym === 'ETH_BASE' || (net.includes('BASE') && !sym.includes('USDC')));

    if (isTon) {
      decimals = 9;
      priceSymbol = 'TON';
      normalizedCurrency = 'TON';
    } else if (isUsdtBep20) {
      decimals = 18;
      tokenContract = '0x55d398326f99059fF775485246999027B3197955';
      isStable = true;
      normalizedCurrency = 'USDT';
    } else if (isUsdtTrc20) {
      decimals = 6;
      tokenContract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      isStable = true;
      normalizedCurrency = 'USDT';
    } else if (isBnb) {
      decimals = 18;
      priceSymbol = 'BNB';
      normalizedCurrency = 'BNB';
    } else if (isTrx) {
      decimals = 6;
      priceSymbol = 'TRX';
      normalizedCurrency = 'TRX';
    } else if (isSol) {
      decimals = 9;
      priceSymbol = 'SOL';
      normalizedCurrency = 'SOL';
    } else if (isUsdcBase) {
      decimals = 6;
      tokenContract = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      isStable = true;
      normalizedCurrency = 'USDC';
    } else if (isEthBase) {
      decimals = 18;
      priceSymbol = 'ETH';
      normalizedCurrency = 'ETH';
    }

    const cryptoPriceUsd = isStable ? 1.0 : await this.getCryptoPrice(priceSymbol);
    const safePrice = cryptoPriceUsd > 0 ? cryptoPriceUsd : 1.0;

    let cryptoAmount: number;
    if (isStable) {
      cryptoAmount = amountUsd;
    } else if (decimals >= 18) {
      // 5 decimals for BNB / ETH
      cryptoAmount = Math.round((amountUsd / safePrice) * 100000) / 100000;
    } else {
      // 4 decimals for TON, TRX, SOL
      cryptoAmount = Math.round((amountUsd / safePrice) * 10000) / 10000;
    }

    const rawUnits = this.toBaseUnits(cryptoAmount, decimals);
    const quoteExpiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    // Build platform & wallet URLs for the TWO-WALLET system (Keeper & Trust Wallet)
    const walletLinks: MultiChainQuote['walletLinks'] = {
      keeperSupported: false,
      trustWalletSupported: true,
    };

    if (isTon) {
      walletLinks.keeperSupported = true;
      walletLinks.keeperUniversalUrl = `https://app.tonkeeper.com/transfer/${recipientAddress}?amount=${rawUnits}&text=${encodeURIComponent(paymentReference)}`;
      walletLinks.keeperDeepLink = `ton://transfer/${recipientAddress}?amount=${rawUnits}&text=${encodeURIComponent(paymentReference)}`;
      walletLinks.tonkeeperUniversalUrl = walletLinks.keeperUniversalUrl;
      walletLinks.tonDeepLink = walletLinks.keeperDeepLink;
      walletLinks.webLauncherUrl = `${baseOrigin}/open-tonkeeper.html?address=${encodeURIComponent(recipientAddress)}&amount=${rawUnits}&text=${encodeURIComponent(paymentReference)}&usd=${amountUsd.toFixed(2)}`;
      
      // Trust Wallet official send link for TON (asset=c607)
      walletLinks.trustWalletSupported = true;
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c607&address=${recipientAddress}&amount=${cryptoAmount}&memo=${encodeURIComponent(paymentReference)}`;
      walletLinks.telegramWalletUrl = 'https://t.me/wallet';
    } else if (isUsdtBep20) {
      walletLinks.keeperSupported = false;
      walletLinks.keeperReasonIfNotSupported = 'Keeper (Tonkeeper) is TON-native and does not support BNB Smart Chain BEP20 transfers.';
      walletLinks.trustWalletSupported = true;
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c20000714_t${tokenContract}&address=${recipientAddress}&amount=${cryptoAmount}`;
      walletLinks.eip681Uri = `ethereum:${tokenContract}@56/transfer?address=${recipientAddress}&uint256=${rawUnits}`;
    } else if (isBnb) {
      walletLinks.keeperSupported = false;
      walletLinks.keeperReasonIfNotSupported = 'Keeper (Tonkeeper) is TON-native and does not support BNB Smart Chain transfers.';
      walletLinks.trustWalletSupported = true;
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c20000714&address=${recipientAddress}&amount=${cryptoAmount}`;
      walletLinks.eip681Uri = `ethereum:${recipientAddress}@56?value=${rawUnits}`;
    } else if (isUsdtTrc20) {
      walletLinks.keeperSupported = false;
      walletLinks.keeperReasonIfNotSupported = 'Keeper (Tonkeeper) does not support TRON network direct transfers.';
      walletLinks.trustWalletSupported = true;
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c195_t${tokenContract}&address=${recipientAddress}&amount=${cryptoAmount}`;
      walletLinks.tronUri = `tron:${recipientAddress}?token=${tokenContract}&amount=${rawUnits}`;
    } else if (isTrx) {
      walletLinks.keeperSupported = false;
      walletLinks.keeperReasonIfNotSupported = 'Keeper (Tonkeeper) does not support TRON network transfers.';
      walletLinks.trustWalletSupported = true;
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c195&address=${recipientAddress}&amount=${cryptoAmount}`;
      walletLinks.tronUri = `tron:${recipientAddress}?amount=${rawUnits}`;
    } else if (isSol) {
      walletLinks.keeperSupported = false;
      walletLinks.keeperReasonIfNotSupported = 'Keeper (Tonkeeper) does not support Solana network transfers.';
      walletLinks.trustWalletSupported = true;
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c501&address=${recipientAddress}&amount=${cryptoAmount}&memo=${encodeURIComponent(paymentReference)}`;
      walletLinks.solanaPayUri = `solana:${recipientAddress}?amount=${cryptoAmount}&reference=${paymentReference}&memo=${encodeURIComponent(paymentReference)}`;
    } else if (isUsdcBase) {
      walletLinks.keeperSupported = false;
      walletLinks.keeperReasonIfNotSupported = 'Keeper (Tonkeeper) is TON-native and does not support Base network transfers.';
      walletLinks.trustWalletSupported = true;
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c8453_t${tokenContract}&address=${recipientAddress}&amount=${cryptoAmount}`;
      walletLinks.eip681Uri = `ethereum:${tokenContract}@8453/transfer?address=${recipientAddress}&uint256=${rawUnits}`;
    } else if (isEthBase) {
      walletLinks.keeperSupported = false;
      walletLinks.keeperReasonIfNotSupported = 'Keeper (Tonkeeper) is TON-native and does not support Base network transfers.';
      walletLinks.trustWalletSupported = true;
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c8453&address=${recipientAddress}&amount=${cryptoAmount}`;
      walletLinks.eip681Uri = `ethereum:${recipientAddress}@8453?value=${rawUnits}`;
    }

    return {
      currency: normalizedCurrency,
      network: networkName,
      amountUsd,
      cryptoPriceUsd: safePrice,
      cryptoAmount,
      rawUnits,
      decimals,
      tokenContract,
      walletLinks,
      quoteExpiresAt,
    };
  }

  /**
   * Backward-compatible TON quote calculator
   */
  public static async calculateTonQuote(amountUsd: number): Promise<{
    amountUsd: number;
    tonPriceUsd: number;
    tonAmount: number;
    nanoTonAmount: string;
    quoteExpiresAt: number;
  }> {
    const q = await this.calculateMultiChainQuote(amountUsd, 'TON', 'TON', '', '');
    return {
      amountUsd,
      tonPriceUsd: q.cryptoPriceUsd,
      tonAmount: q.cryptoAmount,
      nanoTonAmount: q.rawUnits,
      quoteExpiresAt: q.quoteExpiresAt,
    };
  }

  /**
   * Backward-compatible generic crypto calculator
   */
  public static async calculateCryptoAmount(amountUsd: number, currencySymbol: string): Promise<number> {
    const q = await this.calculateMultiChainQuote(amountUsd, currencySymbol, '', '', '');
    return q.cryptoAmount;
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

🪙 *Balance Credited:* +${amountPoops.toLocaleString()} TomCoins 👑

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
   * Telegram Notification: Detected incoming transaction waiting for blockchain confirmations.
   */
  public static async sendTelegramDepositDetectedNotification(
    telegramId: bigint,
    amount: number | string,
    currency: string,
    network: string,
    txHash: string,
    confirmations: number,
    requiredConfirmations: number
  ): Promise<void> {
    try {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') return;

      const shortHash = txHash.length > 20 ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : txHash;

      const text =
`⏳ *Deposit Detected!*

We detected an incoming deposit waiting for blockchain confirmations (${confirmations}/${requiredConfirmations}).

💰 *Currency:* ${currency}
🌐 *Network:* ${network}
💎 *Amount:* ${amount} ${currency}
🔗 *TXID:* \`${shortHash}\`

Your balance will be credited automatically once confirmed!`;

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
      logger.warn('Failed to send Telegram deposit detected notification:', err);
    }
  }

  /**
   * Resolves the official block explorer link for any supported network.
   */
  public static getExplorerUrl(network: string, txHash: string): string {
    const cleanTx = (txHash || '').trim();
    if (!cleanTx) return '';
    const net = (network || '').toUpperCase();
    if (net.includes('TON')) {
      return `https://tonviewer.com/transaction/${cleanTx}`;
    }
    if (net.includes('TRON') || net.includes('TRC20') || net.includes('TRX')) {
      return `https://tronscan.org/#/transaction/${cleanTx}`;
    }
    if (net.includes('BNB') || net.includes('BEP20') || net.includes('BSC')) {
      return `https://bscscan.com/tx/${cleanTx}`;
    }
    if (net.includes('BASE')) {
      return `https://basescan.org/tx/${cleanTx}`;
    }
    if (net.includes('SOL')) {
      return `https://solscan.io/tx/${cleanTx}`;
    }
    if (net.includes('ETH') || net.includes('ERC20')) {
      return `https://etherscan.io/tx/${cleanTx}`;
    }
    return `https://bscscan.com/tx/${cleanTx}`;
  }

  /**
   * Required confirmation threshold per network to guarantee finality.
   */
  public static getRequiredConfirmations(network: string): number {
    const net = (network || '').toUpperCase();
    if (net.includes('TON')) return 1;
    if (net.includes('TRON') || net.includes('TRC20')) return 19; // Solid block finality
    if (net.includes('BNB') || net.includes('BEP20') || net.includes('BSC')) return 3;
    if (net.includes('BASE')) return 6;
    if (net.includes('ETH') || net.includes('ERC20')) return 3;
    if (net.includes('SOL')) return 1;
    return 1;
  }

  /**
   * Verified token contract address for legitimate tokens.
   */
  public static getTokenContract(network: string, currency: string): string | null {
    const net = (network || '').toUpperCase();
    const curr = (currency || '').toUpperCase();
    if (curr.includes('USDT')) {
      if (net.includes('TRON') || net.includes('TRC20')) return 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      if (net.includes('BNB') || net.includes('BEP20') || net.includes('BSC')) return '0x55d398326f99059fF775485246999027B3197955';
      if (net.includes('ETH') || net.includes('ERC20')) return '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    }
    if (curr.includes('USDC')) {
      if (net.includes('BASE')) return '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      if (net.includes('ETH') || net.includes('ERC20')) return '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    }
    return null;
  }

  /**
   * Atomically finalize and credit a verified deposit.
   * NO REWARD OR BALANCE MAY EVER BE RELEASED WITHOUT ATOMIC LEDGER RECORDING.
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

      if (['COMPLETED', 'CONFIRMED', 'CREDITED', 'SUCCESS'].includes(deposit.status)) {
        return { success: true, message: 'Deposit has already been verified and credited' };
      }

      // Check transaction hash uniqueness across all other completed deposits
      const cleanTx = txHash.trim();
      const existingHash = await tx.deposit.findFirst({
        where: {
          txHash: cleanTx,
          id: { not: depositId },
          status: { in: ['COMPLETED', 'CONFIRMED', 'CREDITED', 'SUCCESS'] },
        },
      });

      if (existingHash) {
        throw new Error('This transaction hash has already been credited to another deposit');
      }

      if (!deposit.userId) {
        throw new Error('Cannot finalize deposit without an associated userId');
      }

      const amountUsdtNum = Number(deposit.amountUsdt);
      const amountPoops = deposit.amountPoops;
      const explorerUrl = this.getExplorerUrl(deposit.network, cleanTx);

      // 1. Double-entry ledger balance transaction
      const { balanceAfter } = await LedgerService.executeBalanceTransaction(tx, {
        userId: deposit.userId,
        type: 'DEPOSIT_CREDIT',
        amount: amountPoops,
        description: `Verified ${deposit.network} deposit ($${amountUsdtNum.toFixed(2)} USDT) [${cleanTx.slice(0, 8)}...]`,
        referenceId: deposit.id,
        idempotencyKey: `deposit_${deposit.id}_${cleanTx}`,
      });

      // 2. Update deposit status to CREDITED (and COMPLETED for backward compatibility)
      await tx.deposit.update({
        where: { id: depositId },
        data: {
          status: 'CREDITED',
          txHash: cleanTx,
          receivedCryptoAmount: receivedCryptoAmount ? receivedCryptoAmount : deposit.expectedCryptoAmount,
          verifiedAt: deposit.verifiedAt || new Date(),
          creditedAt: new Date(),
          confirmedAt: new Date(),
          explorerUrl,
          rewardAmount: deposit.amountUsdt,
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
   * Verify an EVM transaction on BSC, Base, or Ethereum via JSON-RPC.
   * Calculates block confirmations and enforces exact recipient and token contracts.
   */
  public static async verifyEvmTransaction(
    txHash: string,
    rpcUrl: string,
    expectedRecipient: string,
    tokenContract: string | null,
    expectedCryptoAmount: number,
    decimals: number,
    requiredConfirmations: number = 3
  ): Promise<VerificationResult> {
    try {
      const cleanTx = txHash.trim();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      // 1. Fetch Transaction Receipt
      const receiptRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionReceipt',
          params: [cleanTx],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!receiptRes.ok) return { verified: false, error: 'RPC call failed' };
      const receiptData = (await receiptRes.json()) as { result?: any };
      const receipt = receiptData.result;
      if (!receipt) {
        return { verified: false, error: 'Transaction pending or not indexed yet on blockchain' };
      }
      if (receipt.status === '0x0') {
        return { verified: false, failureReason: 'TX_REVERTED', error: 'Transaction reverted on blockchain' };
      }
      if (receipt.status !== '0x1') {
        return { verified: false, error: 'Transaction unconfirmed or failed' };
      }

      // 2. Fetch current block number to compute exact confirmations
      let confirmations = 1;
      const blockNumberBigInt: bigint | undefined = receipt.blockNumber ? BigInt(receipt.blockNumber) : undefined;
      try {
        const blockRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'eth_blockNumber',
            params: [],
          }),
        });
        if (blockRes.ok) {
          const bData = (await blockRes.json()) as { result?: string };
          if (bData.result && receipt.blockNumber) {
            const currentBlock = BigInt(bData.result);
            const txBlock = BigInt(receipt.blockNumber);
            if (currentBlock >= txBlock) {
              confirmations = Number(currentBlock - txBlock + 1n);
            }
          }
        }
      } catch {
        // Fallback to 1 confirmation if blockNumber call timed out
      }

      const expectedRaw = BigInt(this.toBaseUnits(expectedCryptoAmount, decimals));
      const minAcceptable = (expectedRaw * 98n) / 100n; // 2% slippage tolerance

      if (tokenContract) {
        // ERC-20 Transfer check
        const cleanContract = tokenContract.toLowerCase();
        const cleanRecipient = expectedRecipient.toLowerCase().replace('0x', '');
        const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

        for (const log of receipt.logs || []) {
          if (log.address?.toLowerCase() === cleanContract && log.topics?.[0]?.toLowerCase() === transferTopic) {
            const toTopic = (log.topics[2] || '').toLowerCase();
            if (toTopic.endsWith(cleanRecipient)) {
              const val = BigInt(log.data || '0x0');
              if (val >= minAcceptable) {
                const received = Number(val) / 10 ** decimals;
                const isAwaiting = confirmations < requiredConfirmations;
                return {
                  verified: true,
                  receivedAmount: received,
                  confirmations,
                  requiredConfirmations,
                  isAwaitingConfirmations: isAwaiting,
                  blockNumber: blockNumberBigInt,
                };
              } else {
                return {
                  verified: false,
                  failureReason: 'UNDERPAID',
                  error: `Underpaid: received ${Number(val) / 10 ** decimals}, expected ${expectedCryptoAmount}`,
                };
              }
            }
          }
        }
        return { verified: false, failureReason: 'TOKEN_OR_RECIPIENT_MISMATCH', error: 'No matching ERC-20 transfer event found for expected token and recipient' };
      } else {
        // Native transfer check (BNB or ETH)
        const txRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'eth_getTransactionByHash',
            params: [cleanTx],
          }),
        });
        const txData = (await txRes.json()) as { result?: any };
        const tx = txData.result;
        if (tx && tx.to?.toLowerCase() === expectedRecipient.toLowerCase()) {
          const val = BigInt(tx.value || '0x0');
          if (val >= minAcceptable) {
            const received = Number(val) / 10 ** decimals;
            const isAwaiting = confirmations < requiredConfirmations;
            return {
              verified: true,
              receivedAmount: received,
              confirmations,
              requiredConfirmations,
              isAwaitingConfirmations: isAwaiting,
              blockNumber: blockNumberBigInt,
            };
          } else {
            return {
              verified: false,
              failureReason: 'UNDERPAID',
              error: `Underpaid: received ${Number(val) / 10 ** decimals}, expected ${expectedCryptoAmount}`,
            };
          }
        }
        return { verified: false, failureReason: 'RECIPIENT_MISMATCH', error: 'Recipient or native value mismatch' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'EVM verification error';
      return { verified: false, error: msg };
    }
  }

  /**
   * Verify a TRON transaction (TRC-20 USDT or Native TRX) via public Tronscan API with Trongrid fallback.
   */
  public static async verifyTronTransaction(
    txHash: string,
    expectedRecipient: string,
    tokenContract: string | null,
    expectedCryptoAmount: number,
    requiredConfirmations: number = 19
  ): Promise<VerificationResult> {
    try {
      const cleanTx = txHash.trim();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const url = `https://apilist.tronscanapi.com/api/transaction-info?hash=${cleanTx}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        return await this.verifyTronViaTrongrid(cleanTx, expectedRecipient, tokenContract, expectedCryptoAmount, requiredConfirmations);
      }
      const data = (await res.json()) as any;
      if (!data || !data.hash) {
        return await this.verifyTronViaTrongrid(cleanTx, expectedRecipient, tokenContract, expectedCryptoAmount, requiredConfirmations);
      }

      if (data.contractRet && data.contractRet !== 'SUCCESS') {
        return { verified: false, failureReason: 'TX_REVERTED', error: `TRON contract execution failed: ${data.contractRet}` };
      }

      const expectedRaw = BigInt(this.toBaseUnits(expectedCryptoAmount, 6));
      const minAcceptable = (expectedRaw * 98n) / 100n;
      const isConfirmed = Boolean(data.confirmed);
      const confirmations = isConfirmed ? 19 : 1;
      const isAwaiting = confirmations < requiredConfirmations;
      const blockNumber = data.block ? BigInt(data.block) : undefined;

      if (tokenContract) {
        // TRC-20 USDT check
        const transfers = data.trc20TransferInfo || [];
        for (const t of transfers) {
          if (
            t.to_address === expectedRecipient &&
            (t.contract_address === tokenContract || !tokenContract)
          ) {
            const val = BigInt(t.amount_str || '0');
            if (val >= minAcceptable) {
              return {
                verified: true,
                receivedAmount: Number(val) / 1e6,
                confirmations,
                requiredConfirmations,
                isAwaitingConfirmations: isAwaiting,
                blockNumber,
              };
            } else {
              return {
                verified: false,
                failureReason: 'UNDERPAID',
                error: `Underpaid TRC20: received ${Number(val) / 1e6}, expected ${expectedCryptoAmount}`,
              };
            }
          }
        }
        return { verified: false, failureReason: 'TOKEN_OR_RECIPIENT_MISMATCH', error: 'No matching TRC20 transfer found to treasury address' };
      } else {
        // Native TRX transfer
        const contractData = data.contractData || {};
        if (contractData.to_address === expectedRecipient) {
          const val = BigInt(contractData.amount || '0');
          if (val >= minAcceptable) {
            return {
              verified: true,
              receivedAmount: Number(val) / 1e6,
              confirmations,
              requiredConfirmations,
              isAwaitingConfirmations: isAwaiting,
              blockNumber,
            };
          } else {
            return {
              verified: false,
              failureReason: 'UNDERPAID',
              error: `Underpaid TRX: received ${Number(val) / 1e6}, expected ${expectedCryptoAmount}`,
            };
          }
        }
        return { verified: false, failureReason: 'RECIPIENT_MISMATCH', error: 'TRX recipient or value mismatch' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'TRON verification error';
      return { verified: false, error: msg };
    }
  }

  private static async verifyTronViaTrongrid(
    cleanTx: string,
    expectedRecipient: string,
    tokenContract: string | null,
    expectedCryptoAmount: number,
    requiredConfirmations: number = 19
  ): Promise<VerificationResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('https://api.trongrid.io/wallet/gettransactioninfobyid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: cleanTx }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return { verified: false, error: 'TronGrid request failed' };
      const data = (await res.json()) as any;
      if (!data || !data.id) return { verified: false, error: 'Transaction not found on TRON' };

      if (data.receipt?.result && data.receipt.result !== 'SUCCESS') {
        return { verified: false, failureReason: 'TX_REVERTED', error: `TRON transaction failed: ${data.receipt.result}` };
      }

      const expectedRaw = BigInt(this.toBaseUnits(expectedCryptoAmount, 6));
      const minAcceptable = (expectedRaw * 98n) / 100n;
      const blockNumber = data.blockNumber ? BigInt(data.blockNumber) : undefined;
      const confirmations = 19; // Solid block finality

      if (tokenContract) {
        for (const log of data.log || []) {
          if (log.topics?.[0] === 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
            const val = BigInt('0x' + (log.data || '0'));
            if (val >= minAcceptable) {
              return {
                verified: true,
                receivedAmount: Number(val) / 1e6,
                confirmations,
                requiredConfirmations,
                isAwaitingConfirmations: false,
                blockNumber,
              };
            }
          }
        }
      }
      return { verified: false, error: 'Could not verify TRON transfer on Trongrid' };
    } catch (err: unknown) {
      return { verified: false, error: err instanceof Error ? err.message : 'Trongrid error' };
    }
  }

  /**
   * Verify a Solana transaction via official public Solana JSON-RPC.
   */
  public static async verifySolanaTransaction(
    txHash: string,
    expectedRecipient: string,
    expectedCryptoAmount: number
  ): Promise<VerificationResult> {
    try {
      const cleanTx = txHash.trim();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [
            cleanTx,
            { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return { verified: false, error: 'Solana RPC request failed' };
      const data = (await res.json()) as any;
      const tx = data.result;
      if (!tx) {
        return { verified: false, error: 'Solana transaction not found or unconfirmed' };
      }
      if (tx.meta?.err) {
        return { verified: false, failureReason: 'TX_REVERTED', error: 'Solana transaction failed or reverted' };
      }

      // Check balance changes for recipient account
      const accounts: string[] = (tx.transaction?.message?.accountKeys || []).map((k: any) =>
        typeof k === 'string' ? k : k.pubkey
      );
      const recipientIdx = accounts.indexOf(expectedRecipient);
      if (recipientIdx !== -1) {
        const pre = BigInt(tx.meta.preBalances?.[recipientIdx] || '0');
        const post = BigInt(tx.meta.postBalances?.[recipientIdx] || '0');
        const diff = post > pre ? post - pre : 0n;
        const expectedLamports = BigInt(this.toBaseUnits(expectedCryptoAmount, 9));
        const minAcceptable = (expectedLamports * 98n) / 100n;

        if (diff >= minAcceptable) {
          return {
            verified: true,
            receivedAmount: Number(diff) / 1e9,
            confirmations: 1,
            requiredConfirmations: 1,
            isAwaitingConfirmations: false,
          };
        } else {
          return {
            verified: false,
            failureReason: 'UNDERPAID',
            error: `Underpaid: received ${Number(diff) / 1e9} SOL, expected ${expectedCryptoAmount}`,
          };
        }
      }
      return { verified: false, failureReason: 'RECIPIENT_MISMATCH', error: 'Recipient address not found in transaction accounts' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Solana verification error';
      return { verified: false, error: msg };
    }
  }

  /**
   * Unified, Production-Ready Blockchain Verification & Automatic Crediting Engine.
   * Enforces zero admin intervention for legitimate on-chain transfers.
   */
  public static async verifyAndProcessDeposit(
    depositId: string,
    providedTxHash?: string
  ): Promise<{
    success: boolean;
    isCompleted: boolean;
    status: string;
    confirmations?: number;
    requiredConfirmations?: number;
    explorerUrl?: string;
    newBalance?: number;
    message: string;
  }> {
    const deposit = await prisma.deposit.findUnique({
      where: { id: depositId },
      include: { user: true },
    });

    if (!deposit) {
      throw new Error('Deposit record not found');
    }

    // Idempotency: If already credited, return completed state immediately
    if (['CREDITED', 'COMPLETED', 'CONFIRMED', 'SUCCESS'].includes(deposit.status)) {
      return {
        success: true,
        isCompleted: true,
        status: 'CREDITED',
        confirmations: deposit.confirmations,
        requiredConfirmations: deposit.requiredConfirmations,
        explorerUrl: deposit.explorerUrl || (deposit.txHash ? this.getExplorerUrl(deposit.network, deposit.txHash) : undefined),
        message: 'Deposit has already been verified and credited.',
      };
    }

    let cleanTx = (providedTxHash || deposit.txHash || '').trim();
    if (cleanTx.includes('/')) {
      const parts = cleanTx.split('/');
      cleanTx = parts[parts.length - 1].replace(/^[#?]/, '').trim() || cleanTx;
    }

    const netUpper = (deposit.network || '').toUpperCase();
    const currUpper = (deposit.currency || '').toUpperCase();
    const isTon = netUpper.includes('TON') || currUpper === 'TON' || currUpper === 'GRAM';
    const isTron = netUpper.includes('TRON') || netUpper.includes('TRC20') || currUpper === 'TRX';
    const isBsc = netUpper.includes('BNB') || netUpper.includes('BEP20') || netUpper.includes('BSC') || currUpper === 'BNB';
    const isBase = netUpper.includes('BASE');
    const isEth = netUpper.includes('ETH') || netUpper.includes('ERC20');
    const isSolana = netUpper.includes('SOL') || currUpper === 'SOL';

    // TON can also scan by treasury address if cleanTx is empty
    if (!cleanTx && !isTon) {
      return {
        success: false,
        isCompleted: false,
        status: deposit.status,
        message: 'Transaction hash is required for blockchain verification.',
      };
    }

    // Check duplicate hash across all completed deposits
    if (cleanTx) {
      const existingOther = await prisma.deposit.findFirst({
        where: {
          txHash: cleanTx,
          id: { not: deposit.id },
          status: { in: ['CREDITED', 'COMPLETED', 'CONFIRMED', 'SUCCESS', 'VERIFIED'] },
        },
      });

      if (existingOther) {
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: {
            status: 'REJECTED',
            failureReason: 'DUPLICATE_TX_HASH',
            notes: 'Duplicate transaction hash: already credited to another deposit.',
          },
        }).catch(() => {});

        return {
          success: false,
          isCompleted: false,
          status: 'REJECTED',
          message: 'This transaction hash has already been credited to another deposit.',
        };
      }
    }

    // Advance status to VERIFYING
    await prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        status: 'VERIFYING',
        txHash: cleanTx || deposit.txHash,
      },
    }).catch(() => {});

    const expectedAmount = Number(deposit.expectedCryptoAmount || deposit.amountUsdt);
    let vRes: VerificationResult = { verified: false, error: 'Unsupported network' };

    if (isTon) {
      let treasury = deposit.depositAddress;
      if (!treasury) {
        const tonConfig = await prisma.tonPaymentConfig.findUnique({ where: { id: 'singleton' } }).catch(() => null);
        treasury = tonConfig?.tonReceivingAddress || env.TRUST_WALLET_TON_ADDRESS || 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR';
      }
      const paymentRef = (deposit.paymentReference || '').trim();
      const userTelegramId = deposit.user?.telegramId?.toString() || '';
      const expectedNanoTon = BigInt(Math.round(expectedAmount * 1_000_000_000));

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const url = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(treasury)}&limit=40`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; result?: any[] };
          if (data.ok && Array.isArray(data.result)) {
            for (const tx of data.result) {
              const inMsg = tx.in_msg;
              if (!inMsg) continue;
              const txH = tx.transaction_id?.hash;
              if (!txH) continue;

              const valNanoTon = BigInt(inMsg.value || '0');
              const memo = (inMsg.message || inMsg.msg_data?.text || '').trim();
              const memoUpper = memo.toUpperCase();
              const refUpper = paymentRef.toUpperCase();
              const idUpper = deposit.id.toUpperCase();

              const isHashMatch = Boolean(cleanTx && (txH === cleanTx || txH.toLowerCase() === cleanTx.toLowerCase()));
              const isMemoMatch =
                Boolean(paymentRef && (memoUpper === refUpper || memoUpper.includes(refUpper))) ||
                Boolean(userTelegramId && (memo === userTelegramId || memoUpper.includes(userTelegramId))) ||
                Boolean(deposit.id && memoUpper.includes(idUpper));

              if (isHashMatch || isMemoMatch) {
                const minAcceptable = (expectedNanoTon * 98n) / 100n;
                if (expectedNanoTon > 0n && valNanoTon < minAcceptable) {
                  vRes = {
                    verified: false,
                    failureReason: 'UNDERPAID',
                    error: `Partial payment received (${(Number(valNanoTon) / 1e9).toFixed(4)} TON). Required: ${expectedAmount} TON.`,
                  };
                  break;
                }

                cleanTx = txH;
                vRes = {
                  verified: true,
                  receivedAmount: Number(valNanoTon) / 1e9,
                  confirmations: 1,
                  requiredConfirmations: 1,
                  isAwaitingConfirmations: false,
                };
                break;
              }
            }
          }
        }
      } catch (tonErr) {
        logger.warn('[verifyAndProcessDeposit] TON fetch error:', tonErr);
      }
    } else if (isBsc) {
      const isUsdt = currUpper.includes('USDT');
      const tokenContract = isUsdt ? '0x55d398326f99059fF775485246999027B3197955' : null;
      const recipient = deposit.depositAddress || env.TREASURY_EVM_ADDRESS || '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1';
      vRes = await this.verifyEvmTransaction(
        cleanTx,
        'https://bsc-dataseed.binance.org',
        recipient,
        tokenContract,
        expectedAmount,
        18,
        3
      );
    } else if (isBase) {
      const isUsdc = currUpper.includes('USDC') || netUpper.includes('USDC');
      const tokenContract = isUsdc ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' : null;
      const decimals = isUsdc ? 6 : 18;
      const recipient = deposit.depositAddress || env.TREASURY_EVM_ADDRESS || '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1';
      vRes = await this.verifyEvmTransaction(
        cleanTx,
        'https://mainnet.base.org',
        recipient,
        tokenContract,
        expectedAmount,
        decimals,
        6
      );
    } else if (isEth) {
      const isUsdc = currUpper.includes('USDC');
      const isUsdt = currUpper.includes('USDT');
      const tokenContract = isUsdc
        ? '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        : isUsdt
        ? '0xdAC17F958D2ee523a2206206994597C13D831ec7'
        : null;
      const decimals = (isUsdc || isUsdt) ? 6 : 18;
      const recipient = deposit.depositAddress || env.TREASURY_EVM_ADDRESS || '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1';
      vRes = await this.verifyEvmTransaction(
        cleanTx,
        'https://eth.llamarpc.com',
        recipient,
        tokenContract,
        expectedAmount,
        decimals,
        3
      );
    } else if (isTron) {
      const isUsdt = currUpper.includes('USDT');
      const tokenContract = isUsdt ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' : null;
      const recipient = deposit.depositAddress || env.TREASURY_TRON_ADDRESS || 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv';
      vRes = await this.verifyTronTransaction(
        cleanTx,
        recipient,
        tokenContract,
        expectedAmount,
        19
      );
    } else if (isSolana) {
      const recipient = deposit.depositAddress || env.TREASURY_SOL_ADDRESS || 'ER74j5s2PgVPx9dsT7wqyMSM7RgY4LKrFt9c1NFp92Qk';
      vRes = await this.verifySolanaTransaction(cleanTx, recipient, expectedAmount);
    }

    const explorerUrl = cleanTx ? this.getExplorerUrl(deposit.network, cleanTx) : undefined;

    // Handle verification outcomes:
    if (!vRes.verified) {
      if (vRes.failureReason === 'TX_REVERTED' || vRes.failureReason === 'TOKEN_OR_RECIPIENT_MISMATCH' || vRes.failureReason === 'UNDERPAID') {
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: {
            status: 'REJECTED',
            failureReason: vRes.failureReason,
            notes: vRes.error || 'Verification failed',
            explorerUrl,
          },
        }).catch(() => {});

        return {
          success: false,
          isCompleted: false,
          status: 'REJECTED',
          explorerUrl,
          message: vRes.error || 'Transaction verification failed on blockchain.',
        };
      }

      // Transaction not found or not indexed yet
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: 'HASH_SUBMITTED',
          txHash: cleanTx || deposit.txHash,
          explorerUrl,
        },
      }).catch(() => {});

      return {
        success: false,
        isCompleted: false,
        status: 'HASH_SUBMITTED',
        explorerUrl,
        message: vRes.error || 'Transaction proof received. Waiting for blockchain indexing...',
      };
    }

    // If verified on-chain but awaiting required confirmations
    if (vRes.isAwaitingConfirmations) {
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: 'AWAITING_CONFIRMATIONS',
          txHash: cleanTx,
          confirmations: vRes.confirmations || 0,
          requiredConfirmations: vRes.requiredConfirmations || 1,
          blockNumber: vRes.blockNumber,
          receivedCryptoAmount: vRes.receivedAmount,
          explorerUrl,
        },
      }).catch(() => {});

      if (deposit.user?.telegramId) {
        this.sendTelegramDepositDetectedNotification(
          deposit.user.telegramId,
          (vRes.receivedAmount || expectedAmount).toFixed(4),
          deposit.currency,
          deposit.network,
          cleanTx,
          vRes.confirmations || 0,
          vRes.requiredConfirmations || 1
        ).catch(() => {});
      }

      return {
        success: true,
        isCompleted: false,
        status: 'AWAITING_CONFIRMATIONS',
        confirmations: vRes.confirmations,
        requiredConfirmations: vRes.requiredConfirmations,
        explorerUrl,
        message: `Transaction detected! Confirmations: ${vRes.confirmations}/${vRes.requiredConfirmations}. Crediting automatically once confirmed.`,
      };
    }

    // Fully verified and confirmed!
    await prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        status: 'VERIFIED',
        txHash: cleanTx,
        confirmations: vRes.confirmations || vRes.requiredConfirmations || 1,
        requiredConfirmations: vRes.requiredConfirmations || 1,
        blockNumber: vRes.blockNumber,
        receivedCryptoAmount: vRes.receivedAmount,
        verifiedAt: new Date(),
        explorerUrl,
      },
    }).catch(() => {});

    // Atomically finalize & credit balance!
    const fin = await this.finalizeVerifiedDeposit(deposit.id, cleanTx, vRes.receivedAmount);

    return {
      success: true,
      isCompleted: true,
      status: 'CREDITED',
      confirmations: vRes.confirmations || vRes.requiredConfirmations || 1,
      requiredConfirmations: vRes.requiredConfirmations || 1,
      explorerUrl,
      newBalance: fin.newBalance,
      message: 'Deposit verified on blockchain! Balance and rewards credited successfully.',
    };
  }

  /**
   * Real-time on-chain verification query.
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
    const res = await this.verifyAndProcessDeposit(depositId);
    return {
      success: res.success,
      isCompleted: res.isCompleted,
      status: res.status,
      txHash: res.explorerUrl ? (res.explorerUrl.split('/').pop() || undefined) : undefined,
      newBalance: res.newBalance,
      message: res.message,
    };
  }
}
