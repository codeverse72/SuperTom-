import { SPIN_REWARDS, SpinRewardConfig } from '../config/gameConfig';

/**
 * Weighted random selection based on configured reward probabilities.
 * Probabilities must sum up to 100.
 * Returns the selected SpinRewardConfig and its index in SPIN_REWARDS.
 */
export function selectWeightedReward(): { reward: SpinRewardConfig; index: number } {
  // Ensure weights sum is verified
  const totalWeight = SPIN_REWARDS.reduce((sum, item) => sum + item.probability, 0);
  
  // Random number between 0 and totalWeight (100)
  const randomValue = Math.random() * totalWeight;
  
  let cumulative = 0;
  for (let i = 0; i < SPIN_REWARDS.length; i++) {
    cumulative += SPIN_REWARDS[i].probability;
    if (randomValue <= cumulative) {
      return { reward: SPIN_REWARDS[i], index: i };
    }
  }

  // Fallback to the first item (100 Poops) in rare floating point rounding edge
  return { reward: SPIN_REWARDS[0], index: 0 };
}

/**
 * Validates that the configured spin rewards probabilities equal 100%.
 */
export function validateRewardProbabilities(): { isValid: boolean; total: number } {
  const total = SPIN_REWARDS.reduce((acc, curr) => acc + curr.probability, 0);
  // Allow for minor floating point rounding (within 0.0001)
  const isValid = Math.abs(total - 100) < 0.0001;
  return { isValid, total: Math.round(total * 100) / 100 };
}

/**
 * Validates TRON TRC20 wallet address:
 * Must start with 'T' and have exactly 34 alphanumeric Base58 characters
 */
export function isValidTronAddress(address: string): { isValid: boolean; error?: string } {
  if (!address || !address.trim()) {
    return { isValid: false, error: 'Wallet address cannot be empty' };
  }
  const trimmed = address.trim();
  if (!trimmed.startsWith('T')) {
    return { isValid: false, error: 'TRON TRC20 address must start with "T"' };
  }
  if (trimmed.length !== 34) {
    return { isValid: false, error: `Invalid length (${trimmed.length}/34). TRON address must be exactly 34 characters` };
  }
  // Check for base58 characters (excluding 0, O, I, l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{34}$/;
  if (!base58Regex.test(trimmed)) {
    return { isValid: false, error: 'Address contains invalid Base58 characters' };
  }
  return { isValid: true };
}

/**
 * Formats TomCoins to USDT with accurate dynamic precision (2,000 TomCoins = 1 USDT)
 * Returns '--' if unauthenticated or balance is null.
 */
export function tomToUsdt(tom: number | null | undefined): string {
  if (tom === null || tom === undefined) {
    return '--';
  }
  const usdt = tom / 2000;
  return usdt.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
}

/**
 * Backward-compatible alias for tomToUsdt
 */
export const poopsToUsdt = tomToUsdt;

/**
 * Formats numbers with comma separators, or '--' if null/undefined.
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) {
    return '--';
  }
  return Math.floor(num).toLocaleString('en-US');
}

/**
 * Format milliseconds into HH:MM:SS
 */
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
