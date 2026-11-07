import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';

const updateMiningSchema = z.object({
  baseRatePerHour: z.number().int().min(1).max(1000).optional(),
  maxAccumulationHours: z.number().int().min(1).max(72).optional(),
});

export class AdminMiningController {
  /**
   * GET /api/v1/admin/mining
   */
  public static async getSettings(_req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const [baseRateSetting, maxHoursSetting, avgRateAgg] = await Promise.all([
        prisma.systemSetting.findUnique({ where: { key: 'mining_base_rate_per_hour' } }),
        prisma.systemSetting.findUnique({ where: { key: 'mining_max_accumulation_hours' } }),
        prisma.miningSettlement.aggregate({
          _avg: { totalRatePerHour: true, boostRatePerHour: true },
          _count: { id: true },
        }),
      ]);

      sendSuccess(res, {
        baseRatePerHour: baseRateSetting ? parseInt(baseRateSetting.value, 10) : 10,
        maxAccumulationHours: maxHoursSetting ? parseInt(maxHoursSetting.value, 10) : 24,
        activeMinersCount: avgRateAgg._count.id,
        averageMiningRate: Math.round(avgRateAgg._avg.totalRatePerHour ?? 10),
        averageBoostRate: Math.round(avgRateAgg._avg.boostRatePerHour ?? 0),
      });
    } catch {
      sendError(res, 'Failed to fetch mining settings', 500, 'SERVER_ERROR');
    }
  }

  /**
   * PUT /api/v1/admin/mining
   */
  public static async updateSettings(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = updateMiningSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid mining settings', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const { baseRatePerHour, maxAccumulationHours } = parse.data;

    try {
      if (baseRatePerHour !== undefined) {
        await prisma.systemSetting.upsert({
          where: { key: 'mining_base_rate_per_hour' },
          create: { key: 'mining_base_rate_per_hour', value: baseRatePerHour.toString() },
          update: { value: baseRatePerHour.toString() },
        });
      }

      if (maxAccumulationHours !== undefined) {
        await prisma.systemSetting.upsert({
          where: { key: 'mining_max_accumulation_hours' },
          create: { key: 'mining_max_accumulation_hours', value: maxAccumulationHours.toString() },
          update: { value: maxAccumulationHours.toString() },
        });
      }

      await recordAuditLog({
        adminId,
        action: 'UPDATE_MINING_SETTINGS',
        targetEntity: 'SystemSetting',
        newValue: parse.data,
        req,
      });

      sendSuccess(res, { message: 'Mining settings updated successfully', settings: parse.data });
    } catch {
      sendError(res, 'Failed to update mining settings', 500, 'SERVER_ERROR');
    }
  }
}
