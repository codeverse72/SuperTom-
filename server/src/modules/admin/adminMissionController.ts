import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';
import { MissionCategory, VerificationType } from '@prisma/client';

const createMissionSchema = z.object({
  id: z.string().min(2),
  title: z.string().min(2),
  description: z.string().min(5),
  rewardPoops: z.number().int().min(1),
  category: z.nativeEnum(MissionCategory),
  verificationType: z.nativeEnum(VerificationType),
  icon: z.string().default('Trophy'),
  badge: z.string().optional(),
  actionUrl: z.string().optional(),
  channelId: z.string().optional(),
});

const updateMissionSchema = createMissionSchema.partial().omit({ id: true }).extend({
  isActive: z.boolean().optional(),
});

export class AdminMissionController {
  /**
   * GET /api/v1/admin/missions
   */
  public static async listMissions(_req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const missions = await prisma.mission.findMany({
        include: {
          _count: {
            select: { userMissions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      sendSuccess(
        res,
        missions.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          rewardPoops: Number(m.rewardPoops),
          category: m.category,
          verificationType: m.verificationType,
          icon: m.icon,
          badge: m.badge,
          actionUrl: m.actionUrl,
          channelId: m.channelId,
          isActive: m.isActive,
          totalParticipants: m._count.userMissions,
          createdAt: m.createdAt,
        }))
      );
    } catch {
      sendError(res, 'Failed to fetch missions', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/missions
   */
  public static async createMission(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = createMissionSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid mission details', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    try {
      const existing = await prisma.mission.findUnique({ where: { id: parse.data.id } });
      if (existing) {
        sendError(res, 'Mission ID already exists', 409, 'CONFLICT');
        return;
      }

      const mission = await prisma.mission.create({
        data: {
          id: parse.data.id,
          title: parse.data.title,
          description: parse.data.description,
          rewardPoops: BigInt(parse.data.rewardPoops),
          category: parse.data.category,
          verificationType: parse.data.verificationType,
          icon: parse.data.icon,
          badge: parse.data.badge,
          actionUrl: parse.data.actionUrl,
          channelId: parse.data.channelId,
        },
      });

      await recordAuditLog({
        adminId,
        action: 'CREATE_MISSION',
        targetEntity: 'Mission',
        targetId: mission.id,
        newValue: parse.data,
        req,
      });

      sendSuccess(res, {
        id: mission.id,
        title: mission.title,
        rewardPoops: Number(mission.rewardPoops),
      }, 201);
    } catch {
      sendError(res, 'Failed to create mission', 500, 'SERVER_ERROR');
    }
  }

  /**
   * PUT /api/v1/admin/missions/:id
   */
  public static async updateMission(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = updateMissionSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid mission details', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    try {
      const existing = await prisma.mission.findUnique({ where: { id } });
      if (!existing) {
        sendError(res, 'Mission not found', 404, 'NOT_FOUND');
        return;
      }

      const updated = await prisma.mission.update({
        where: { id },
        data: {
          title: parse.data.title ?? existing.title,
          description: parse.data.description ?? existing.description,
          rewardPoops: parse.data.rewardPoops ? BigInt(parse.data.rewardPoops) : existing.rewardPoops,
          category: parse.data.category ?? existing.category,
          verificationType: parse.data.verificationType ?? existing.verificationType,
          icon: parse.data.icon ?? existing.icon,
          badge: parse.data.badge !== undefined ? parse.data.badge : existing.badge,
          actionUrl: parse.data.actionUrl !== undefined ? parse.data.actionUrl : existing.actionUrl,
          channelId: parse.data.channelId !== undefined ? parse.data.channelId : existing.channelId,
          isActive: parse.data.isActive !== undefined ? parse.data.isActive : existing.isActive,
        },
      });

      await recordAuditLog({
        adminId,
        action: 'UPDATE_MISSION',
        targetEntity: 'Mission',
        targetId: id,
        previousValue: existing,
        newValue: parse.data,
        req,
      });

      sendSuccess(res, {
        id: updated.id,
        title: updated.title,
        rewardPoops: Number(updated.rewardPoops),
        isActive: updated.isActive,
      });
    } catch {
      sendError(res, 'Failed to update mission', 500, 'SERVER_ERROR');
    }
  }

  /**
   * DELETE /api/v1/admin/missions/:id
   */
  public static async deactivateMission(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const updated = await prisma.mission.update({
        where: { id },
        data: { isActive: false },
      });

      await recordAuditLog({
        adminId,
        action: 'DEACTIVATE_MISSION',
        targetEntity: 'Mission',
        targetId: id,
        req,
      });

      sendSuccess(res, { id: updated.id, isActive: false, message: 'Mission deactivated' });
    } catch {
      sendError(res, 'Failed to deactivate mission', 500, 'SERVER_ERROR');
    }
  }
}
