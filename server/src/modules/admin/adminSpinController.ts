import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';

const spinRewardSchema = z.object({
  id: z.string(),
  label: z.string(),
  rewardType: z.enum(['poops', 'biscuit']),
  amount: z.number().optional(),
  biscuitId: z.string().optional(),
  percentage: z.number().min(0).max(100), // e.g. 99 for 99%
});

const updateProbabilitiesSchema = z.object({
  rewards: z.array(spinRewardSchema).min(1),
});

const updateCooldownsSchema = z.object({
  milestone1Hours: z.number().int().min(1).max(72),
  milestone2Hours: z.number().int().min(1).max(72),
  milestone3Hours: z.number().int().min(1).max(72),
});

export class AdminSpinController {
  /**
   * GET /api/v1/admin/spin
   */
  public static async getSpinConfig(_req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const [settingProbabilities, settingCooldowns, totalSpins] = await Promise.all([
        prisma.systemSetting.findUnique({ where: { key: 'spin_rewards_distribution' } }),
        prisma.systemSetting.findUnique({ where: { key: 'spin_cooldowns_hours' } }),
        prisma.spinHistory.count(),
      ]);

      const defaultRewards = [
        { id: 'poop-100', label: '100 Poops', rewardType: 'poops', amount: 100, percentage: 99.0 },
        { id: 'poop-250', label: '250 Poops', rewardType: 'poops', amount: 250, percentage: 0.2 },
        { id: 'poop-500', label: '500 Poops', rewardType: 'poops', amount: 500, percentage: 0.2 },
        { id: 'poop-1000', label: '1,000 Poops', rewardType: 'poops', amount: 1000, percentage: 0.2 },
        { id: 'poop-2000', label: '2,000 Poops', rewardType: 'poops', amount: 2000, percentage: 0.2 },
        { id: 'biscuit-gold', label: 'Gold Biscuit', rewardType: 'biscuit', biscuitId: 'gold', percentage: 0.1 },
        { id: 'biscuit-diamond', label: 'Diamond Biscuit', rewardType: 'biscuit', biscuitId: 'diamond', percentage: 0.1 },
      ];

      const rewards = settingProbabilities ? JSON.parse(settingProbabilities.value) : defaultRewards;
      const cooldowns = settingCooldowns
        ? JSON.parse(settingCooldowns.value)
        : { milestone1Hours: 2, milestone2Hours: 4, milestone3Hours: 8 };

      sendSuccess(res, {
        rewards,
        cooldowns,
        totalSpinsAwarded: totalSpins,
      });
    } catch {
      sendError(res, 'Failed to fetch spin configurations', 500, 'SERVER_ERROR');
    }
  }

  /**
   * PUT /api/v1/admin/spin/probabilities
   * Strictly enforces that all probabilities sum to exactly 100%.
   */
  public static async updateProbabilities(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = updateProbabilitiesSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid probabilities payload', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const { rewards } = parse.data;

    // Validate sum = 100.0% within floating precision tolerance
    const sum = rewards.reduce((acc, r) => acc + r.percentage, 0);
    if (Math.abs(sum - 100) > 0.001) {
      sendError(res, `Reward probabilities must sum to exactly 100%. Current sum: ${sum.toFixed(3)}%`, 400, 'INVALID_SUM');
      return;
    }

    try {
      await prisma.systemSetting.upsert({
        where: { key: 'spin_rewards_distribution' },
        create: { key: 'spin_rewards_distribution', value: JSON.stringify(rewards) },
        update: { value: JSON.stringify(rewards) },
      });

      await recordAuditLog({
        adminId,
        action: 'UPDATE_SPIN_PROBABILITIES',
        targetEntity: 'SystemSetting',
        newValue: rewards,
        req,
      });

      sendSuccess(res, { message: 'Spin probabilities updated successfully', rewards });
    } catch {
      sendError(res, 'Failed to update probabilities', 500, 'SERVER_ERROR');
    }
  }

  /**
   * PUT /api/v1/admin/spin/cooldowns
   */
  public static async updateCooldowns(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = updateCooldownsSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid cooldowns payload', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    try {
      await prisma.systemSetting.upsert({
        where: { key: 'spin_cooldowns_hours' },
        create: { key: 'spin_cooldowns_hours', value: JSON.stringify(parse.data) },
        update: { value: JSON.stringify(parse.data) },
      });

      await recordAuditLog({
        adminId,
        action: 'UPDATE_SPIN_COOLDOWNS',
        targetEntity: 'SystemSetting',
        newValue: parse.data,
        req,
      });

      sendSuccess(res, { message: 'Spin cooldowns updated', cooldowns: parse.data });
    } catch {
      sendError(res, 'Failed to update cooldowns', 500, 'SERVER_ERROR');
    }
  }
}

