import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';

const updateBiscuitSchema = z.object({
  name: z.string().min(1).optional(),
  costPoops: z.number().int().min(1).optional(),
  productionBoostPerHour: z.number().int().min(1).optional(),
  badge: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export class AdminBiscuitController {
  /**
   * GET /api/v1/admin/biscuits
   */
  public static async listBiscuits(_req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const biscuits = await prisma.biscuitProduct.findMany({
        include: {
          _count: {
            select: { inventories: true, feedingEvents: true },
          },
        },
        orderBy: { costPoops: 'asc' },
      });

      sendSuccess(
        res,
        biscuits.map((b) => ({
          id: b.id,
          name: b.name,
          costPoops: Number(b.costPoops),
          productionBoostPerHour: b.productionBoostPerHour,
          currencyType: b.currencyType,
          badge: b.badge,
          color: b.color,
          borderColor: b.borderColor,
          glowColor: b.glowColor,
          description: b.description,
          isActive: b.isActive,
          totalPurchasedInventory: b._count.inventories,
          totalFedCount: b._count.feedingEvents,
        }))
      );
    } catch {
      sendError(res, 'Failed to fetch biscuits', 500, 'SERVER_ERROR');
    }
  }

  /**
   * PUT /api/v1/admin/biscuits/:id
   */
  public static async updateBiscuit(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = updateBiscuitSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid biscuit payload', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    try {
      const existing = await prisma.biscuitProduct.findUnique({ where: { id } });
      if (!existing) {
        sendError(res, 'Biscuit product not found', 404, 'NOT_FOUND');
        return;
      }

      const updated = await prisma.biscuitProduct.update({
        where: { id },
        data: {
          name: parse.data.name ?? existing.name,
          costPoops: parse.data.costPoops ? BigInt(parse.data.costPoops) : existing.costPoops,
          productionBoostPerHour: parse.data.productionBoostPerHour ?? existing.productionBoostPerHour,
          badge: parse.data.badge ?? existing.badge,
          description: parse.data.description ?? existing.description,
          isActive: parse.data.isActive ?? existing.isActive,
        },
      });

      await recordAuditLog({
        adminId,
        action: 'UPDATE_BISCUIT_PRODUCT',
        targetEntity: 'BiscuitProduct',
        targetId: id,
        previousValue: {
          name: existing.name,
          costPoops: Number(existing.costPoops),
          boost: existing.productionBoostPerHour,
          isActive: existing.isActive,
        },
        newValue: parse.data,
        req,
      });

      sendSuccess(res, {
        id: updated.id,
        name: updated.name,
        costPoops: Number(updated.costPoops),
        productionBoostPerHour: updated.productionBoostPerHour,
        isActive: updated.isActive,
      });
    } catch {
      sendError(res, 'Failed to update biscuit', 500, 'SERVER_ERROR');
    }
  }
}

