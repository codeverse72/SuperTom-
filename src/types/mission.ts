/**
 * Mission System Type Definitions
 */

export type MissionCategory = 'daily' | 'social' | 'special';

export type MissionStatus = 'start' | 'in_progress' | 'verify' | 'completed' | 'claimed';

export interface Mission {
  id: string;
  title: string;
  description: string;
  rewardPoops: number;
  category: MissionCategory;
  icon: string;
  badge?: string;
  status: MissionStatus;
  progress: number;
  totalRequired: number;
  actionUrl?: string;
  verificationType?: 'telegram_channel' | 'telegram_group' | 'external_link' | 'game_action';
  expiryTimestamp?: number;
}
