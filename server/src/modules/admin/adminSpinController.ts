import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';
import { SpinController } from '../spin/spinController.js';

const spinRewardSchema = z.object({
  id: z.string(),
  label: z.string(),
  rewardType: z.enum(['poops', 'biscuit']),
  amount: z.number().nullable().optional(),
  biscuitId: z.string().nullable().optional(),
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
        { id: 'poop-100', label: '100 Poops', rewardType: 'poops', amount: 100, percentage: 25.0 },
        { id: 'poop-300', label: '300 Poops', rewardType: 'poops', amount: 300, percentage: 6.0 },
        { id: 'poop-250', label: '250 Poops', rewardType: 'poops', amount: 250, percentage: 15.0 },
        { id: 'poop-750', label: '750 Poops', rewardType: 'poops', amount: 750, percentage: 3.0 },
        { id: 'poop-0', label: '0 Poops', rewardType: 'poops', amount: 0, percentage: 30.0 },
        { id: 'poop-525', label: '525 Poops', rewardType: 'poops', amount: 525, percentage: 20.0 },
        { id: 'poop-1000', label: '1,000 Poops', rewardType: 'poops', amount: 1000, percentage: 1.0 },
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
   * Saves and auto-normalizes probabilities so they equal exactly 100.00%.
   * Updates in-memory execution cache immediately for real-time player spins.
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

    // Validate sum is strictly positive
    const rawSum = rewards.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0);
    if (rawSum <= 0) {
      sendError(res, 'Total probabilities must be greater than 0%', 400, 'INVALID_SUM');
      return;
    }

    // Auto-normalize percentages so sum is always mathematically 100.00%
    const normalizedRewards = rewards.map((r) => {
      const p = Math.max(0, Number(r.percentage) || 0);
      return {
        ...r,
        amount: r.amount ?? (r.id === 'poop-0' ? 0 : undefined),
        percentage: Number(((p / rawSum) * 100).toFixed(2)),
      };
    });

    // Absorb any +/-0.01% rounding residue onto the largest segment
    const currentSum = normalizedRewards.reduce((acc, r) => acc + r.percentage, 0);
    const remainder = Number((100 - currentSum).toFixed(2));
    if (remainder !== 0 && normalizedRewards.length > 0) {
      let maxIdx = 0;
      for (let i = 1; i < normalizedRewards.length; i++) {
        if (normalizedRewards[i].percentage > normalizedRewards[maxIdx].percentage) {
          maxIdx = i;
        }
      }
      normalizedRewards[maxIdx].percentage = Number((normalizedRewards[maxIdx].percentage + remainder).toFixed(2));
    }

    try {
      await prisma.systemSetting.upsert({
        where: { key: 'spin_rewards_distribution' },
        create: { key: 'spin_rewards_distribution', value: JSON.stringify(normalizedRewards) },
        update: { value: JSON.stringify(normalizedRewards) },
      });

      // Synchronize in-memory execution cache immediately
      SpinController.setRewardsCache(normalizedRewards);

      await recordAuditLog({
        adminId,
        action: 'UPDATE_SPIN_PROBABILITIES',
        targetEntity: 'SystemSetting',
        newValue: normalizedRewards,
        req,
      });

      sendSuccess(res, { message: 'Spin probabilities updated successfully', rewards: normalizedRewards });
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

  /**
   * POST /api/v1/admin/spin/reset-cooldown
   */
  public static async resetSpinCooldown(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const { identifier, resetAll } = req.body || {};

    try {
      if (resetAll) {
        await prisma.spinState.updateMany({
          data: { nextUnlockAt: new Date() },
        });

        await recordAuditLog({
          adminId,
          action: 'RESET_ALL_SPIN_COOLDOWNS',
          targetEntity: 'SpinState',
          req,
        });

        sendSuccess(res, { message: 'All users spin cooldowns reset successfully. All users can now spin immediately!' });
        return;
      }

      if (!identifier) {
        sendError(res, 'Player identifier (Telegram ID, username, or User ID) is required', 400, 'VALIDATION_ERROR');
        return;
      }

      const clean = String(identifier).replace('@', '').trim();
      const orConditions: Array<{ id?: string; username?: { equals: string; mode: 'insensitive' }; telegramId?: bigint }> = [
        { id: clean },
        { username: { equals: clean, mode: 'insensitive' } },
      ];
      if (/^\d+$/.test(clean)) {
        try {
          orConditions.push({ telegramId: BigInt(clean) });
        } catch {}
      }

      const user = await prisma.user.findFirst({
        where: { OR: orConditions },
      });

      if (!user) {
        sendError(res, `User "${identifier}" not found`, 404, 'NOT_FOUND');
        return;
      }

      await prisma.spinState.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          currentMilestone: 1,
          cycleCount: 1,
          nextUnlockAt: new Date(),
          claimedMilestones: '[]',
        },
        update: {
          nextUnlockAt: new Date(),
        },
      });

      await recordAuditLog({
        adminId,
        action: 'RESET_USER_SPIN_COOLDOWN',
        targetEntity: 'SpinState',
        targetId: user.id,
        req,
      });

      sendSuccess(res, { message: `Free spin unlocked immediately for @${user.username || user.telegramId}!` });
    } catch {
      sendError(res, 'Failed to reset spin cooldown', 500, 'SERVER_ERROR');
    }
  }
}

