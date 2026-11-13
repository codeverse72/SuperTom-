/**
 * Centralized Currency & Numerical Conversion Utilities
 * 
 * Strict single-source-of-truth for game economy calculations:
 * 2,000 TomCoins = 1 USDT
 */

export const TOM_PER_USDT = 2000;
export const POOPS_PER_USDT = TOM_PER_USDT;

/**
 * Converts a TomCoin amount into its USDT equivalent.
 * Returns '--' if the balance is null or undefined.
 */
export function tomToUsdt(tom: number | null | undefined, decimals: number = 4): string {
  if (tom === null || tom === undefined || isNaN(tom)) {
    return '--';
  }
  const val = tom / TOM_PER_USDT;
  return val.toFixed(decimals);
}

export const poopsToUsdt = tomToUsdt;

/**
 * Converts a USDT amount into its whole TomCoin equivalent.
 */
export function usdtToTom(usdt: number): number {
  if (isNaN(usdt) || usdt <= 0) return 0;
  return Math.floor(usdt * TOM_PER_USDT);
}

export const usdtToPoops = usdtToTom;

/**
 * Formats numbers with international comma separators.
 * If null/undefined, returns '--'.
 */
export function formatCurrencyNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '--';
  }
  return val.toLocaleString('en-US');
}
