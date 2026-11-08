import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedAdminRequest, recordAuditLog } from '../../middleware/adminAuth.js';
import { PayoutAutomationService } from './payoutAutomationService.js';
import { logger } from '../../utils/logger.js';

const updateConfigSchema = z.object({
  referenceChannel: z.string().optional(),
  destinationChannel: z.string().optional(),
  destinationChatId: z.string().nullable().optional(),
  automationEnabled: z.boolean().optional(),
  publishingMode: z.enum(['AUTOMATIC', 'MANUAL_APPROVAL']).optional(),
  autoReflectReference: z.boolean().optional(),
  activeTemplateId: z.string().nullable().optional(),
});

const templateSchema = z.object({
  name: z.string().min(2, 'Template name required'),
  description: z.string().optional(),
  heading: z.string().min(2, 'Heading required'),
  successMessage: z.string().min(2, 'Success message required'),
  footer: z.string().min(2, 'Footer required'),
  emojis: z.string().default('💎,💰,🚀,🐱,✅,🔗'),
  currencyDisplay: z.string().default('USDT'),
  showUsd: z.boolean().default(true),
  showPoops: z.boolean().default(true),
  showExplorerLink: z.boolean().default(true),
  maskUserAddress: z.boolean().default(true),
  rawTemplate: z.string().nullable().optional(),
  isDefault: z.boolean().default(false),
});

const analyzeMessageSchema = z.object({
  rawMessage: z.string().min(5, 'Reference message text is required'),
});

const editAnnouncementSchema = z.object({
  renderedMessage: z.string().min(10, 'Rendered message cannot be empty'),
});

export class PayoutAutomationController {
  /**
   * GET /api/v1/admin/payout-automation/config
   */
  public static async getConfig(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const config = await PayoutAutomationService.getOrCreateConfig();

      const [pendingCount, publishedCount, failedCount, totalTemplates] = await Promise.all([
        prisma.payoutAnnouncement.count({ where: { status: 'PENDING_APPROVAL' } }),
        prisma.payoutAnnouncement.count({ where: { status: 'PUBLISHED' } }),
        prisma.payoutAnnouncement.count({ where: { status: 'FAILED' } }),
        prisma.payoutMessageTemplate.count(),
      ]);

      sendSuccess(res, {
        config: {
          id: config.id,
          referenceChannel: config.referenceChannel,
          destinationChannel: config.destinationChannel,
          destinationChatId: config.destinationChatId,
          referenceStatus: config.referenceStatus,
          destinationStatus: config.destinationStatus,
          automationEnabled: config.automationEnabled,
          publishingMode: config.publishingMode,
          autoReflectReference: config.autoReflectReference,
          activeTemplateId: config.activeTemplateId,
          lastSyncAt: config.lastSyncAt,
          lastPublishedAt: config.lastPublishedAt,
          lastPublishedTxHash: config.lastPublishedTxHash,
          lastPublishedAmount: config.lastPublishedAmount ? Number(config.lastPublishedAmount) : null,
          failedAttemptsCount: config.failedAttemptsCount,
          totalPublishedCount: config.totalPublishedCount,
        },
        counts: {
          pendingCount,
          publishedCount,
          failedCount,
          totalTemplates,
        },
      });
    } catch (err: unknown) {
      logger.error('[PayoutAutomationController] getConfig error:', err);
      sendError(res, 'Failed to fetch payout automation config', 500, 'SERVER_ERROR');
    }
  }

  /**
   * PUT /api/v1/admin/payout-automation/config
   */
  public static async updateConfig(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const adminId = req.admin?.adminId;
    if (!adminId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parse = updateConfigSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid configuration parameters', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    try {
      const config = await PayoutAutomationService.getOrCreateConfig();
      const data: any = {};

      if (parse.data.referenceChannel !== undefined) data.referenceChannel = parse.data.referenceChannel.trim();
      if (parse.data.destinationChannel !== undefined) data.destinationChannel = parse.data.destinationChannel.trim();
      if (parse.data.destinationChatId !== undefined) data.destinationChatId = parse.data.destinationChatId;
      if (parse.data.automationEnabled !== undefined) data.automationEnabled = parse.data.automationEnabled;
      if (parse.data.publishingMode !== undefined) data.publishingMode = parse.data.publishingMode;
      if (parse.data.autoReflectReference !== undefined) data.autoReflectReference = parse.data.autoReflectReference;
      if (parse.data.activeTemplateId !== undefined) data.activeTemplateId = parse.data.activeTemplateId;

      const updated = await prisma.payoutChannelConfig.update({
        where: { id: config.id },
        data,
      });

      await recordAuditLog({
        adminId,
        action: 'UPDATE_PAYOUT_AUTOMATION_CONFIG',
        targetEntity: 'PayoutChannelConfig',
        targetId: updated.id,
        previousValue: config,
        newValue: updated,
        req,
      });

      sendSuccess(res, { config: updated, message: 'Payout automation configuration updated successfully' });
    } catch (err) {
      logger.error('[PayoutAutomationController] updateConfig error:', err);
      sendError(res, 'Failed to update config', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/payout-automation/verify-reference
   */
  public static async verifyReferenceChannel(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const channelInput = (req.body?.channel as string) || (await PayoutAutomationService.getOrCreateConfig()).referenceChannel || '';
      if (!channelInput) {
        sendError(res, 'Reference channel identifier required', 400, 'MISSING_CHANNEL');
        return;
      }

      const result = await PayoutAutomationService.verifyReferenceChannel(channelInput);
      const config = await PayoutAutomationService.getOrCreateConfig();

      await prisma.payoutChannelConfig.update({
        where: { id: config.id },
        data: {
          referenceChannel: channelInput,
          referenceStatus: 'CONNECTED',
          lastSyncAt: new Date(),
        },
      });

      await prisma.payoutAutomationLog.create({
        data: {
          eventType: 'CHANNEL_VERIFIED',
          status: 'SUCCESS',
          message: `Reference channel connected: ${channelInput} (No bot permissions needed from owner)`,
          adminId: req.admin?.adminId,
        },
      });

      sendSuccess(res, { ...result, success: true });
    } catch (err) {
      sendError(res, 'Failed to verify reference channel', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/payout-automation/verify-destination
   */
  public static async verifyDestinationChannel(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const channelInput = (req.body?.channel as string) || (await PayoutAutomationService.getOrCreateConfig()).destinationChannel || 'https://t.me/+W9ypwO2_Pm0xZTJl';
      const chatIdOverride = req.body?.chatId as string | undefined;

      const result = await PayoutAutomationService.verifyDestinationChannel(channelInput, chatIdOverride);
      const config = await PayoutAutomationService.getOrCreateConfig();

      const newStatus = result.success
        ? (result.isInviteLink ? 'CONFIGURED' : 'VERIFIED')
        : result.isAdministrator
        ? 'PERMISSION_MISSING'
        : result.isInviteLink
        ? 'CONFIGURED'
        : 'ERROR';

      await prisma.payoutChannelConfig.update({
        where: { id: config.id },
        data: {
          destinationChannel: channelInput,
          ...(result.channelId && result.channelId.startsWith('-') ? { destinationChatId: result.channelId } : {}),
          destinationStatus: newStatus,
        },
      });

      await prisma.payoutAutomationLog.create({
        data: {
          eventType: 'CHANNEL_VERIFIED',
          status: result.success ? 'SUCCESS' : 'INFO',
          message: result.success
            ? `Destination payout channel configured: ${channelInput}`
            : `Destination channel note: ${result.error}`,
          adminId: req.admin?.adminId,
        },
      });

      sendSuccess(res, result);
    } catch (err) {
      sendError(res, 'Failed to verify destination channel', 500, 'SERVER_ERROR');
    }
  }

  /**
   * GET /api/v1/admin/payout-automation/detect-channels
   */
  public static async detectBotChannels(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const channels = await PayoutAutomationService.detectBotAdminChannels();
      sendSuccess(res, { channels });
    } catch (err) {
      sendError(res, 'Failed to detect bot channels', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/payout-automation/sync-reflect
   */
  public static async syncAndReflect(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const sampleText = req.body?.sampleText as string | undefined;
      const result = await PayoutAutomationService.syncAndReflectReferencePayout(sampleText);
      sendSuccess(res, result);
    } catch (err: unknown) {
      logger.error('[PayoutAutomationController] syncAndReflect error:', err);
      sendError(
        res,
        err instanceof Error ? err.message : 'Failed to sync and reflect reference payout',
        500,
        'SERVER_ERROR'
      );
    }
  }

  /**
   * GET /api/v1/admin/payout-automation/templates
   */
  public static async listTemplates(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const templates = await prisma.payoutMessageTemplate.findMany({
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      sendSuccess(res, { templates });
    } catch (err) {
      sendError(res, 'Failed to list templates', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/payout-automation/templates
   */
  public static async createTemplate(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const parse = templateSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid template parameters', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    try {
      if (parse.data.isDefault) {
        await prisma.payoutMessageTemplate.updateMany({
          data: { isDefault: false },
        });
      }

      const template = await prisma.payoutMessageTemplate.create({
        data: parse.data,
      });

      sendSuccess(res, { template, message: 'Payout announcement template created' }, 201);
    } catch (err) {
      sendError(res, 'Failed to create template', 500, 'SERVER_ERROR');
    }
  }

  /**
   * PUT /api/v1/admin/payout-automation/templates/:id
   */
  public static async updateTemplate(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const parse = templateSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Invalid template parameters', 422, 'VALIDATION_ERROR', parse.error.format());
      return;
    }

    try {
      if (parse.data.isDefault) {
        await prisma.payoutMessageTemplate.updateMany({
          where: { id: { not: id } },
          data: { isDefault: false },
        });
      }

      const updated = await prisma.payoutMessageTemplate.update({
        where: { id },
        data: parse.data,
      });

      sendSuccess(res, { template: updated, message: 'Template updated successfully' });
    } catch (err) {
      sendError(res, 'Failed to update template', 500, 'SERVER_ERROR');
    }
  }

  /**
   * DELETE /api/v1/admin/payout-automation/templates/:id
   */
  public static async deleteTemplate(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const template = await prisma.payoutMessageTemplate.findUnique({ where: { id } });
      if (!template) {
        sendError(res, 'Template not found', 404, 'NOT_FOUND');
        return;
      }
      if (template.isDefault) {
        sendError(res, 'Cannot delete the default template', 400, 'CANNOT_DELETE_DEFAULT');
        return;
      }

      await prisma.payoutMessageTemplate.delete({ where: { id } });
      sendSuccess(res, { message: 'Template deleted successfully' });
    } catch (err) {
      sendError(res, 'Failed to delete template', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/payout-automation/analyze
   */
  public static async analyzeMessage(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const parse = analyzeMessageSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Raw message text is required', 422, 'VALIDATION_ERROR');
      return;
    }

    try {
      const result = PayoutAutomationService.analyzeReferenceMessage(parse.data.rawMessage);

      await prisma.payoutAutomationLog.create({
        data: {
          eventType: 'FORMAT_EXTRACTED',
          status: 'SUCCESS',
          message: `Extracted structure from reference post: ${result.detectedHeading}`,
          details: { detectedHeading: result.detectedHeading, emojis: result.detectedEmojis },
          adminId: req.admin?.adminId,
        },
      });

      sendSuccess(res, result);
    } catch (err) {
      sendError(res, 'Failed to analyze reference message', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/payout-automation/preview
   */
  public static async previewMessage(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const {
        templateId,
        customTemplate,
        network = 'TRC20',
        amountUsdt = 10.0,
        amountPoops = 20000,
        walletAddress = 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv',
        txHash = '7d2a58b90c1f4e3d2a1b9c8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a',
        recipient = '@player_tom',
      } = req.body;

      let tmpl = customTemplate;
      if (!tmpl && templateId) {
        tmpl = await prisma.payoutMessageTemplate.findUnique({ where: { id: templateId } });
      }

      if (!tmpl) {
        tmpl = {
          heading: '✅ SuperTom Withdrawal Complete',
          successMessage: 'Payment verified and transferred on-chain!',
          footer: '🐱 Thank you for mining with SuperTom! Support: @SuperTomCare',
          currencyDisplay: 'USDT',
          showUsd: true,
          showPoops: true,
          showExplorerLink: true,
          maskUserAddress: true,
        };
      }

      const result = PayoutAutomationService.renderMessage({
        template: tmpl,
        network,
        amountUsdt,
        amountPoops,
        walletAddress,
        txHash,
        recipientIdentifier: recipient,
      });

      sendSuccess(res, result);
    } catch (err) {
      sendError(res, 'Failed to generate preview', 500, 'SERVER_ERROR');
    }
  }

  /**
   * GET /api/v1/admin/payout-automation/announcements
   */
  public static async listAnnouncements(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;
      const status = req.query.status as string | undefined;

      const where: any = {};
      if (status && ['PENDING_APPROVAL', 'PUBLISHED', 'FAILED', 'REJECTED'].includes(status)) {
        where.status = status;
      }

      const [total, announcements] = await Promise.all([
        prisma.payoutAnnouncement.count({ where }),
        prisma.payoutAnnouncement.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            withdrawal: {
              select: {
                id: true,
                walletAddress: true,
                amountUsdt: true,
                network: true,
                txHash: true,
                status: true,
                createdAt: true,
                user: {
                  select: {
                    id: true,
                    telegramId: true,
                    username: true,
                    firstName: true,
                  },
                },
              },
            },
            template: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      ]);

      sendSuccess(res, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        announcements: announcements.map((a) => ({
          id: a.id,
          withdrawalId: a.withdrawalId,
          userId: a.userId,
          network: a.network,
          currency: a.currency,
          amountCrypto: Number(a.amountCrypto),
          amountUsdt: Number(a.amountUsdt),
          amountPoops: a.amountPoops.toString(),
          walletAddress: a.walletAddress,
          txHash: a.txHash,
          explorerUrl: a.explorerUrl,
          recipientMasked: a.recipientMasked,
          renderedMessage: a.renderedMessage,
          telegramMessageId: a.telegramMessageId ? a.telegramMessageId.toString() : null,
          telegramChatId: a.telegramChatId,
          status: a.status,
          failureReason: a.failureReason,
          publishedAt: a.publishedAt,
          publishedBy: a.publishedBy,
          createdAt: a.createdAt,
          templateName: a.template?.name || 'Default',
          withdrawal: a.withdrawal,
        })),
      });
    } catch (err) {
      sendError(res, 'Failed to list announcements', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/payout-automation/announcements/:id/publish
   */
  public static async publishAnnouncement(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const operator = req.admin?.email || req.admin?.adminId || 'ADMIN';

    try {
      const result = await PayoutAutomationService.publishAnnouncement(id, operator);
      if (!result.success) {
        sendError(res, result.error || 'Failed to broadcast announcement to Telegram', 400, 'PUBLISH_FAILED');
        return;
      }

      sendSuccess(res, {
        message: 'Payout announcement published successfully to Telegram channel!',
        messageId: result.messageId,
      });
    } catch (err) {
      sendError(res, 'Failed to publish announcement', 500, 'SERVER_ERROR');
    }
  }

  /**
   * PUT /api/v1/admin/payout-automation/announcements/:id
   */
  public static async editAnnouncement(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const parse = editAnnouncementSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'Rendered message text is required', 422, 'VALIDATION_ERROR');
      return;
    }

    try {
      const announcement = await prisma.payoutAnnouncement.findUnique({ where: { id } });
      if (!announcement) {
        sendError(res, 'Announcement not found', 404, 'NOT_FOUND');
        return;
      }

      if (announcement.status === 'PUBLISHED') {
        sendError(res, 'Cannot edit an announcement that has already been published to Telegram', 400, 'ALREADY_PUBLISHED');
        return;
      }

      const updated = await prisma.payoutAnnouncement.update({
        where: { id },
        data: {
          renderedMessage: parse.data.renderedMessage.trim(),
        },
      });

      sendSuccess(res, { announcement: updated, message: 'Announcement message updated' });
    } catch (err) {
      sendError(res, 'Failed to update announcement', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/payout-automation/announcements/:id/reject
   */
  public static async rejectAnnouncement(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const reason = (req.body?.reason as string) || 'Rejected by Administrator';

    try {
      const announcement = await prisma.payoutAnnouncement.findUnique({ where: { id } });
      if (!announcement) {
        sendError(res, 'Announcement not found', 404, 'NOT_FOUND');
        return;
      }

      if (announcement.status === 'PUBLISHED') {
        sendError(res, 'Cannot reject an announcement that was already published', 400, 'ALREADY_PUBLISHED');
        return;
      }

      const updated = await prisma.payoutAnnouncement.update({
        where: { id },
        data: {
          status: 'REJECTED',
          failureReason: reason,
        },
      });

      await prisma.payoutAutomationLog.create({
        data: {
          eventType: 'ANNOUNCEMENT_REJECTED',
          status: 'WARNING',
          message: `Payout announcement ${id} rejected by admin: ${reason}`,
          adminId: req.admin?.adminId,
        },
      });

      sendSuccess(res, { announcement: updated, message: 'Announcement rejected' });
    } catch (err) {
      sendError(res, 'Failed to reject announcement', 500, 'SERVER_ERROR');
    }
  }

  /**
   * POST /api/v1/admin/payout-automation/test-send
   * Broadcasts a non-destructive sample verification payout message to the configured SuperTom channel.
   */
  public static async testSendAnnouncement(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const config = await PayoutAutomationService.getOrCreateConfig();
      const destinationChannel = config.destinationChatId || PayoutAutomationService.normalizeChannelId(config.destinationChannel);

      const template = config.activeTemplateId
        ? await prisma.payoutMessageTemplate.findUnique({ where: { id: config.activeTemplateId } })
        : await prisma.payoutMessageTemplate.findFirst({ where: { isDefault: true } });

      const tmpl = template || {
        heading: '✅ SuperTom Withdrawal Complete',
        successMessage: 'Payment verified and transferred on-chain!',
        footer: '🐱 Thank you for mining with SuperTom! 24/7 Support: @SuperTomCare',
        currencyDisplay: 'USDT',
        showUsd: true,
        showPoops: true,
        showExplorerLink: true,
        maskUserAddress: true,
      };

      const { message, explorerUrl } = PayoutAutomationService.renderMessage({
        template: tmpl,
        network: 'TRC20',
        amountUsdt: 10.0,
        amountPoops: 20000,
        walletAddress: 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv',
        txHash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
        recipientIdentifier: '@super_tester',
      });

      const broadcastText = `🧪 *[TEST BROADCAST - AUTOMATION VERIFICATION]*\n\n${message}`;

      const resTelegram = await PayoutAutomationService.broadcastToTelegram({
        channelId: destinationChannel,
        text: broadcastText,
        explorerUrl,
      });

      if (!resTelegram.ok) {
        sendError(res, resTelegram.error || 'Telegram rejected broadcast', 400, 'TEST_SEND_FAILED');
        return;
      }

      await prisma.payoutAutomationLog.create({
        data: {
          eventType: 'TEST_BROADCAST',
          status: 'SUCCESS',
          message: `Test broadcast sent to ${destinationChannel} (Msg ID: ${resTelegram.messageId})`,
          adminId: req.admin?.adminId,
        },
      });

      sendSuccess(res, {
        message: `Test announcement successfully broadcasted to ${destinationChannel}!`,
        messageId: resTelegram.messageId,
      });
    } catch (err) {
      sendError(res, 'Failed to send test announcement', 500, 'SERVER_ERROR');
    }
  }

  /**
   * GET /api/v1/admin/payout-automation/analytics
   */
  public static async getAnalytics(req: AuthenticatedAdminRequest, res: Response): Promise<void> {
    try {
      const [
        totalAnnouncements,
        publishedAnnouncements,
        pendingAnnouncements,
        failedAnnouncements,
        rejectedAnnouncements,
        logs,
      ] = await Promise.all([
        prisma.payoutAnnouncement.count(),
        prisma.payoutAnnouncement.count({ where: { status: 'PUBLISHED' } }),
        prisma.payoutAnnouncement.count({ where: { status: 'PENDING_APPROVAL' } }),
        prisma.payoutAnnouncement.count({ where: { status: 'FAILED' } }),
        prisma.payoutAnnouncement.count({ where: { status: 'REJECTED' } }),
        prisma.payoutAutomationLog.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const config = await PayoutAutomationService.getOrCreateConfig();

      sendSuccess(res, {
        stats: {
          totalAnnouncements,
          publishedAnnouncements,
          pendingAnnouncements,
          failedAnnouncements,
          rejectedAnnouncements,
          failedAttemptsCount: config.failedAttemptsCount,
          totalPublishedCount: config.totalPublishedCount,
          lastPublishedAt: config.lastPublishedAt,
          lastPublishedAmount: config.lastPublishedAmount ? Number(config.lastPublishedAmount) : null,
          lastPublishedTxHash: config.lastPublishedTxHash,
          automationEnabled: config.automationEnabled,
          publishingMode: config.publishingMode,
        },
        logs,
      });
    } catch (err) {
      sendError(res, 'Failed to fetch analytics', 500, 'SERVER_ERROR');
    }
  }
}

