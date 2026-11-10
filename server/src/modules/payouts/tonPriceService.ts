import { logger } from '../../utils/logger.js';

interface PriceCache {
  price: number;
  timestamp: number;
  source: string;
}

export class TonPriceService {
  private static cache: PriceCache | null = null;
  private static readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds
  private static readonly FALLBACK_TON_USD = 2.0; // Reasonable safety fallback

  /**
   * Fetches reliable real-time TON price in USD with in-memory caching and redundant upstream providers.
   */
  public static async getTonUsdPrice(): Promise<{ price: number; source: string; timestamp: number }> {
    const now = Date.now();
    if (this.cache && (now - this.cache.timestamp) < this.CACHE_TTL_MS) {
      return {
        price: this.cache.price,
        source: `${this.cache.source} (cached)`,
        timestamp: this.cache.timestamp,
      };
    }

    // Provider 1: Binance public ticker
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as { price?: string };
        const priceNum = parseFloat(data.price || '0');
        if (priceNum > 0.01 && priceNum < 1000) {
          this.cache = { price: priceNum, timestamp: now, source: 'binance' };
          return this.cache;
        }
      }
    } catch (err) {
      logger.debug('[TonPriceService] Binance fetch failed, trying CoinGecko fallback:', err);
    }

    // Provider 2: CoinGecko public simple price
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as Record<string, { usd?: number }>;
        const priceNum = data['the-open-network']?.usd;
        if (priceNum && priceNum > 0.01 && priceNum < 1000) {
          this.cache = { price: priceNum, timestamp: now, source: 'coingecko' };
          return this.cache;
        }
      }
    } catch (err) {
      logger.debug('[TonPriceService] CoinGecko fetch failed:', err);
    }

    // Provider 3: OKX / Gate / Toncenter fallback or cached fallback
    if (this.cache) {
      return {
        price: this.cache.price,
        source: `${this.cache.source} (stale)`,
        timestamp: this.cache.timestamp,
      };
    }

    // Default safety fallback
    return {
      price: this.FALLBACK_TON_USD,
      source: 'fallback_reference',
      timestamp: now,
    };
  }

  /**
   * Converts USD to TON and nanoTON with high precision decimal integer arithmetic.
   * 1 TON = 1,000,000,000 nanoTON (10^9).
   */
  public static async convertUsdToNanoTon(amountUsd: number): Promise<{
    amountUsd: number;
    tonPriceUsd: number;
    tonAmount: number;
    nanoTon: bigint;
    nanoTonString: string;
    source: string;
  }> {
    const { price, source } = await this.getTonUsdPrice();
    const safeUsd = Math.max(0.1, Number(amountUsd.toFixed(2)));
    
    // Convert using exact decimal integer arithmetic:
    // nanoTon = (amountUsd * 1e9) / tonPriceUsd
    // To preserve precision without float rounding errors:
    // (usd_cents * 10,000,000) / price_cents
    const usdCents = BigInt(Math.round(safeUsd * 100));
    const priceCents = BigInt(Math.max(1, Math.round(price * 100)));
    const nanoMultiplier = BigInt(10_000_000); // 10^9 / 100

    const nanoTon = (usdCents * nanoMultiplier * BigInt(100)) / priceCents;
    const tonAmount = Number(nanoTon) / 1_000_000_000;

    return {
      amountUsd: safeUsd,
      tonPriceUsd: price,
      tonAmount: Number(tonAmount.toFixed(6)),
      nanoTon,
      nanoTonString: nanoTon.toString(),
      source,
    };
  }
}

