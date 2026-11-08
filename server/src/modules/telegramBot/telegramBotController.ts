import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { PayoutAutomationService } from '../payoutAutomation/payoutAutomationService.js';

export class TelegramBotController {
  /**
   * POST /api/v1/bot/webhook
   * Receives incoming Telegram webhook updates (e.g. /start commands, channel posts).
   */
  public static async handleWebhook(req: Request, res: Response): Promise<void> {
    // Acknowledge Telegram immediately to prevent timeout retries
    res.status(200).json({ ok: true });

    try {
      // 1. Handle Channel Post updates (for reference payout channel monitoring)
      const channelPost = req.body?.channel_post;
      if (channelPost && channelPost.text && channelPost.chat) {
        try {
          const config = await prisma.payoutChannelConfig.findFirst();
          if (config && config.referenceChannel) {
            const ref = PayoutAutomationService.normalizeChannelId(config.referenceChannel).toLowerCase();
            const chatUsername = channelPost.chat.username ? `@${channelPost.chat.username}`.toLowerCase() : '';
            const chatId = channelPost.chat.id.toString();

            if (chatUsername === ref || chatId === ref || config.referenceChannel.includes(chatId)) {
              const extracted = PayoutAutomationService.analyzeReferenceMessage(channelPost.text);
              await prisma.payoutAutomationLog.create({
                data: {
                  eventType: 'FORMAT_EXTRACTED',
                  status: 'SUCCESS',
                  message: `Auto-detected reference post in ${ref}: "${extracted.detectedHeading}"`,
                  details: {
                    channelId: chatId,
                    heading: extracted.detectedHeading,
                    emojis: extracted.detectedEmojis,
                    currency: extracted.detectedCurrency,
                    amount: extracted.detectedAmount,
                  },
                },
              });
              await prisma.payoutChannelConfig.update({
                where: { id: config.id },
                data: {
                  lastSyncAt: new Date(),
                  referenceStatus: 'CONNECTED',
                },
              });
              logger.info(`[TelegramBot] Processed reference channel post from ${ref}`);
            }
          }
        } catch (postErr) {
          logger.error('[TelegramBot] Failed to process channel_post update:', postErr);
        }
      }

      // 2. Handle Direct Player Messages (/start, referrals, etc.)
      const message = req.body?.message;
      if (!message || !message.text || !message.chat?.id || !message.from?.id) {
        return;
      }

      const text = message.text.trim();
      const chatId = message.chat.id;
      const fromId = BigInt(message.from.id);

      // Handle /start commands (e.g., "/start" or "/start TOM12345")
      if (text.startsWith('/start')) {
        const parts = text.split(/\s+/);
        const refCode = parts[1]?.trim().toUpperCase();

        let isValidReferral = false;
        if (refCode) {
          // Check if referral code belongs to a valid player (and not self)
          const referrer = await prisma.user.findUnique({
            where: { referralCode: refCode },
            select: { id: true, telegramId: true, username: true },
          });

          if (referrer && referrer.telegramId !== fromId) {
            isValidReferral = true;
            // Record pending referral attribution.
            // NOTE: No reward is given yet! Reward is ONLY awarded when the user actually opens the bot.
            await prisma.pendingReferral.upsert({
              where: { telegramId: fromId },
              create: {
                telegramId: fromId,
                referralCode: refCode,
              },
              update: {
                referralCode: refCode,
              },
            });
            logger.info(`[TelegramBot] Pending referral stored for TG ${fromId} -> Code ${refCode}`);
          }
        }

        const appUrl = (env.FRONTEND_URL && env.FRONTEND_URL !== '*')
          ? env.FRONTEND_URL.split(',')[0].trim()
          : 'https://super-tom.vercel.app';

        const directAppUrl = refCode && isValidReferral
          ? `${appUrl}?startapp=${encodeURIComponent(refCode)}`
          : appUrl;

        const welcomeText = isValidReferral
          ? `👑 *Welcome to SuperTom!* 🐱\n\n🎉 *You were invited by a fellow feline!* Tap below to open SuperTom, activate your starter bonus, and begin mining with King Tom! 🚀`
          : `👑 *Welcome to SuperTom Mining Game!* 🐱\n\nStart your royal feline journey: mine Poops, spin the Lucky Wheel, and earn USDT rewards!\n\nTap below to play:`;

        if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN !== 'TEST_BOT_TOKEN_PLACEHOLDER') {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: welcomeText,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🚀 Open SuperTom',
                      web_app: { url: directAppUrl },
                    },
                  ],
                ],
              },
            }),
          }).catch((err) => {
            logger.error('[TelegramBot] Failed to send Telegram welcome message:', err);
          });
        }
      }
    } catch (err) {
      logger.error('[TelegramBot] Error processing webhook update:', err);
    }
  }

  /**
   * POST /api/v1/bot/set-webhook
   * Registers this server's webhook URL with Telegram.
   */
  public static async setWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookUrl = req.body?.webhookUrl || `${req.protocol}://${req.get('host')}/api/v1/bot/webhook`;
      
      if (!env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN === 'TEST_BOT_TOKEN_PLACEHOLDER') {
        sendError(res, 'TELEGRAM_BOT_TOKEN not configured', 400, 'BOT_TOKEN_MISSING');
        return;
      }

      const tgRes = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
      );
      const data = await tgRes.json();
      sendSuccess(res, { webhookUrl, telegramResponse: data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register webhook';
      sendError(res, msg, 500, 'WEBHOOK_SETUP_ERROR');
    }
  }
}

