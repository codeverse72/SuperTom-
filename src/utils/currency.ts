/**
 * Centralized Currency & Numerical Conversion Utilities
 * 
 * Strict single-source-of-truth for game economy calculations:
 * 2,000 Poops = 1 USDT
 */

export const POOPS_PER_USDT = 2000;

/**
 * Converts a Poop amount into its USDT equivalent.
 * Returns '--' if the balance is null or undefined.
 */
export function poopsToUsdt(poops: number | null | undefined, decimals: number = 4): string {
  if (poops === null || poops === undefined || isNaN(poops)) {
    return '--';
  }
  const val = poops / POOPS_PER_USDT;
  return val.toFixed(decimals);
}

/**
 * Converts a USDT amount into its whole Poop equivalent.
 */
export function usdtToPoops(usdt: number): number {
  if (isNaN(usdt) || usdt <= 0) return 0;
  return Math.floor(usdt * POOPS_PER_USDT);
}

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
