import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { CampaignService } from '../campaign/campaignService.js';

const updateCampaignSchema = z.object({
  isActive: z.boolean().optional(),
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  minDepositUsdt: z.number().min(1).max(100).optional(),
  maxDepositUsdt: z.number().min(1).max(500).optional(),
  cashbackPercent: z.number().min(1).max(100).optional(),
  dailyRewardPoops: z.number().int().min(100).max(100000).optional(),
  minRewardDays: z.number().int().min(1).max(30).optional(),
  maxRewardDays: z.number().int().min(1).max(60).optional(),
  allowMultipleCashbacks: z.boolean().optional(),
  endDate: z.string().nullable().optional(),
});

export class AdminCampaignController {
  /**
   * GET /api/v1/admin/campaign
   * Full campaign configuration, stats, and participant list for the Admin Panel
   */
  public static async getCampaignConfig(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const stats = await CampaignService.getAdminCampaignStats();
      sendSuccess(res, stats);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch admin campaign configuration';
      sendError(res, msg, 500, 'ADMIN_CAMPAIGN_ERROR');
    }
  }

  /**
   * PUT /api/v1/admin/campaign
   * Updates campaign rules with audit logging.
   * Per specification: Changing settings does not modify previously confirmed reward schedules!
   */
  public static async updateCampaignConfig(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = updateCampaignSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Validation error', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const campaign = await CampaignService.getOrCreateDefaultCampaign();

    try {
      const updateData: any = {};
      if (parse.data.isActive !== undefined) updateData.isActive = parse.data.isActive;
      if (parse.data.title !== undefined) updateData.title = parse.data.title;
      if (parse.data.description !== undefined) updateData.description = parse.data.description;
      if (parse.data.minDepositUsdt !== undefined) updateData.minDepositUsdt = parse.data.minDepositUsdt;
      if (parse.data.maxDepositUsdt !== undefined) updateData.maxDepositUsdt = parse.data.maxDepositUsdt;
      if (parse.data.cashbackPercent !== undefined) updateData.cashbackPercent = parse.data.cashbackPercent;
      if (parse.data.dailyRewardPoops !== undefined) updateData.dailyRewardPoops = BigInt(parse.data.dailyRewardPoops);
      if (parse.data.minRewardDays !== undefined) updateData.minRewardDays = parse.data.minRewardDays;
      if (parse.data.maxRewardDays !== undefined) updateData.maxRewardDays = parse.data.maxRewardDays;
      if (parse.data.allowMultipleCashbacks !== undefined) updateData.allowMultipleCashbacks = parse.data.allowMultipleCashbacks;
      if (parse.data.endDate !== undefined) {
        updateData.endDate = parse.data.endDate ? new Date(parse.data.endDate) : null;
      }

      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: updateData,
      });

      CampaignService.invalidateCache();

      await recordAuditLog({
        adminId,
        action: 'UPDATE_CAMPAIGN_CONFIG',
        targetEntity: 'Campaign',
        targetId: campaign.id,
        previousValue: campaign,
        newValue: updated,
        req,
      });

      sendSuccess(res, {
        message: 'Campaign configuration updated successfully',
        campaign: {
          id: updated.id,
          slug: updated.slug,
          title: updated.title,
          isActive: updated.isActive,
          minDepositUsdt: Number(updated.minDepositUsdt),
          maxDepositUsdt: Number(updated.maxDepositUsdt),
          cashbackPercent: Number(updated.cashbackPercent),
          dailyRewardPoops: Number(updated.dailyRewardPoops),
          minRewardDays: updated.minRewardDays,
          maxRewardDays: updated.maxRewardDays,
          allowMultipleCashbacks: updated.allowMultipleCashbacks,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update campaign configuration';
      sendError(res, msg, 500, 'CAMPAIGN_UPDATE_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/campaign/process-rewards
   * Manually trigger the daily reward processor to disburse due daily rewards
   */
  public static async triggerProcessDailyRewards(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const result = await CampaignService.processScheduledDailyRewards();

      await recordAuditLog({
        adminId,
        action: 'TRIGGER_CAMPAIGN_DAILY_REWARDS',
        targetEntity: 'CampaignDailyReward',
        newValue: result,
        req,
      });

      sendSuccess(res, {
        message: `Processed ${result.processedCount} daily rewards (${result.totalPoopsAwarded.toLocaleString()} Poops credited).`,
        result,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger daily reward processing';
      sendError(res, msg, 500, 'CAMPAIGN_PROCESS_ERROR');
    }
  }

  /**
   * GET /api/v1/admin/campaign/export
   * Exports full participant list
   */
  public static async exportParticipants(_req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const campaign = await CampaignService.getOrCreateDefaultCampaign();
      const participants = await prisma.userCampaignParticipation.findMany({
        where: { campaignId: campaign.id },
        include: {
          user: {
            select: {
              telegramId: true,
              username: true,
              firstName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      sendSuccess(res, {
        campaignSlug: campaign.slug,
        exportedAt: new Date().toISOString(),
        count: participants.length,
        participants: participants.map((p) => ({
          participationId: p.id,
          userId: p.userId,
          telegramId: p.user?.telegramId?.toString(),
          username: p.user?.username,
          firstName: p.user?.firstName,
          qualifyingDepositAmount: Number(p.qualifyingDepositAmount),
          cashbackPoops: Number(p.cashbackPoops),
          totalRewardDays: p.totalRewardDays,
          daysClaimed: p.daysClaimed,
          totalDailyPoopsCredited: Number(p.totalDailyPoopsCredited),
          status: p.status,
          rewardStartAt: p.rewardStartAt.toISOString(),
          rewardEndAt: p.rewardEndAt.toISOString(),
          createdAt: p.createdAt.toISOString(),
        })),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export participants';
      sendError(res, msg, 500, 'CAMPAIGN_EXPORT_ERROR');
    }
  }
}

