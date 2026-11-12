import { Response } from 'express';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { env } from '../../config/env.js';
import { MissionCategory } from '@prisma/client';

export const WATCH_ADS_MISSION_ID = 'm7_watch_30_ads';
export const WATCH_ADS_DAILY_TARGET = 30;
export const WATCH_ADS_REWARD_POOPS = 500n;
export const WATCH_ADS_COOLDOWN_MS = 10_000;

export function getUtcDayStart(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Default standard missions matching frontend initial catalog
export const SEED_MISSIONS = [
  {
    id: 'm1_join_channel',
    title: 'Join Telegram Channel',
    description: 'Subscribe to official SuperTom announcements',
    rewardPoops: 500n,
    category: MissionCategory.SOCIAL,
    verificationType: 'TELEGRAM_CHANNEL' as const,
    channelId: '@SuperTomAnnouncements',
    icon: 'Send',
    badge: 'Telegram',
    actionUrl: 'https://t.me/SuperTomAnnouncements',
  },
  {
    id: 'm2_join_group',
    title: 'Join Telegram Group',
    description: 'Chat with felines across the globe',
    rewardPoops: 500n,
    category: MissionCategory.SOCIAL,
    verificationType: 'TELEGRAM_GROUP' as const,
    channelId: '@SuperTomCommunity',
    icon: 'MessageCircle',
    badge: 'Community',
    actionUrl: 'https://t.me/SuperTomCommunity',
  },
  {
    id: 'm3_follow_x',
    title: 'Follow SuperTom on X',
    description: 'Follow our official X handle for updates',
    rewardPoops: 1000n,
    category: MissionCategory.SOCIAL,
    verificationType: 'EXTERNAL_LINK' as const,
    icon: 'Share2',
    badge: 'Twitter / X',
    actionUrl: 'https://x.com/SuperTomGame',
  },
  {
    id: 'm4_invite_3',
    title: 'Invite 3 Friends',
    description: 'Bring 3 friends to King Tom’s royal kingdom',
    rewardPoops: 2500n,
    category: MissionCategory.DAILY,
    verificationType: 'GAME_ACTION' as const,
    icon: 'Users',
    badge: 'Daily',
  },
  {
    id: 'm5_feed_5_biscuits',
    title: 'Feed Tom 5 Biscuits',
    description: 'Satisfy King Tom’s royal feline cravings',
    rewardPoops: 800n,
    category: MissionCategory.DAILY,
    verificationType: 'GAME_ACTION' as const,
    icon: 'Cookie',
    badge: 'Daily',
  },
  {
    id: 'm6_reach_level_5',
    title: 'Reach Player Level 5',
    description: 'Prove your feline royal loyalty to level 5',
    rewardPoops: 5000n,
    category: MissionCategory.SPECIAL,
    verificationType: 'GAME_ACTION' as const,
    icon: 'Crown',
    badge: 'Milestone',
  },
  {
    id: WATCH_ADS_MISSION_ID,
    title: 'Watch 30 Ads Daily',
    description: 'Watch 30 sponsored ads per day to earn 500 Poops (resets daily at 00:00 UTC)',
    rewardPoops: WATCH_ADS_REWARD_POOPS,
    category: MissionCategory.DAILY,
    verificationType: 'GAME_ACTION' as const,
    icon: 'Tv',
    badge: 'Daily Ads',
  },
];

let coreMissionsEnsured = false;

/**
 * Ensures all core SEED_MISSIONS exist in DB (safe for already-seeded production DBs).
 */
export async function ensureCoreMissionsSeeded(): Promise<void> {
  if (coreMissionsEnsured) return;

  const watchAdsSeed = SEED_MISSIONS.find((m) => m.id === WATCH_ADS_MISSION_ID);
  const existingIds = await prisma.mission.findMany({
    select: { id: true },
  });
  const present = new Set(existingIds.map((m) => m.id));

  if (present.size === 0) {
    for (const m of SEED_MISSIONS) {
      await prisma.mission.upsert({
        where: { id: m.id },
        create: m,
        update: {},
      });
    }
  } else if (watchAdsSeed && !present.has(WATCH_ADS_MISSION_ID)) {
    await prisma.mission.upsert({
      where: { id: watchAdsSeed.id },
      create: watchAdsSeed,
      update: {},
    });
  }

  coreMissionsEnsured = true;
}

export interface MissionProgressSource {
  status: string;
  progress: number;
  total: number;
  claimedAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface MissionMappingUserStats {
  level?: number | null;
  refereesCount?: number;
  feedingEventsCount?: number;
}

export function mapMissionToDto(
  m: {
    id: string;
    title: string;
    description: string;
    rewardPoops: bigint;
    category: MissionCategory;
    icon: string;
    badge: string | null;
    actionUrl: string | null;
    userMissions?: MissionProgressSource[];
  },
  userStats: MissionMappingUserStats,
  now: Date = new Date()
) {
  const userProgress = m.userMissions?.[0];
  const isDaily = m.category === MissionCategory.DAILY;
  const isWatchAds = m.id === WATCH_ADS_MISSION_ID;
  const startOfToday = getUtcDayStart(now);

  let status = userProgress?.status ? userProgress.status.toLowerCase() : 'start';
  let progress = userProgress?.progress ?? 0;
  let total = isWatchAds ? WATCH_ADS_DAILY_TARGET : (userProgress?.total ?? 1);

  const claimedBeforeToday = Boolean(userProgress?.claimedAt && new Date(userProgress.claimedAt) < startOfToday);
  const updatedBeforeToday = Boolean(userProgress?.updatedAt && new Date(userProgress.updatedAt) < startOfToday);

  if (isDaily && (claimedBeforeToday || (isWatchAds && updatedBeforeToday))) {
    status = 'start';
    progress = 0;
  }

  if (status === 'start' || status === 'in_progress') {
    if (m.id === 'm4_invite_3') {
      total = 3;
      progress = Math.min(3, userStats.refereesCount ?? 0);
      if (progress >= total) status = 'completed';
    } else if (m.id === 'm5_feed_5_biscuits') {
      total = 5;
      progress = Math.min(5, userStats.feedingEventsCount ?? 0);
      if (progress >= total) status = 'completed';
    } else if (m.id === 'm6_reach_level_5') {
      total = 5;
      progress = Math.min(5, userStats.level ?? 1);
      if (progress >= total) status = 'completed';
    } else if (isWatchAds) {
      total = WATCH_ADS_DAILY_TARGET;
      if (progress >= total) status = 'completed';
    }
  }

  return {
    id: m.id,
    title: m.title,
    description: m.description,
    rewardPoops: Number(m.rewardPoops),
    category: m.category.toLowerCase() as 'daily' | 'social' | 'special',
    icon: m.icon,
    badge: m.badge || undefined,
    actionUrl: m.actionUrl || undefined,
    status: status as 'start' | 'in_progress' | 'verify' | 'completed' | 'claimed',
    progress,
    total,
  };
}

export class MissionController {
  /**
   * Helper to check Telegram membership using Telegram Bot API.
   */
  private static async verifyTelegramChatMember(chatId: string, telegramId: string): Promise<boolean> {
    if (env.TELEGRAM_BOT_TOKEN === 'TEST_BOT_TOKEN_PLACEHOLDER') {
      return true; // Auto-pass in test/staging mode
    }

    try {
      const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${encodeURIComponent(telegramId)}`;
      const res = await fetch(url);
      const data = (await res.json()) as { ok?: boolean; result?: { status?: string } };
      if (data?.ok && data?.result?.status) {
        const status = data.result.status;
        return ['creator', 'administrator', 'member', 'restricted'].includes(status);
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * GET /api/v1/missions
   */
  public static async getMissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      await ensureCoreMissionsSeeded();

      const missions = await prisma.mission.findMany({
        where: { isActive: true },
        include: {
          userMissions: {
            where: { userId },
          },
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: { referees: true, feedingEvents: true },
          },
        },
      });

      const now = new Date();
      const response = missions.map((m) =>
        mapMissionToDto(
          m,
          {
            level: user?.level,
            refereesCount: user?._count.referees,
            feedingEventsCount: user?._count.feedingEvents,
          },
          now
        )
      );

      sendSuccess(res, response);
    } catch {
      sendError(res, 'Failed to retrieve missions', 500, 'MISSIONS_FETCH_ERROR');
    }
  }

  /**
   * POST /api/v1/missions/:id/verify
   */
  public static async verifyMission(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const telegramId = req.user?.telegramId;
    const missionId = req.params.id;

    if (!userId || !telegramId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      await ensureCoreMissionsSeeded();

      const mission = await prisma.mission.findUnique({
        where: { id: missionId },
      });

      if (!mission) {
        sendError(res, 'Mission not found', 404, 'MISSION_NOT_FOUND');
        return;
      }

      if (mission.id === WATCH_ADS_MISSION_ID) {
        const now = new Date();
        const startOfToday = getUtcDayStart(now);

        const adResult = await prisma.$transaction(async (tx) => {
          const existing = await tx.userMission.findUnique({
            where: { userId_missionId: { userId, missionId } },
          });

          if (
            existing &&
            existing.status === 'CLAIMED' &&
            existing.claimedAt &&
            new Date(existing.claimedAt) >= startOfToday
          ) {
            return { errorStatus: 400, errorCode: 'MISSION_ALREADY_CLAIMED', errorMsg: 'Daily ad quest already claimed today. Come back after 00:00 UTC!' } as const;
          }

          const isFromPreviousDay =
            Boolean(existing?.claimedAt && new Date(existing.claimedAt) < startOfToday) ||
            Boolean(existing?.updatedAt && new Date(existing.updatedAt) < startOfToday);

          const currentProgress = !existing || isFromPreviousDay ? 0 : existing.progress;
          const isVerified = currentProgress >= WATCH_ADS_DAILY_TARGET;
          const status = isVerified ? 'COMPLETED' : currentProgress > 0 ? 'IN_PROGRESS' : 'START';

          if (isVerified && existing?.status !== 'COMPLETED') {
            await tx.userMission.upsert({
              where: { userId_missionId: { userId, missionId } },
              create: {
                userId,
                missionId,
                status: 'COMPLETED',
                progress: WATCH_ADS_DAILY_TARGET,
                total: WATCH_ADS_DAILY_TARGET,
              },
              update: {
                status: 'COMPLETED',
                progress: WATCH_ADS_DAILY_TARGET,
                total: WATCH_ADS_DAILY_TARGET,
                ...(isFromPreviousDay ? { claimedAt: null } : {}),
              },
            });
          }

          return { verified: isVerified, missionProgress: currentProgress, newStatus: status } as const;
        });

        if ('errorMsg' in adResult && adResult.errorMsg) {
          sendError(res, adResult.errorMsg, adResult.errorStatus, adResult.errorCode);
          return;
        }

        sendSuccess(res, {
          verified: adResult.verified,
          mission: {
            id: mission.id,
            title: mission.title,
            description: mission.description,
            rewardPoops: Number(mission.rewardPoops),
            category: mission.category.toLowerCase(),
            icon: mission.icon,
            badge: mission.badge || undefined,
            status: adResult.newStatus.toLowerCase(),
            progress: adResult.missionProgress,
            total: WATCH_ADS_DAILY_TARGET,
          },
        });
        return;
      }

      let verified = false;
      let missionProgress = 0;
      let missionTotal = 1;

      if (mission.verificationType === 'TELEGRAM_CHANNEL' || mission.verificationType === 'TELEGRAM_GROUP') {
        const targetChat = mission.channelId || '@SuperTomAnnouncements';
        verified = await MissionController.verifyTelegramChatMember(targetChat, telegramId);
        missionProgress = verified ? 1 : 0;
        missionTotal = 1;
      } else if (mission.verificationType === 'EXTERNAL_LINK') {
        // Link clicking verified upon callback
        verified = true;
        missionProgress = 1;
        missionTotal = 1;
      } else if (mission.verificationType === 'GAME_ACTION') {
        if (mission.id === 'm4_invite_3') {
          // Strictly verify that at least 3 referred players have opened the bot and joined!
          const refereeCount = await prisma.user.count({
            where: { referredById: userId },
          });
          missionProgress = Math.min(3, refereeCount);
          missionTotal = 3;
          verified = refereeCount >= 3;
        } else if (mission.id === 'm5_feed_5_biscuits') {
          const feedCount = await prisma.feedingEvent.count({
            where: { userId },
          });
          missionProgress = Math.min(5, feedCount);
          missionTotal = 5;
          verified = feedCount >= 5;
        } else if (mission.id === 'm6_reach_level_5') {
          const player = await prisma.user.findUnique({
            where: { id: userId },
            select: { level: true },
          });
          const lvl = player?.level ?? 1;
          missionProgress = Math.min(5, lvl);
          missionTotal = 5;
          verified = lvl >= 5;
        }
      }

      const newStatus = verified ? 'COMPLETED' : missionProgress > 0 ? 'IN_PROGRESS' : 'START';

      await prisma.userMission.upsert({
        where: { userId_missionId: { userId, missionId } },
        create: {
          userId,
          missionId,
          status: newStatus,
          progress: missionProgress,
          total: missionTotal,
        },
        update: {
          status: newStatus,
          progress: missionProgress,
          total: missionTotal,
        },
      });

      sendSuccess(res, {
        verified,
        mission: {
          id: mission.id,
          title: mission.title,
          description: mission.description,
          rewardPoops: Number(mission.rewardPoops),
          category: mission.category.toLowerCase(),
          icon: mission.icon,
          status: newStatus.toLowerCase(),
          progress: missionProgress,
          total: missionTotal,
        },
      });
    } catch {
      sendError(res, 'Verification failed', 500, 'VERIFICATION_ERROR');
    }
  }

  /**
   * POST /api/v1/missions/:id/claim
   * Credits quest bounty atomically and prevents duplicate claims.
   */
  public static async claimReward(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const missionId = req.params.id;

    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const userMission = await tx.userMission.findUnique({
          where: { userId_missionId: { userId, missionId } },
          include: { mission: true },
        });

        if (!userMission) {
          throw new Error('Mission not started or not completed yet');
        }

        const now = new Date();
        const startOfToday = getUtcDayStart(now);
        const isDaily = userMission.mission.category === MissionCategory.DAILY;
        const isWatchAds = userMission.mission.id === WATCH_ADS_MISSION_ID;
        const claimedToday = userMission.claimedAt && new Date(userMission.claimedAt) >= startOfToday;
        const updatedBeforeToday = new Date(userMission.updatedAt) < startOfToday;

        if (userMission.status === 'CLAIMED' && (!isDaily || claimedToday)) {
          throw new Error('Mission reward has already been claimed');
        }

        if (isDaily && ((userMission.claimedAt && !claimedToday) || (isWatchAds && updatedBeforeToday))) {
          throw new Error('Daily mission reset at 00:00 UTC. Complete it today to claim.');
        }

        if (userMission.status !== 'COMPLETED') {
          throw new Error('Mission conditions not yet fulfilled');
        }

        if (isWatchAds && userMission.progress < WATCH_ADS_DAILY_TARGET) {
          throw new Error('Watch all 30 ads today before claiming this reward');
        }

        // 1. Mark mission claimed
        await tx.userMission.update({
          where: { userId_missionId: { userId, missionId } },
          data: {
            status: 'CLAIMED',
            claimedAt: new Date(),
          },
        });

        // 2. Credit Poops via Ledger
        const reward = userMission.mission.rewardPoops;
        const dateSuffix = isDaily ? `_${startOfToday.toISOString().slice(0, 10)}` : '';
        const { balanceAfter } = await LedgerService.executeBalanceTransaction(tx, {
          userId,
          type: 'MISSION_REWARD',
          amount: reward,
          description: `Reward for completing quest: ${userMission.mission.title}`,
          idempotencyKey: `mission_${userId}_${missionId}${dateSuffix}`,
        });

        return {
          rewardPoops: Number(reward),
          newBalance: Number(balanceAfter),
        };
      });

      sendSuccess(res, result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Claim failed';
      sendError(res, msg, 400, 'MISSION_CLAIM_FAILED');
    }
  }
}

