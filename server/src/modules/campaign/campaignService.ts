import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { LedgerService } from '../ledger/ledgerService.js';

export interface CampaignConfigDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isActive: boolean;
  minDepositUsdt: number;
  maxDepositUsdt: number;
  cashbackPercent: number;
  dailyRewardPoops: number;
  minRewardDays: number;
  maxRewardDays: number;
  allowMultipleCashbacks: boolean;
  startDate: string;
  endDate: string | null;
}

/**
 * Calculates tiered reward duration days from qualifying deposit amount ($5 - $10)
 * Specification formula:
 * Reward Days = FLOOR(5 + ((Deposit Amount - 5) * 1.6))
 *
 * Tier Schedule:
 * $5  -> 5 days  (10,000 Poops total)
 * $6  -> 6 days  (12,000 Poops total)
 * $7  -> 8 days  (16,000 Poops total)
 * $8  -> 9 days  (18,000 Poops total)
 * $9  -> 11 days (22,000 Poops total)
 * $10 -> 13 days (26,000 Poops total)
 */
export function calculateRewardDays(depositAmountUsdt: number, minDays = 5, maxDays = 13): number {
  const qualifying = Math.max(5, Math.min(10, depositAmountUsdt));
  const rawDays = Math.floor(5 + (qualifying - 5) * 1.6);
  return Math.max(minDays, Math.min(maxDays, rawDays));
}

/**
 * Calculates 30% instant cashback in USDT and Poops
 * Conversion rate: 2,000 Poops = $1 USDT
 */
export function calculateCashback(
  depositAmountUsdt: number,
  cashbackPercent = 30,
  maxQualifyingUsdt = 10
): { cashbackUsdt: number; cashbackPoops: number; qualifyingAmount: number } {
  const qualifyingAmount = Math.min(depositAmountUsdt, maxQualifyingUsdt);
  const cashbackUsdt = Number(((qualifyingAmount * cashbackPercent) / 100).toFixed(2));
  const cashbackPoops = Math.round(cashbackUsdt * 2000);
  return { cashbackUsdt, cashbackPoops, qualifyingAmount };
}

export class CampaignService {
  public static readonly DEFAULT_SLUG = '5k_members_celebration';

  /**
   * Retrieves or provisions the default 5K Members Celebration campaign in the DB
   */
  public static async getOrCreateDefaultCampaign() {
    let campaign = await prisma.campaign.findUnique({
      where: { slug: CampaignService.DEFAULT_SLUG },
    });

    if (!campaign) {
      campaign = await prisma.campaign.create({
        data: {
          slug: CampaignService.DEFAULT_SLUG,
          title: '5K Members Celebration',
          description: 'Special Achievement Rewards celebrating 5,000 Telegram Members! 30% Instant Cashback + $1 USDT Daily Rewards for up to 13 days.',
          isActive: true,
          minDepositUsdt: new Prisma.Decimal(5.0),
          maxDepositUsdt: new Prisma.Decimal(10.0),
          cashbackPercent: new Prisma.Decimal(30.0),
          dailyRewardPoops: BigInt(2000),
          minRewardDays: 5,
          maxRewardDays: 13,
          allowMultipleCashbacks: false,
          startDate: new Date(),
        },
      });
    }

    return campaign;
  }

  /**
   * Evaluates verified deposit for campaign qualification and triggers atomic enrollment & cashback.
   * Called within the same database transaction where the deposit is confirmed.
   */
  public static async processDepositForCampaign(
    tx: Prisma.TransactionClient,
    deposit: { id: string; userId: string; amountUsdt: Prisma.Decimal | number }
  ): Promise<{
    qualified: boolean;
    cashbackPoops?: number;
    rewardDays?: number;
    message?: string;
  }> {
    const campaign = await tx.campaign.findUnique({
      where: { slug: CampaignService.DEFAULT_SLUG },
    });

    if (!campaign || !campaign.isActive) {
      return { qualified: false, message: 'Campaign is not active' };
    }

    const now = new Date();
    if (campaign.endDate && now > campaign.endDate) {
      return { qualified: false, message: 'Campaign has ended' };
    }

    const depositAmountNum = Number(deposit.amountUsdt);
    const minDeposit = Number(campaign.minDepositUsdt);

    if (depositAmountNum < minDeposit) {
      return { qualified: false, message: `Deposit below minimum $${minDeposit} USDT requirement` };
    }

    // Check existing participation for this user
    const existingParticipation = await tx.userCampaignParticipation.findUnique({
      where: {
        userId_campaignId: {
          userId: deposit.userId,
          campaignId: campaign.id,
        },
      },
    });

    if (existingParticipation) {
      // Per Section 6: Only the first qualifying deposit activates daily reward schedule
      if (!campaign.allowMultipleCashbacks) {
        return {
          qualified: false,
          message: 'User already enrolled in 5K Members Celebration daily reward schedule',
        };
      }
    }

    const maxQualifying = Number(campaign.maxDepositUsdt);
    const cashbackPct = Number(campaign.cashbackPercent);
    const minDays = campaign.minRewardDays;
    const maxDays = campaign.maxRewardDays;

    const { cashbackPoops, qualifyingAmount } = calculateCashback(depositAmountNum, cashbackPct, maxQualifying);
    const rewardDays = calculateRewardDays(qualifyingAmount, minDays, maxDays);

    const rewardStartAt = now;
    const rewardEndAt = new Date(now.getTime() + rewardDays * 24 * 3600 * 1000);
    // Next daily reward schedule is set to 24 hours from deposit confirmation
    const nextRewardAt = new Date(now.getTime() + 24 * 3600 * 1000);

    // 1. Create or update participation
    if (!existingParticipation) {
      await tx.userCampaignParticipation.create({
        data: {
          userId: deposit.userId,
          campaignId: campaign.id,
          qualifyingDepositId: deposit.id,
          qualifyingDepositAmount: new Prisma.Decimal(qualifyingAmount),
          cashbackPoops: BigInt(cashbackPoops),
          totalRewardDays: rewardDays,
          daysClaimed: 0,
          totalDailyPoopsCredited: BigInt(0),
          rewardStartAt,
          rewardEndAt,
          nextRewardAt,
          status: 'ACTIVE',
        },
      });
    }

    // 2. Double-entry ledger balance transaction for 30% Instant Cashback
    if (cashbackPoops > 0) {
      await LedgerService.executeBalanceTransaction(tx, {
        userId: deposit.userId,
        type: 'INSTANT_CASHBACK',
        amount: BigInt(cashbackPoops),
        referenceId: deposit.id,
        description: `5K Members Celebration: 30% Instant Cashback for $${depositAmountNum.toFixed(2)} USDT deposit`,
        idempotencyKey: `cashback_${campaign.id}_${deposit.id}`,
      });
    }

    return {
      qualified: true,
      cashbackPoops,
      rewardDays,
      message: `Enrolled in 5K Celebration! Credited ${cashbackPoops.toLocaleString()} Poops (30% cashback) + unlocked ${rewardDays} days of daily rewards!`,
    };
  }

  /**
   * Reliable Scheduled Daily Rewards Processor
   * Designed for Render / Cron / Periodic timers.
   * Recovers from server restarts and ensures zero duplicate distribution via unique date constraint.
   */
  public static async processScheduledDailyRewards(): Promise<{
    processedCount: number;
    totalPoopsAwarded: number;
  }> {
    const campaign = await prisma.campaign.findUnique({
      where: { slug: CampaignService.DEFAULT_SLUG },
    });

    if (!campaign || !campaign.isActive) {
      return { processedCount: 0, totalPoopsAwarded: 0 };
    }

    const now = new Date();
    const todayDateStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD" UTC

    // Find all active participations where nextRewardAt has arrived
    const eligibleParticipations = await prisma.userCampaignParticipation.findMany({
      where: {
        campaignId: campaign.id,
        status: 'ACTIVE',
        nextRewardAt: { lte: now },
      },
      include: {
        user: true,
      },
      take: 100, // Batch limit for performance
    });

    let processedCount = 0;
    let totalPoopsAwarded = 0;
    const dailyPoops = Number(campaign.dailyRewardPoops);

    for (const p of eligibleParticipations) {
      try {
        await prisma.$transaction(async (tx) => {
          // Re-fetch with row lock
          const current = await tx.userCampaignParticipation.findUnique({
            where: { id: p.id },
          });

          if (!current || current.status !== 'ACTIVE' || current.nextRewardAt > now) {
            return;
          }

          if (current.daysClaimed >= current.totalRewardDays) {
            await tx.userCampaignParticipation.update({
              where: { id: current.id },
              data: { status: 'COMPLETED' },
            });
            return;
          }

          // Check if reward for today has already been credited to prevent duplicate daily processing
          const existingDaily = await tx.campaignDailyReward.findUnique({
            where: {
              userId_campaignId_rewardDate: {
                userId: current.userId,
                campaignId: current.campaignId,
                rewardDate: todayDateStr,
              },
            },
          });

          if (existingDaily) {
            // Already credited today, advance timer safely
            await tx.userCampaignParticipation.update({
              where: { id: current.id },
              data: {
                nextRewardAt: new Date(now.getTime() + 12 * 3600 * 1000),
              },
            });
            return;
          }

          const nextDayIndex = current.daysClaimed + 1;

          // 1. Double-entry ledger balance transaction for 2,000 Poops
          const { balanceAfter } = await LedgerService.executeBalanceTransaction(tx, {
            userId: current.userId,
            type: 'DAILY_CAMPAIGN_REWARD',
            amount: BigInt(dailyPoops),
            referenceId: current.id,
            description: `5K Members Celebration: Day ${nextDayIndex} of ${current.totalRewardDays} Daily Reward (2,000 Poops)`,
            idempotencyKey: `daily_reward_${current.id}_${nextDayIndex}_${todayDateStr}`,
          });

          // 2. Create immutable daily reward record
          await tx.campaignDailyReward.create({
            data: {
              participationId: current.id,
              userId: current.userId,
              campaignId: current.campaignId,
              dayIndex: nextDayIndex,
              rewardDate: todayDateStr,
              rewardPoops: BigInt(dailyPoops),
              status: 'COMPLETED',
            },
          });

          // 3. Update participation progression
          const isCompleted = nextDayIndex >= current.totalRewardDays;
          const nextUnlock = new Date(now.getTime() + 24 * 3600 * 1000);

          await tx.userCampaignParticipation.update({
            where: { id: current.id },
            data: {
              daysClaimed: nextDayIndex,
              totalDailyPoopsCredited: { increment: dailyPoops },
              nextRewardAt: nextUnlock,
              status: isCompleted ? 'COMPLETED' : 'ACTIVE',
            },
          });

          processedCount++;
          totalPoopsAwarded += dailyPoops;
        });
      } catch (err) {
        console.error(`[CampaignScheduler] Error processing daily reward for participation ${p.id}:`, err);
      }
    }

    return { processedCount, totalPoopsAwarded };
  }

  /**
   * Fetches real campaign state & user's personal participation for the frontend
   */
  public static async getUserCampaignStatus(userId: string) {
    const campaign = await CampaignService.getOrCreateDefaultCampaign();

    const participation = await prisma.userCampaignParticipation.findUnique({
      where: {
        userId_campaignId: {
          userId,
          campaignId: campaign.id,
        },
      },
      include: {
        dailyRewards: {
          orderBy: { dayIndex: 'desc' },
          take: 15,
        },
      },
    });

    const now = Date.now();

    const campaignConfig: CampaignConfigDto = {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      description: campaign.description,
      isActive: campaign.isActive,
      minDepositUsdt: Number(campaign.minDepositUsdt),
      maxDepositUsdt: Number(campaign.maxDepositUsdt),
      cashbackPercent: Number(campaign.cashbackPercent),
      dailyRewardPoops: Number(campaign.dailyRewardPoops),
      minRewardDays: campaign.minRewardDays,
      maxRewardDays: campaign.maxRewardDays,
      allowMultipleCashbacks: campaign.allowMultipleCashbacks,
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate ? campaign.endDate.toISOString() : null,
    };

    if (!participation) {
      return {
        campaign: campaignConfig,
        isParticipating: false,
        participation: null,
      };
    }

    const remainingDays = Math.max(0, participation.totalRewardDays - participation.daysClaimed);
    const nextRewardTimestamp = participation.nextRewardAt.getTime();
    const remainingTimeMs = Math.max(0, nextRewardTimestamp - now);

    return {
      campaign: campaignConfig,
      isParticipating: true,
      participation: {
        id: participation.id,
        qualifyingDepositAmount: Number(participation.qualifyingDepositAmount),
        cashbackPoops: Number(participation.cashbackPoops),
        cashbackCreditedAt: participation.cashbackCreditedAt.getTime(),
        totalRewardDays: participation.totalRewardDays,
        daysClaimed: participation.daysClaimed,
        remainingDays,
        totalDailyPoopsCredited: Number(participation.totalDailyPoopsCredited),
        nextRewardTimestamp,
        remainingTimeMs,
        rewardStartTimestamp: participation.rewardStartAt.getTime(),
        rewardEndTimestamp: participation.rewardEndAt.getTime(),
        status: participation.status,
        dailyRewards: participation.dailyRewards.map((r) => ({
          id: r.id,
          dayIndex: r.dayIndex,
          rewardDate: r.rewardDate,
          rewardPoops: Number(r.rewardPoops),
          status: r.status,
          processedAt: r.processedAt.getTime(),
        })),
      },
    };
  }

  /**
   * Administrative stats & participant list
   */
  public static async getAdminCampaignStats() {
    const campaign = await CampaignService.getOrCreateDefaultCampaign();

    const [totalParticipants, activeParticipants, completedParticipants, totalCashbackStats, totalDailyRewardsStats, recentParticipations] =
      await Promise.all([
        prisma.userCampaignParticipation.count({ where: { campaignId: campaign.id } }),
        prisma.userCampaignParticipation.count({ where: { campaignId: campaign.id, status: 'ACTIVE' } }),
        prisma.userCampaignParticipation.count({ where: { campaignId: campaign.id, status: 'COMPLETED' } }),
        prisma.userCampaignParticipation.aggregate({
          where: { campaignId: campaign.id },
          _sum: {
            cashbackPoops: true,
            qualifyingDepositAmount: true,
          },
        }),
        prisma.campaignDailyReward.aggregate({
          where: { campaignId: campaign.id, status: 'COMPLETED' },
          _sum: { rewardPoops: true },
          _count: true,
        }),
        prisma.userCampaignParticipation.findMany({
          where: { campaignId: campaign.id },
          include: {
            user: {
              select: {
                id: true,
                telegramId: true,
                username: true,
                firstName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    return {
      campaign: {
        id: campaign.id,
        slug: campaign.slug,
        title: campaign.title,
        description: campaign.description,
        isActive: campaign.isActive,
        minDepositUsdt: Number(campaign.minDepositUsdt),
        maxDepositUsdt: Number(campaign.maxDepositUsdt),
        cashbackPercent: Number(campaign.cashbackPercent),
        dailyRewardPoops: Number(campaign.dailyRewardPoops),
        minRewardDays: campaign.minRewardDays,
        maxRewardDays: campaign.maxRewardDays,
        allowMultipleCashbacks: campaign.allowMultipleCashbacks,
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate ? campaign.endDate.toISOString() : null,
      },
      stats: {
        totalParticipants,
        activeParticipants,
        completedParticipants,
        totalQualifyingVolumeUsdt: Number(totalCashbackStats._sum.qualifyingDepositAmount || 0),
        totalCashbackPoopsAwarded: Number(totalCashbackStats._sum.cashbackPoops || 0),
        totalDailyRewardsCount: totalDailyRewardsStats._count,
        totalDailyRewardsPoopsAwarded: Number(totalDailyRewardsStats._sum.rewardPoops || 0),
      },
      recentParticipations: recentParticipations.map((p) => ({
        id: p.id,
        userId: p.userId,
        telegramId: p.user?.telegramId?.toString(),
        username: p.user?.username,
        firstName: p.user?.firstName,
        qualifyingDepositAmount: Number(p.qualifyingDepositAmount),
        cashbackPoops: Number(p.cashbackPoops),
        totalRewardDays: p.totalRewardDays,
        daysClaimed: p.daysClaimed,
        totalDailyPoopsCredited: Number(p.totalDailyPoopsCredited),
        nextRewardAt: p.nextRewardAt.getTime(),
        status: p.status,
        createdAt: p.createdAt.getTime(),
      })),
    };
  }
}
