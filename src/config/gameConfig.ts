/**
 * SuperTom Game Configuration & Probabilities
 */

export interface BiscuitConfig {
  id: string;
  name: string;
  cost: number;
  productionBoost: number; // Poops/hr
  color: string;
  borderColor: string;
  glowColor: string;
  description: string;
  badge: string;
}

export const BISCUIT_CONFIGS: Record<string, BiscuitConfig> = {
  common: {
    id: 'common',
    name: 'Common Biscuit',
    cost: 10,
    productionBoost: 10,
    color: 'from-amber-700 to-amber-900',
    borderColor: 'border-amber-600/40',
    glowColor: 'rgba(217, 119, 6, 0.4)',
    description: 'Freshly baked crunchy treat. Tom’s everyday royal snack.',
    badge: 'Tough Crunch'
  },
  silver: {
    id: 'silver',
    name: 'Silver Biscuit',
    cost: 50,
    productionBoost: 50,
    color: 'from-slate-300 to-slate-500',
    borderColor: 'border-slate-300/50',
    glowColor: 'rgba(203, 213, 225, 0.4)',
    description: 'Infused with powdered silver. Accelerates royal digestion.',
    badge: 'Royal Silver'
  },
  gold: {
    id: 'gold',
    name: 'Gold Biscuit',
    cost: 200,
    productionBoost: 200,
    color: 'from-amber-400 to-yellow-600',
    borderColor: 'border-yellow-400/60',
    glowColor: 'rgba(234, 179, 8, 0.5)',
    description: 'Encrusted in pure 24k edible gold. Supercharges Tom into frenzy.',
    badge: '24K Golden'
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond Biscuit',
    cost: 1000,
    productionBoost: 1000,
    color: 'from-cyan-400 to-blue-600',
    borderColor: 'border-cyan-300/70',
    glowColor: 'rgba(6, 182, 212, 0.6)',
    description: 'Rare celestial biscuit. Generates massive continuous Poop output.',
    badge: 'Mythic Gem'
  }
};

export interface SpinRewardConfig {
  id: string;
  label: string;
  rewardType: 'poops' | 'biscuit';
  amount?: number;
  biscuitId?: 'common' | 'silver' | 'gold' | 'diamond';
  probability: number; // percentage (0.1 to 99.0)
  color: string;
  textColor: string;
}

/**
 * EXACT probability breakdown per specifications:
 * 100 Poops = 99.0%
 * 250 Poops = 0.2%
 * 500 Poops = 0.2%
 * 1,000 Poops = 0.2%
 * 2,000 Poops = 0.2%
 * Gold Biscuit = 0.1%
 * Diamond Biscuit = 0.1%
 * TOTAL = 100.0%
 */
export const SPIN_REWARDS: SpinRewardConfig[] = [
  {
    id: 'poop-100',
    label: '100 TomCoins',
    rewardType: 'poops',
    amount: 100,
    probability: 25.0,
    color: '#8b5cf6', // neon purple
    textColor: '#ffffff'
  },
  {
    id: 'poop-300',
    label: '300 TomCoins',
    rewardType: 'poops',
    amount: 300,
    probability: 6.0,
    color: '#06b6d4', // cyan
    textColor: '#ffffff'
  },
  {
    id: 'poop-250',
    label: '250 TomCoins',
    rewardType: 'poops',
    amount: 250,
    probability: 15.0,
    color: '#3b82f6', // electric blue
    textColor: '#ffffff'
  },
  {
    id: 'poop-750',
    label: '750 TomCoins',
    rewardType: 'poops',
    amount: 750,
    probability: 3.0,
    color: '#f59e0b', // amber orange
    textColor: '#ffffff'
  },
  {
    id: 'poop-0',
    label: '0 TomCoins',
    rewardType: 'poops',
    amount: 0,
    probability: 30.0,
    color: '#475569', // slate / neutral
    textColor: '#ffffff'
  },
  {
    id: 'poop-525',
    label: '525 TomCoins',
    rewardType: 'poops',
    amount: 525,
    probability: 20.0,
    color: '#10b981', // emerald
    textColor: '#ffffff'
  },
  {
    id: 'poop-1000',
    label: '1,000 TomCoins',
    rewardType: 'poops',
    amount: 1000,
    probability: 1.0,
    color: '#eab308', // gold
    textColor: '#422006'
  }
];

export const TOM_PER_USDT = 2000;
export const POOPS_PER_USDT = TOM_PER_USDT;
export const MIN_WITHDRAWAL_TOM = 2000;
export const MIN_WITHDRAWAL_POOPS = MIN_WITHDRAWAL_TOM;

export interface MilestoneTimerConfig {
  stage: 1 | 2 | 3;
  name: string;
  durationMs: number; // 2h, 4h, 8h in ms
  durationLabel: string;
}

export const SPIN_MILESTONES: MilestoneTimerConfig[] = [
  { stage: 1, name: 'First Spin', durationMs: 2 * 60 * 60 * 1000, durationLabel: '2 Hours' },
  { stage: 2, name: 'Second Spin', durationMs: 4 * 60 * 60 * 1000, durationLabel: '4 Hours' },
  { stage: 3, name: 'Third Spin', durationMs: 8 * 60 * 60 * 1000, durationLabel: '8 Hours' }
];

export type MissionCategory = 'daily' | 'social' | 'special';
export type MissionStatus = 'start' | 'in_progress' | 'verify' | 'completed' | 'claimed';

export interface Mission {
  id: string;
  title: string;
  description: string;
  reward: number;
  category: MissionCategory;
  icon: string;
  status: MissionStatus;
  progress: number;
  total: number;
  badge?: string;
  actionUrl?: string;
}

export const INITIAL_MISSIONS: Mission[] = [
  // SOCIAL MISSIONS
  {
    id: 'm1',
    title: 'Join Telegram Channel',
    description: 'Subscribe to official @SuperTomChannel for mining alerts & daily promo codes',
    reward: 1000,
    category: 'social',
    icon: 'Send',
    status: 'start',
    progress: 0,
    total: 1,
    badge: 'Telegram'
  },
  {
    id: 'm2',
    title: 'Join Telegram Group',
    description: 'Meet fellow royal cat miners and chat with King Tom’s court in @SuperTomChat',
    reward: 1000,
    category: 'social',
    icon: 'MessageCircle',
    status: 'start',
    progress: 0,
    total: 1,
    badge: 'Community'
  },
  {
    id: 'm3',
    title: 'Follow Social Media',
    description: 'Follow SuperTom official announcements and seasonal events on social media',
    reward: 500,
    category: 'social',
    icon: 'Share2',
    status: 'start',
    progress: 0,
    total: 1,
    badge: 'Social'
  },
  {
    id: 'm4',
    title: 'Invite 3 Friends',
    description: 'Share your royal referral link and recruit 3 subjects to King Tom’s realm',
    reward: 2000,
    category: 'social',
    icon: 'Users',
    status: 'start',
    progress: 0,
    total: 3,
    badge: 'Referral'
  },
  {
    id: 'm5',
    title: 'Invite 10 Friends',
    description: 'Expand the royal feline empire and unlock massive referral commissions',
    reward: 5000,
    category: 'social',
    icon: 'Crown',
    status: 'start',
    progress: 0,
    total: 10,
    badge: 'Referral VIP'
  },

  // DAILY MISSIONS
  {
    id: 'm6',
    title: 'Complete Daily Check-in',
    description: 'Visit the royal throne room and claim your daily streak attendance reward',
    reward: 250,
    category: 'daily',
    icon: 'CalendarCheck',
    status: 'start',
    progress: 0,
    total: 1,
    badge: 'Daily Streak'
  },
  {
    id: 'm7',
    title: 'Feed Tom 10 Times',
    description: 'Provide crunchy biscuits to King Tom to accelerate continuous TomCoin generation',
    reward: 500,
    category: 'daily',
    icon: 'Cookie',
    status: 'start',
    progress: 0,
    total: 10,
    badge: 'Daily Treat'
  },
  {
    id: 'm7_watch_30_ads',
    title: 'Watch 30 Ads Daily',
    description: 'Watch 30 sponsored ads per day to earn 500 TomCoins (resets daily at 00:00 UTC)',
    reward: 500,
    category: 'daily',
    icon: 'Tv',
    status: 'start',
    progress: 0,
    total: 30,
    badge: 'Daily Ads'
  },
  {
    id: 'm8',
    title: 'Stay Active for 1 Hour',
    description: 'Keep your mini app session active and supervise royal digestion',
    reward: 1000,
    category: 'daily',
    icon: 'Clock',
    status: 'start',
    progress: 0,
    total: 60,
    badge: 'Playtime'
  },

  // SPECIAL MISSIONS
  {
    id: 'm9',
    title: 'Spin Lucky Wheel 3 Times',
    description: 'Try your fortune on the lucky prize wheel across any milestone cycles',
    reward: 800,
    category: 'special',
    icon: 'Disc',
    status: 'start',
    progress: 0,
    total: 3,
    badge: 'Limited Time'
  },
  {
    id: 'm10',
    title: 'Acquire a 24K Gold Biscuit',
    description: 'Equip King Tom with a glistening 24K Gold Biscuit from the Royal Bakery',
    reward: 1500,
    category: 'special',
    icon: 'Sparkles',
    status: 'start',
    progress: 0,
    total: 1,
    badge: 'Exclusive'
  },
  {
    id: 'm11',
    title: 'Royal Treasury: 20,000 TomCoins',
    description: 'Accumulate a royal treasure hoard of at least 20,000 total TomCoins',
    reward: 3000,
    category: 'special',
    icon: 'Trophy',
    status: 'start',
    progress: 0,
    total: 20000,
    badge: 'Grand Quest'
  }
];

export const CAT_SPEECH_BUBBLES = [
  "Feed me more biscuits!",
  "I'm getting hungry!",
  "More biscuits, human!",
  "Let's mine some TomCoins!",
  "My royal throne demands treats!",
  "Purr... that biscuit was 10/10!",
  "Mining TomCoins at royal capacity!"
];
