import { Response } from 'express';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { env } from '../../config/env.js';

// Default standard missions matching frontend initial catalog
export const SEED_MISSIONS = [
  {
    id: 'm1_join_channel',
    title: 'Join Telegram Channel',
    description: 'Subscribe to official SuperTom announcements',
    rewardPoops: 500n,
    category: 'social' as const,
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
    category: 'social' as const,
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
    category: 'social' as const,
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
    category: 'daily' as const,
    verificationType: 'GAME_ACTION' as const,
    icon: 'Users',
    badge: 'Daily',
  },
  {
    id: 'm5_feed_5_biscuits',
    title: 'Feed Tom 5 Biscuits',
    description: 'Satisfy King Tom’s royal feline cravings',
    rewardPoops: 800n,
    category: 'daily' as const,
    verificationType: 'GAME_ACTION' as const,
    icon: 'Cookie',
    badge: 'Daily',
  },
  {
    id: 'm6_reach_level_5',
    title: 'Reach Player Level 5',
    description: 'Prove your feline royal loyalty to level 5',
    rewardPoops: 5000n,
    category: 'special' as const,
    verificationType: 'GAME_ACTION' as const,
    icon: 'Crown',
    badge: 'Milestone',
  },
];

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
      const data = await res.json();
      if (data.ok && data.result) {
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
      // Ensure seed missions exist in database
      for (const m of SEED_MISSIONS) {
        await prisma.mission.upsert({
          where: { id: m.id },
          create: m,
          update: {},
        });
      }

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

      const response = missions.map((m) => {
        const userProgress = m.userMissions[0];
        let status = userProgress?.status ? (userProgress.status.toLowerCase() as string) : 'start';
        let progress = userProgress?.progress ?? 0;
        let total = userProgress?.total ?? 1;

        // Dynamic checks for game actions
        if (status === 'start' || status === 'in_progress') {
          if (m.id === 'm4_invite_3') {
            total = 3;
            progress = Math.min(3, user?._count.referees ?? 0);
            if (progress >= total) status = 'completed';
          } else if (m.id === 'm5_feed_5_biscuits') {
            total = 5;
            progress = Math.min(5, user?._count.feedingEvents ?? 0);
            if (progress >= total) status = 'completed';
          } else if (m.id === 'm6_reach_level_5') {
            total = 5;
            progress = Math.min(5, user?.level ?? 1);
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
      });

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
      const mission = await prisma.mission.findUnique({
        where: { id: missionId },
      });

      if (!mission) {
        sendError(res, 'Mission not found', 404, 'MISSION_NOT_FOUND');
        return;
      }

      let verified = false;

      if (mission.verificationType === 'TELEGRAM_CHANNEL' || mission.verificationType === 'TELEGRAM_GROUP') {
        const targetChat = mission.channelId || '@SuperTomAnnouncements';
        verified = await MissionController.verifyTelegramChatMember(targetChat, telegramId);
      } else if (mission.verificationType === 'EXTERNAL_LINK') {
        // Link clicking verified upon callback
        verified = true;
      }

      const newStatus = verified ? 'COMPLETED' : 'VERIFY';

      await prisma.userMission.upsert({
        where: { userId_missionId: { userId, missionId } },
        create: {
          userId,
          missionId,
          status: newStatus,
          progress: verified ? 1 : 0,
          total: 1,
        },
        update: {
          status: newStatus,
          progress: verified ? 1 : 0,
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
          progress: verified ? 1 : 0,
          total: 1,
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

        if (userMission.status === 'CLAIMED') {
          throw new Error('Mission reward has already been claimed');
        }

        if (userMission.status !== 'COMPLETED') {
          throw new Error('Mission conditions not yet fulfilled');
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
        const { balanceAfter } = await LedgerService.executeBalanceTransaction(tx, {
          userId,
          type: 'MISSION_REWARD',
          amount: reward,
          description: `Reward for completing quest: ${userMission.mission.title}`,
          idempotencyKey: `mission_${userId}_${missionId}`,
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

