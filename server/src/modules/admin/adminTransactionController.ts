import { Response } from 'express';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { LedgerType } from '@prisma/client';

export class AdminTransactionController {
  /**
   * GET /api/v1/admin/transactions
   */
  public static async listTransactions(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const skip = (page - 1) * limit;

      const type = req.query.type as LedgerType | undefined;
      const search = (req.query.search as string)?.trim();
      const userId = req.query.userId as string | undefined;

      const where: any = {};
      if (type) where.type = type;
      if (userId) where.userId = userId;

      if (search) {
        const isNumeric = /^\d+$/.test(search);
        where.OR = [
          { description: { contains: search, mode: 'insensitive' } },
          { user: { username: { contains: search, mode: 'insensitive' } } },
          ...(isNumeric ? [{ user: { telegramId: BigInt(search) } }] : []),
        ];
      }

      const [total, entries] = await Promise.all([
        prisma.ledgerEntry.count({ where }),
        prisma.ledgerEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { telegramId: true, username: true, firstName: true },
            },
          },
        }),
      ]);

      sendSuccess(res, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        transactions: entries.map((e) => ({
          id: e.id,
          userId: e.userId,
          telegramId: e.user.telegramId.toString(),
          username: e.user.username || e.user.firstName,
          type: e.type,
          amount: Number(e.amount),
          balanceBefore: Number(e.balanceBefore),
          balanceAfter: Number(e.balanceAfter),
          description: e.description,
          referenceId: e.referenceId,
          createdAt: e.createdAt,
        })),
      });
    } catch {
      sendError(res, 'Failed to fetch ledger transactions', 500, 'SERVER_ERROR');
    }
  }
}

