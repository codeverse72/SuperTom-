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
  color: z.string().optional(),
  borderColor: z.string().optional(),
  glowColor: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const createBiscuitSchema = z.object({
  id: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/, 'ID must be lowercase alphanumeric with underscores/hyphens'),
  name: z.string().min(2).max(60),
  costPoops: z.number().int().min(1),
  productionBoostPerHour: z.number().int().min(1),
  badge: z.string().default('Special'),
  color: z.string().default('#A855F7'),
  borderColor: z.string().default('rgba(168, 85, 247, 0.4)'),
  glowColor: z.string().default('rgba(168, 85, 247, 0.3)'),
  description: z.string().default('A special royal feline treat.'),
  isActive: z.boolean().default(true),
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

  /**
   * POST /api/v1/admin/biscuits
   * Launches a brand new biscuit product.
   */
  public static async createBiscuit(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = createBiscuitSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid biscuit payload', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const data = parse.data;

    try {
      const existing = await prisma.biscuitProduct.findUnique({ where: { id: data.id } });
      if (existing) {
        sendError(res, `Biscuit with ID "${data.id}" already exists`, 409, 'ALREADY_EXISTS');
        return;
      }

      const created = await prisma.biscuitProduct.create({
        data: {
          id: data.id,
          name: data.name,
          costPoops: BigInt(data.costPoops),
          productionBoostPerHour: data.productionBoostPerHour,
          badge: data.badge,
          color: data.color,
          borderColor: data.borderColor,
          glowColor: data.glowColor,
          description: data.description,
          isActive: data.isActive,
        },
      });

      await recordAuditLog({
        adminId,
        action: 'CREATE_BISCUIT_PRODUCT',
        targetEntity: 'BiscuitProduct',
        targetId: created.id,
        newValue: {
          id: created.id,
          name: created.name,
          costPoops: Number(created.costPoops),
          productionBoostPerHour: created.productionBoostPerHour,
        },
        req,
      });

      sendSuccess(res, {
        id: created.id,
        name: created.name,
        costPoops: Number(created.costPoops),
        productionBoostPerHour: created.productionBoostPerHour,
        badge: created.badge,
        color: created.color,
        borderColor: created.borderColor,
        glowColor: created.glowColor,
        description: created.description,
        isActive: created.isActive,
      }, 201);
    } catch {
      sendError(res, 'Failed to create biscuit product', 500, 'SERVER_ERROR');
    }
  }

  /**
   * DELETE /api/v1/admin/biscuits/:id
   */
  public static async deleteBiscuit(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const existing = await prisma.biscuitProduct.findUnique({
        where: { id },
        include: {
          _count: { select: { inventories: true, feedingEvents: true } },
        },
      });

      if (!existing) {
        sendError(res, 'Biscuit not found', 404, 'NOT_FOUND');
        return;
      }

      // If user inventories or feeding events exist, archive/deactivate rather than hard delete
      if (existing._count.inventories > 0 || existing._count.feedingEvents > 0) {
        await prisma.biscuitProduct.update({
          where: { id },
          data: { isActive: false },
        });

        await recordAuditLog({
          adminId,
          action: 'DEACTIVATE_BISCUIT_PRODUCT',
          targetEntity: 'BiscuitProduct',
          targetId: id,
          req,
        });

        sendSuccess(res, { message: 'Biscuit deactivated because player records exist.', deactivated: true });
        return;
      }

      await prisma.biscuitProduct.delete({ where: { id } });

      await recordAuditLog({
        adminId,
        action: 'DELETE_BISCUIT_PRODUCT',
        targetEntity: 'BiscuitProduct',
        targetId: id,
        req,
      });

      sendSuccess(res, { message: 'Biscuit successfully deleted.', deleted: true });
    } catch {
      sendError(res, 'Failed to delete biscuit', 500, 'SERVER_ERROR');
    }
  }
}

