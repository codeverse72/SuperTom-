import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { logger } from '../../utils/logger.js';
import { CampaignService } from '../campaign/campaignService.js';
import { WithdrawalEntitlementService } from './withdrawalEntitlementService.js';

export interface CryptoPriceMap {
  [currency: string]: number; // price in USD
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
    tonkeeperUniversalUrl?: string;
    tonDeepLink?: string;
    webLauncherUrl?: string;
    telegramWalletUrl?: string;
    trustWalletUrl?: string;
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
    GRAM: 0.05,
    TON: 5.20,
    BNB: 650.0,
    TRX: 0.25,
    SOL: 180.0,
    ETH: 2600.0,
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

    // Build platform & wallet URLs
    const walletLinks: MultiChainQuote['walletLinks'] = {};

    if (isTon) {
      walletLinks.tonkeeperUniversalUrl = `https://app.tonkeeper.com/transfer/${recipientAddress}?amount=${rawUnits}&text=${encodeURIComponent(paymentReference)}`;
      walletLinks.tonDeepLink = `ton://transfer/${recipientAddress}?amount=${rawUnits}&text=${encodeURIComponent(paymentReference)}`;
      walletLinks.webLauncherUrl = `${baseOrigin}/open-tonkeeper.html?address=${encodeURIComponent(recipientAddress)}&amount=${rawUnits}&text=${encodeURIComponent(paymentReference)}&usd=${amountUsd.toFixed(2)}`;
      walletLinks.telegramWalletUrl = 'https://t.me/wallet';
    } else if (isUsdtBep20) {
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c20000714_t${tokenContract}&address=${recipientAddress}&amount=${cryptoAmount}`;
      walletLinks.eip681Uri = `ethereum:${tokenContract}@56/transfer?address=${recipientAddress}&uint256=${rawUnits}`;
    } else if (isBnb) {
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c20000714&address=${recipientAddress}&amount=${cryptoAmount}`;
      walletLinks.eip681Uri = `ethereum:${recipientAddress}@56?value=${rawUnits}`;
    } else if (isUsdtTrc20) {
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c195_t${tokenContract}&address=${recipientAddress}&amount=${cryptoAmount}`;
      walletLinks.tronUri = `tron:${recipientAddress}?token=${tokenContract}&amount=${rawUnits}`;
    } else if (isTrx) {
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c195&address=${recipientAddress}&amount=${cryptoAmount}`;
      walletLinks.tronUri = `tron:${recipientAddress}?amount=${rawUnits}`;
    } else if (isSol) {
      walletLinks.solanaPayUri = `solana:${recipientAddress}?amount=${cryptoAmount}&reference=${paymentReference}&memo=${encodeURIComponent(paymentReference)}`;
      walletLinks.phantomUrl = `https://phantom.app/ul/browse/${encodeURIComponent(`solana:${recipientAddress}?amount=${cryptoAmount}&memo=${paymentReference}`)}`;
    } else if (isUsdcBase) {
      walletLinks.trustWalletUrl = `https://link.trustwallet.com/send?asset=c8453_t${tokenContract}&address=${recipientAddress}&amount=${cryptoAmount}`;
      walletLinks.eip681Uri = `ethereum:${tokenContract}@8453/transfer?address=${recipientAddress}&uint256=${rawUnits}`;
    } else if (isEthBase) {
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
   * Verify an EVM transaction on BSC or Base via standard JSON-RPC.
   */
  public static async verifyEvmTransaction(
    txHash: string,
    rpcUrl: string,
    expectedRecipient: string,
    tokenContract: string | null,
    expectedCryptoAmount: number,
    decimals: number
  ): Promise<{ verified: boolean; receivedAmount?: number; error?: string }> {
    try {
      const cleanTx = txHash.trim();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

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
      if (!receipt || receipt.status !== '0x1') {
        return { verified: false, error: 'Transaction unconfirmed or failed' };
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
                return { verified: true, receivedAmount: received };
              }
            }
          }
        }
        return { verified: false, error: 'No matching ERC-20 transfer event found' };
      } else {
        // Native transfer check (BNB or ETH)
        const txRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
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
            return { verified: true, receivedAmount: received };
          }
        }
        return { verified: false, error: 'Recipient or native value mismatch' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'EVM verification error';
      return { verified: false, error: msg };
    }
  }

  /**
   * Verify a TRON transaction (TRC-20 USDT or Native TRX) via public Tronscan API.
   */
  public static async verifyTronTransaction(
    txHash: string,
    expectedRecipient: string,
    tokenContract: string | null,
    expectedCryptoAmount: number
  ): Promise<{ verified: boolean; receivedAmount?: number; error?: string }> {
    try {
      const cleanTx = txHash.trim();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const url = `https://apilist.tronscanapi.com/api/transaction-info?hash=${cleanTx}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return { verified: false, error: 'Tronscan request failed' };
      const data = (await res.json()) as any;
      if (data.contractRet !== 'SUCCESS') {
        return { verified: false, error: 'TRON contract execution did not succeed' };
      }

      const expectedRaw = BigInt(this.toBaseUnits(expectedCryptoAmount, 6));
      const minAcceptable = (expectedRaw * 98n) / 100n;

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
              return { verified: true, receivedAmount: Number(val) / 1e6 };
            }
          }
        }
        return { verified: false, error: 'No matching TRC20 transfer found' };
      } else {
        // Native TRX transfer
        const contractData = data.contractData || {};
        if (contractData.to_address === expectedRecipient) {
          const val = BigInt(contractData.amount || '0');
          if (val >= minAcceptable) {
            return { verified: true, receivedAmount: Number(val) / 1e6 };
          }
        }
        return { verified: false, error: 'TRX recipient or value mismatch' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'TRON verification error';
      return { verified: false, error: msg };
    }
  }

  /**
   * Verify a Solana transaction via official public Solana JSON-RPC.
   */
  public static async verifySolanaTransaction(
    txHash: string,
    expectedRecipient: string,
    expectedCryptoAmount: number
  ): Promise<{ verified: boolean; receivedAmount?: number; error?: string }> {
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
            { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return { verified: false, error: 'Solana RPC request failed' };
      const data = (await res.json()) as any;
      const tx = data.result;
      if (!tx || tx.meta?.err) {
        return { verified: false, error: 'Solana transaction failed or unconfirmed' };
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
          return { verified: true, receivedAmount: Number(diff) / 1e9 };
        }
      }
      return { verified: false, error: 'Recipient lamports change mismatch' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Solana verification error';
      return { verified: false, error: msg };
    }
  }

  /**
   * Real-time on-chain verification across all supported blockchains:
   * TON, BNB Smart Chain, TRON, Solana, and Base.
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

    const netUpper = (deposit.network || '').toUpperCase();
    const currUpper = (deposit.currency || '').toUpperCase();
    const isTon = netUpper.includes('TON') || currUpper === 'TON' || currUpper === 'GRAM';
    const isTron = netUpper.includes('TRON') || netUpper.includes('TRC20') || currUpper === 'TRX';
    const isBsc = netUpper.includes('BNB') || netUpper.includes('BEP20') || netUpper.includes('BSC') || currUpper === 'BNB';
    const isBase = netUpper.includes('BASE');
    const isSolana = netUpper.includes('SOL') || currUpper === 'SOL';

    // 1. TON Blockchain Verification (Toncenter API)
    if (isTon) {
      let treasury = deposit.depositAddress;
      if (!treasury) {
        const tonConfig = await prisma.tonPaymentConfig.findUnique({ where: { id: 'singleton' } }).catch(() => null);
        treasury = tonConfig?.tonReceivingAddress || env.TRUST_WALLET_TON_ADDRESS || 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR';
      }
      const paymentRef = (deposit.paymentReference || '').trim();
      const userTelegramId = deposit.user?.telegramId?.toString() || '';
      const expectedTon = Number(deposit.expectedCryptoAmount || 0);
      const expectedNanoTon = BigInt(Math.round(expectedTon * 1_000_000_000));

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

              const valStr = inMsg.value || '0';
              const valNanoTon = BigInt(valStr);
              const memo = (inMsg.message || inMsg.msg_data?.text || '').trim();
              const memoUpper = memo.toUpperCase();
              const refUpper = paymentRef.toUpperCase();
              const idUpper = deposit.id.toUpperCase();

              const isMemoMatch =
                Boolean(paymentRef && (memoUpper === refUpper || memoUpper.includes(refUpper))) ||
                Boolean(userTelegramId && (memo === userTelegramId || memoUpper.includes(userTelegramId))) ||
                Boolean(deposit.id && memoUpper.includes(idUpper));

              if (!isMemoMatch) continue;

              const minAcceptableNanoTon = (expectedNanoTon * 98n) / 100n;
              if (expectedNanoTon > 0n && valNanoTon < minAcceptableNanoTon) {
                logger.warn(`[OnChainVerify] Partial amount detected for deposit ${depositId}: expected ${expectedNanoTon}, got ${valNanoTon}`);
                await prisma.deposit.update({
                  where: { id: deposit.id },
                  data: { status: 'UNDERPAID' },
                }).catch(() => {});
                return {
                  success: false,
                  isCompleted: false,
                  status: 'UNDERPAID',
                  txHash,
                  message: `Partial payment received (${(Number(valNanoTon) / 1e9).toFixed(4)} TON). Required: ${expectedTon} TON.`,
                };
              }

              const existingTx = await prisma.deposit.findFirst({
                where: {
                  txHash,
                  id: { not: deposit.id },
                  status: { in: ['COMPLETED', 'CONFIRMED'] },
                },
              });

              if (existingTx) continue;

              matchingTx = { hash: txHash, valueNanoTon: valNanoTon, comment: memo };
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
    }

    // 2. EVM Chains (BSC / Base) or TRON or Solana if user submitted txHash
    if (deposit.txHash) {
      const cleanTx = deposit.txHash.trim();
      const expectedAmount = Number(deposit.expectedCryptoAmount || deposit.amountUsdt);
      const recipient = deposit.depositAddress || '';

      if (isBsc) {
        const isUsdt = currUpper.includes('USDT');
        const tokenContract = isUsdt ? '0x55d398326f99059fF775485246999027B3197955' : null;
        const evmRes = await this.verifyEvmTransaction(
          cleanTx,
          'https://bsc-dataseed.binance.org',
          recipient,
          tokenContract,
          expectedAmount,
          18
        );
        if (evmRes.verified) {
          const fin = await this.finalizeVerifiedDeposit(deposit.id, cleanTx, evmRes.receivedAmount);
          return { success: true, isCompleted: true, status: 'COMPLETED', txHash: cleanTx, newBalance: fin.newBalance, message: 'BSC deposit verified!' };
        }
      } else if (isBase) {
        const isUsdc = currUpper.includes('USDC') || netUpper.includes('USDC');
        const tokenContract = isUsdc ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' : null;
        const decimals = isUsdc ? 6 : 18;
        const evmRes = await this.verifyEvmTransaction(
          cleanTx,
          'https://mainnet.base.org',
          recipient,
          tokenContract,
          expectedAmount,
          decimals
        );
        if (evmRes.verified) {
          const fin = await this.finalizeVerifiedDeposit(deposit.id, cleanTx, evmRes.receivedAmount);
          return { success: true, isCompleted: true, status: 'COMPLETED', txHash: cleanTx, newBalance: fin.newBalance, message: 'Base deposit verified!' };
        }
      } else if (isTron) {
        const isUsdt = currUpper.includes('USDT');
        const tokenContract = isUsdt ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' : null;
        const tronRes = await this.verifyTronTransaction(cleanTx, recipient, tokenContract, expectedAmount);
        if (tronRes.verified) {
          const fin = await this.finalizeVerifiedDeposit(deposit.id, cleanTx, tronRes.receivedAmount);
          return { success: true, isCompleted: true, status: 'COMPLETED', txHash: cleanTx, newBalance: fin.newBalance, message: 'TRON deposit verified!' };
        }
      } else if (isSolana) {
        const solRes = await this.verifySolanaTransaction(cleanTx, recipient, expectedAmount);
        if (solRes.verified) {
          const fin = await this.finalizeVerifiedDeposit(deposit.id, cleanTx, solRes.receivedAmount);
          return { success: true, isCompleted: true, status: 'COMPLETED', txHash: cleanTx, newBalance: fin.newBalance, message: 'Solana deposit verified!' };
        }
      }
    }

    return {
      success: false,
      isCompleted: false,
      status: deposit.status,
      message: 'No matching transaction detected on-chain yet. Please wait a few moments and try again.',
    };
  }
}
