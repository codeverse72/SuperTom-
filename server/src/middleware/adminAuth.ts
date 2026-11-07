import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken, AdminTokenPayload } from '../utils/crypto.js';
import { sendError } from '../utils/apiResponse.js';
import { prisma } from '../config/database.js';
import { AdminRole } from '@prisma/client';

export interface AuthenticatedAdminRequest extends Request {
  admin?: AdminTokenPayload;
}

/**
 * Validates Admin JWT token and checks if the admin account is active in the database.
 */
export async function requireAdminAuth(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Admin authentication required', 401, 'ADMIN_UNAUTHORIZED');
    return;
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyAdminToken(token);

  if (!payload) {
    sendError(res, 'Admin session invalid or expired', 401, 'ADMIN_TOKEN_EXPIRED');
    return;
  }

  // Verify status in DB
  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.adminId },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!admin || !admin.isActive) {
    sendError(res, 'Admin account suspended or does not exist', 403, 'ADMIN_FORBIDDEN');
    return;
  }

  req.admin = {
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
  };

  next();
}

/**
 * Role-based access control guard.
 */
export function requireAdminRole(allowedRoles: AdminRole[]) {
  return (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      sendError(res, 'Admin authentication required', 401, 'ADMIN_UNAUTHORIZED');
      return;
    }

    if (!allowedRoles.includes(req.admin.role as AdminRole)) {
      sendError(
        res,
        `Permission denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.admin.role}`,
        403,
        'INSUFFICIENT_PERMISSIONS'
      );
      return;
    }

    next();
  };
}

/**
 * Helper to record an immutable administrative audit log.
 */
export async function recordAuditLog(params: {
  adminId: string;
  action: string;
  targetEntity: string;
  targetId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  req?: Request;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetEntity: params.targetEntity,
        targetId: params.targetId,
        previousValue: params.previousValue ? JSON.stringify(params.previousValue) : null,
        newValue: params.newValue ? JSON.stringify(params.newValue) : null,
        ipAddress: params.req ? (params.req.ip || '0.0.0.0').toString() : null,
        userAgent: params.req ? params.req.headers['user-agent'] : null,
      },
    });
  } catch {
    // Avoid blocking operations if audit trail logging has transient issue
  }
}
