import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { hashPassword, verifyPassword, signAdminToken } from '../../utils/crypto.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8),
});

export class AdminAuthController {
  /**
   * POST /api/v1/admin/auth/login
   */
  public static async login(req: Request, res: Response): Promise<void> {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid email or password format', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const { email, password } = parse.data;

    try {
      const admin = await prisma.adminUser.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!admin || !admin.isActive) {
        sendError(res, 'Invalid credentials or inactive account', 401, 'INVALID_CREDENTIALS');
        return;
      }

      const isMatch = verifyPassword(password, admin.passwordHash);
      if (!isMatch) {
        sendError(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
        return;
      }

      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      });

      const token = signAdminToken({
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
      });

      await recordAuditLog({
        adminId: admin.id,
        action: 'ADMIN_LOGIN',
        targetEntity: 'AdminUser',
        targetId: admin.id,
        req,
      });

      sendSuccess(res, {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          lastLoginAt: admin.lastLoginAt,
        },
      });
    } catch {
      sendError(res, 'Login failed', 500, 'SERVER_ERROR');
    }
  }

  /**
   * GET /api/v1/admin/auth/me
   */
  public static async getProfile(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    if (!req.admin) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const admin = await prisma.adminUser.findUnique({
        where: { id: req.admin.adminId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      if (!admin) {
        sendError(res, 'Admin not found', 404, 'ADMIN_NOT_FOUND');
        return;
      }

      sendSuccess(res, admin);
    } catch {
      sendError(res, 'Failed to fetch admin profile', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/auth/change-password
   */
  public static async changePassword(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    if (!req.admin) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = changePasswordSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Password must be at least 8 characters long', 422, 'VALIDATION_ERROR');
      return;
    }

    const { currentPassword, newPassword } = parse.data;

    try {
      const admin = await prisma.adminUser.findUnique({
        where: { id: req.admin.adminId },
      });

      if (!admin) {
        sendError(res, 'Admin not found', 404, 'ADMIN_NOT_FOUND');
        return;
      }

      const isMatch = verifyPassword(currentPassword, admin.passwordHash);
      if (!isMatch) {
        sendError(res, 'Current password incorrect', 400, 'INCORRECT_PASSWORD');
        return;
      }

      const newHash = hashPassword(newPassword);

      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { passwordHash: newHash },
      });

      await recordAuditLog({
        adminId: admin.id,
        action: 'CHANGE_PASSWORD',
        targetEntity: 'AdminUser',
        targetId: admin.id,
        req,
      });

      sendSuccess(res, { message: 'Password updated successfully' });
    } catch {
      sendError(res, 'Failed to update password', 500, 'SERVER_ERROR');
    }
  }
}
