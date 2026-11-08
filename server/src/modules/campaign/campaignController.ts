import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { CampaignService } from './campaignService.js';

export class CampaignController {
  /**
   * GET /api/v1/campaign/status
   * Returns current active campaign rules + user's live participation, countdown, and reward records.
   */
  public static async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const data = await CampaignService.getUserCampaignStatus(userId);
      sendSuccess(res, data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch campaign status';
      sendError(res, msg, 500, 'CAMPAIGN_STATUS_ERROR');
    }
  }

  /**
   * GET /api/v1/campaign/info
   * Public endpoint providing the general campaign rules, benefits, and tier breakdown.
   */
  public static async getInfo(_req: Request, res: Response): Promise<void> {
    try {
      const campaign = await CampaignService.getOrCreateDefaultCampaign();
      sendSuccess(res, {
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
        tiers: [
          { deposit: 5, cashbackPoops: 3000, rewardDays: 5, totalDailyPoops: 10000 },
          { deposit: 6, cashbackPoops: 3600, rewardDays: 6, totalDailyPoops: 12000 },
          { deposit: 7, cashbackPoops: 4200, rewardDays: 8, totalDailyPoops: 16000 },
          { deposit: 8, cashbackPoops: 4800, rewardDays: 9, totalDailyPoops: 18000 },
          { deposit: 9, cashbackPoops: 5400, rewardDays: 11, totalDailyPoops: 22000 },
          { deposit: 10, cashbackPoops: 6000, rewardDays: 13, totalDailyPoops: 26000 },
        ],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch campaign info';
      sendError(res, msg, 500, 'CAMPAIGN_INFO_ERROR');
    }
  }
}

