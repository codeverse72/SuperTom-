/**
 * Biscuit & Store System Types
 */

export type BiscuitTier = 'common' | 'silver' | 'gold' | 'diamond';

export interface BiscuitConfig {
  id: BiscuitTier;
  name: string;
  badge: string;
  cost: number;
  productionBoost: number;
  description: string;
  color: string;
  borderColor: string;
  icon: string;
}

export type BiscuitInventory = Record<BiscuitTier, number>;
