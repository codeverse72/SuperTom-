import { Response } from 'express';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';

export class AdminAuditLogController {
  /**
   * GET /api/v1/admin/audit-logs
   */
  public static async listLogs(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const skip = (page - 1) * limit;

      const action = (req.query.action as string)?.trim();
      const targetEntity = (req.query.targetEntity as string)?.trim();

      const where: any = {};
      if (action) where.action = { contains: action, mode: 'insensitive' };
      if (targetEntity) where.targetEntity = { contains: targetEntity, mode: 'insensitive' };

      const [total, logs] = await Promise.all([
        prisma.adminAuditLog.count({ where }),
        prisma.adminAuditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            admin: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        }),
      ]);

      sendSuccess(res, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        logs: logs.map((l) => ({
          id: l.id,
          adminId: l.adminId,
          adminName: l.admin.name,
          adminEmail: l.admin.email,
          adminRole: l.admin.role,
          action: l.action,
          targetEntity: l.targetEntity,
          targetId: l.targetId,
          previousValue: l.previousValue,
          newValue: l.newValue,
          ipAddress: l.ipAddress,
          createdAt: l.createdAt,
        })),
      });
    } catch {
      sendError(res, 'Failed to fetch audit logs', 500, 'SERVER_ERROR');
    }
  }
}

