import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';
import {
  AdminBroadcastService,
  BroadcastAudienceSegment,
  renderBroadcastMessage,
} from './adminBroadcastService.js';

const AUDIENCE_SEGMENTS = [
  'all_active',
  'inactive_24h',
  'inactive_72h',
  'inactive_7d',
  'low_balance',
] as const satisfies readonly BroadcastAudienceSegment[];

const sendBroadcastSchema = z.object({
  audience: z.enum(AUDIENCE_SEGMENTS),
  message: z.string().trim().min(1, 'Broadcast message cannot be empty').max(4000, 'Telegram messages max out at 4096 characters'),
  templateId: z.string().optional().nullable(),
  includeMiniAppButton: z.boolean().default(true),
  ctaText: z.string().trim().max(64).optional(),
  includeSecondaryButtons: z.boolean().default(false),
});

const testBroadcastSchema = z.object({
  targetIdentifier: z.string().trim().min(1, 'Enter a Telegram ID or @username'),
  message: z.string().trim().min(1, 'Message cannot be empty').max(4000),
  includeMiniAppButton: z.boolean().default(true),
  ctaText: z.string().trim().max(64).optional(),
  includeSecondaryButtons: z.boolean().default(false),
});

function isBotTokenConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN !== 'TEST_BOT_TOKEN_PLACEHOLDER');
}

export class AdminBroadcastController {
  /**
   * GET /api/v1/admin/broadcast/overview
   */
  public static async getOverview(_req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const [audienceCounts, historyRows] = await Promise.all([
        AdminBroadcastService.getAudienceCounts(),
        prisma.adminAuditLog.findMany({
          where: { targetEntity: 'TELEGRAM_BROADCAST' },
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            admin: {
              select: { name: true, email: true, role: true },
            },
          },
        }),
      ]);

      const history = historyRows.map((row) => {
        let parsed: Record<string, unknown> = {};
        if (row.newValue) {
          try {
            parsed = JSON.parse(row.newValue) as Record<string, unknown>;
          } catch {
            parsed = {};
          }
        }
        return {
          id: row.id,
          jobId: row.targetId,
          action: row.action,
          adminName: row.admin.name,
          adminEmail: row.admin.email,
          createdAt: row.createdAt,
          ...parsed,
        };
      });

      sendSuccess(res, {
        botConfigured: isBotTokenConfigured(),
        templates: AdminBroadcastService.getTemplates(),
        audienceCounts,
        activeJob: AdminBroadcastService.getRunningJob(),
        recentJobs: AdminBroadcastService.listRecentJobs(),
        history,
      });
    } catch {
      sendError(res, 'Failed to load broadcast overview', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/broadcast/test
   */
  public static async sendTestMessage(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    if (!isBotTokenConfigured()) {
      sendError(res, 'TELEGRAM_BOT_TOKEN is not configured on the server', 400, 'BOT_TOKEN_MISSING');
      return;
    }

    const parse = testBroadcastSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid test broadcast parameters', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const { targetIdentifier, message, includeMiniAppButton, ctaText, includeSecondaryButtons } = parse.data;

    try {
      let targetUser: {
        telegramId: bigint;
        firstName: string | null;
        username: string | null;
        poopsBalance: bigint;
        referralCode: string;
      } | null = null;

      if (/^-?\d+$/.test(targetIdentifier)) {
        targetUser = await prisma.user.findUnique({
          where: { telegramId: BigInt(targetIdentifier) },
          select: { telegramId: true, firstName: true, username: true, poopsBalance: true, referralCode: true },
        });
      } else {
        const cleanUsername = targetIdentifier.replace(/^@/, '');
        targetUser = await prisma.user.findFirst({
          where: { username: { equals: cleanUsername, mode: 'insensitive' } },
          select: { telegramId: true, firstName: true, username: true, poopsBalance: true, referralCode: true },
        });
      }

      const chatId = targetUser?.telegramId.toString() ?? (/^-?\d+$/.test(targetIdentifier) ? targetIdentifier : null);
      if (!chatId) {
        sendError(
          res,
          `No player found matching "${targetIdentifier}". Enter a numeric Telegram ID or registered @username.`,
          404,
          'TARGET_NOT_FOUND'
        );
        return;
      }

      const rendered = renderBroadcastMessage(
        message,
        targetUser ?? {
          firstName: 'Admin',
          username: targetIdentifier,
          poopsBalance: 2500n,
          referralCode: 'TOMVIP',
        }
      );

      const replyMarkup = await AdminBroadcastService.buildReplyMarkup({
        includeMiniAppButton,
        ctaText,
        includeSecondaryButtons,
      });

      const tgResult = await AdminBroadcastService.sendTelegramMessage({
        chatId,
        htmlText: rendered,
        replyMarkup,
      });

      if (!tgResult.ok) {
        sendError(res, `Telegram delivery failed: ${tgResult.error || 'Unknown error'}`, 400, 'TELEGRAM_SEND_FAILED');
        return;
      }

      await recordAuditLog({
        adminId,
        action: 'BROADCAST_TEST',
        targetEntity: 'TELEGRAM_BROADCAST',
        targetId: chatId,
        newValue: {
          targetIdentifier,
          chatId,
          messagePreview: message.slice(0, 140),
        },
        req,
      });

      sendSuccess(res, {
        message: `Test broadcast delivered to Telegram chat ${chatId}`,
        chatId,
      });
    } catch {
      sendError(res, 'Failed to send test broadcast', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/broadcast/send
   */
  public static async sendBroadcast(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    if (!isBotTokenConfigured()) {
      sendError(res, 'TELEGRAM_BOT_TOKEN is not configured on the server', 400, 'BOT_TOKEN_MISSING');
      return;
    }

    const parse = sendBroadcastSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid broadcast payload', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    const runningJob = AdminBroadcastService.getRunningJob();
    if (runningJob) {
      sendError(
        res,
        `Another broadcast job (${runningJob.id}) is currently running (${runningJob.processed}/${runningJob.totalTargets}). Please wait or cancel it first.`,
        409,
        'BROADCAST_ALREADY_RUNNING'
      );
      return;
    }

    try {
      const counts = await AdminBroadcastService.getAudienceCounts();
      const targetCount = counts[parse.data.audience];
      if (targetCount === 0) {
        sendError(res, 'No active users match the selected audience segment.', 400, 'EMPTY_AUDIENCE');
        return;
      }

      const job = await AdminBroadcastService.startBroadcastJob({
        ...parse.data,
        adminId,
        adminEmail: req.admin?.email,
        ipAddress: (req.ip || '0.0.0.0').toString(),
        userAgent: req.headers['user-agent']?.toString() ?? null,
      });

      sendSuccess(res, { job }, 202);
    } catch {
      sendError(res, 'Failed to start broadcast job', 500, 'SERVER_ERROR');
    }
  }

  /**
   * GET /api/v1/admin/broadcast/jobs/:id
   */
  public static async getJobStatus(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const job = AdminBroadcastService.getJob(req.params.id);
    if (!job) {
      sendError(res, 'Broadcast job not found', 404, 'JOB_NOT_FOUND');
      return;
    }
    sendSuccess(res, { job });
  }

  /**
   * POST /api/v1/admin/broadcast/jobs/:id/cancel
   */
  public static async cancelJob(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const job = AdminBroadcastService.cancelJob(req.params.id);
    if (!job) {
      sendError(res, 'Running broadcast job not found', 404, 'JOB_NOT_FOUND');
      return;
    }
    sendSuccess(res, { job, message: 'Cancellation requested' });
  }
}

