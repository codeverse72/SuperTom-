import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { PayoutAutomationService } from '../payoutAutomation/payoutAutomationService.js';
import { ReferralService } from '../referrals/referralService.js';

interface TelegramUser {
  id: number | bigint;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export class TelegramBotController {
  /**
   * Escape special characters for Telegram HTML parse_mode
   */
  public static escapeHtml(input?: string | null): string {
    if (!input) return '';
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Resolve destination URL for the SuperTom Mini App
   */
  public static resolveMiniAppUrl(refCode?: string | null): string {
    const baseAppUrl = (env.FRONTEND_URL && env.FRONTEND_URL !== '*')
      ? env.FRONTEND_URL.split(',')[0].trim()
      : 'https://super-tom.vercel.app';

    if (refCode && refCode.trim().length > 0) {
      return `${baseAppUrl}?startapp=${encodeURIComponent(refCode.trim())}`;
    }
    return baseAppUrl;
  }

  /**
   * Resolve public Telegram link for SuperTom Payouts Channel
   */
  public static async resolvePayoutChannelUrl(): Promise<string> {
    try {
      const config = await prisma.payoutChannelConfig.findFirst();
      if (config?.destinationChannel) {
        const dest = config.destinationChannel.trim();
        if (dest.startsWith('https://t.me/') || dest.startsWith('http://t.me/')) {
          return dest;
        }
        if (dest.startsWith('@')) {
          return `https://t.me/${dest.slice(1)}`;
        }
        if (!dest.startsWith('-') && !dest.startsWith('+')) {
          return `https://t.me/${dest}`;
        }
      }
    } catch {
      // Fallback
    }
    return 'https://t.me/SuperrTomMining';
  }

  /**
   * Resolve Telegram Customer Support link
   */
  public static resolveSupportUrl(): string {
    const support = process.env.SUPPORT_TELEGRAM_USERNAME || 'SuperTomCare';
    const clean = support.startsWith('@') ? support.slice(1) : support;
    return `https://t.me/${clean}`;
  }

  /**
   * Ensure Webhook is registered with Telegram API on server boot
   */
  public static async ensureWebhookRegistered(): Promise<void> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') return;

    try {
      const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || 'https://supertom-backend.onrender.com';
      const webhookUrl = `${baseUrl.replace(/\/+$/, '')}/api/v1/bot/webhook`;
      const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const infoData: any = await infoRes.json();

      if (infoData.ok && infoData.result?.url === webhookUrl) {
        logger.info(`[TelegramBot] Webhook verified and active: ${webhookUrl}`);
        return;
      }

      logger.info(`[TelegramBot] Registering Telegram webhook: ${webhookUrl}...`);
      const setRes = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=false`
      );
      const setData: any = await setRes.json();
      if (setData.ok) {
        logger.info(`[TelegramBot] Webhook successfully set to ${webhookUrl}`);
      } else {
        logger.warn(`[TelegramBot] setWebhook returned:`, setData);
      }
    } catch (err) {
      logger.error(`[TelegramBot] Failed to verify/register webhook on startup:`, err);
    }
  }

  /**
   * Core Handler: Responds to Telegram /start command with dynamic user info & inline buttons
   */
  public static async handleStartCommand(params: {
    chatId: number | string;
    from: TelegramUser;
    text: string;
  }): Promise<{ ok: boolean; messageId?: number; error?: string }> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') {
      return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' };
    }

    const fromId = BigInt(params.from.id);
    const firstName = this.escapeHtml(params.from.first_name || 'Miner');
    const chatId = params.chatId.toString();

    // 1. Extract optional referral code from "/start <refCode>"
    const parts = params.text.trim().split(/\s+/);
    const rawRefCode = parts.length > 1 ? parts[1].trim().toUpperCase() : null;

    let validReferralCode: string | null = null;
    let referrerName: string | null = null;

    // 2. Check if user already exists in Supabase
    let user = await prisma.user.findUnique({
      where: { telegramId: fromId },
      include: { miningSettlement: true, spinState: true },
    });

    const isReturningUser = !!user;

    // If new user, create user record in Supabase immediately upon clicking Start
    if (!user) {
      const referralCode = `TOM${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      user = await prisma.user.create({
        data: {
          telegramId: fromId,
          username: params.from.username || `tom_${params.from.id}`,
          firstName: params.from.first_name,
          lastName: params.from.last_name,
          languageCode: params.from.language_code || 'en',
          poopsBalance: 0n,
          level: 1,
          levelTitle: 'Feline Cadet',
          referralCode,
        },
        include: { miningSettlement: true, spinState: true },
      });

      // Initialize default mining engine for new player (10 Poops/hr base)
      await prisma.miningSettlement.create({
        data: {
          userId: user.id,
          baseRatePerHour: 10,
          boostRatePerHour: 0,
          totalRatePerHour: 10,
          unclaimedPoops: 0n,
          lastSettledAt: new Date(),
        },
      });

      // Initialize progressive lucky spin state (starts at milestone 1, 2-hour cooldown)
      await prisma.spinState.create({
        data: {
          userId: user.id,
          currentMilestone: 1,
          cycleCount: 1,
          nextUnlockAt: new Date(Date.now() + 2 * 3600 * 1000),
          claimedMilestones: '[]',
        },
      });

      logger.info(`[TelegramBot] New user registered via Telegram /start: ID ${user.id}, TG ${fromId}`);
    }

    // 3. Referral handling: immediately credit Referrer when referent opens the bot
    if (rawRefCode && !user.referredById) {
      try {
        const referrer = await prisma.user.findUnique({
          where: { referralCode: rawRefCode },
          select: { id: true, telegramId: true, username: true, firstName: true },
        });

        if (referrer && referrer.telegramId !== fromId) {
          validReferralCode = rawRefCode;
          referrerName = referrer.firstName || (referrer.username ? `@${referrer.username}` : 'a fellow feline miner');

          // Immediately credit Referrer with +2,000 Poops and update in Supabase!
          await ReferralService.attributeAndCreditReferral({
            referrerId: referrer.id,
            refereeId: user.id,
            refereeName: params.from.first_name || (params.from.username ? `@${params.from.username}` : `Miner ${fromId}`),
            refereeTelegramId: fromId,
          });

          logger.info(`[TelegramBot] Referrer ${referrer.id} immediately credited +2,000 Poops for referee ${user.id} opening bot via /start!`);
        }
      } catch (refErr) {
        logger.warn('[TelegramBot] Referral lookup failed:', refErr);
      }
    }

    // 4. Update profile details for existing users if changed on Telegram (without resetting balances/progress)
    if (isReturningUser && user) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            username: params.from.username || user.username,
            firstName: params.from.first_name || user.firstName,
            lastName: params.from.last_name || user.lastName,
          },
        });
      } catch {
        // Non-blocking profile update
      }
    }

    // 5. Build dynamic personalized welcome message with Telegram HTML formatting
    const welcomeHtmlLines: string[] = [
      `🐱 <b>WELCOME TO SUPERTOM!</b>`,
      ``,
    ];

    if (isReturningUser) {
      welcomeHtmlLines.push(`👋 Welcome back, <b>${firstName}</b>! 👑`);
      welcomeHtmlLines.push(`🎉 <i>Your mining empire is active and generating rewards!</i>`);
      welcomeHtmlLines.push(``);
      welcomeHtmlLines.push(`💎 <b>Feed Tom with biscuits</b>, increase your mining rate, complete missions and collect rewards.`);
    } else {
      welcomeHtmlLines.push(`👋 Welcome, <b>${firstName}</b>!`);
      welcomeHtmlLines.push(`🎉 <i>Your journey to earning Poops starts here!</i>`);
      if (validReferralCode && referrerName) {
        welcomeHtmlLines.push(``);
        welcomeHtmlLines.push(`👑 <i>Invited by ${this.escapeHtml(referrerName)}! Your starter bonus is ready to claim.</i>`);
      }
      welcomeHtmlLines.push(``);
      welcomeHtmlLines.push(`💎 <b>Feed Tom with biscuits</b>, increase your mining rate, complete missions and collect rewards.`);
    }

    welcomeHtmlLines.push(``);
    welcomeHtmlLines.push(`<b>🚀 WHAT YOU CAN DO:</b>`);
    welcomeHtmlLines.push(``);
    welcomeHtmlLines.push(`🍪 <b>Feed Tom</b> — Increase your Poop production.`);
    welcomeHtmlLines.push(`🎡 <b>Spin &amp; Earn</b> — Unlock exciting spin rewards.`);
    welcomeHtmlLines.push(`🏆 <b>Missions</b> — Complete tasks and earn Poops.`);
    welcomeHtmlLines.push(`💰 <b>Payouts</b> — Request withdrawals according to the platform's rules.`);
    welcomeHtmlLines.push(`👥 <b>Referrals</b> — Invite friends and grow your rewards.`);
    welcomeHtmlLines.push(``);
    welcomeHtmlLines.push(isReturningUser
      ? `👇 <b>Tap "Open SuperTom" below to resume mining!</b>`
      : `👇 <b>Tap "Open SuperTom" below to start mining!</b>`
    );

    const messageText = welcomeHtmlLines.join('\n');

    // 6. Build interactive inline buttons (Row 1: Mini App, Row 2: Payout Channel + Support)
    const miniAppUrl = this.resolveMiniAppUrl(validReferralCode);
    const payoutChannelUrl = await this.resolvePayoutChannelUrl();
    const supportUrl = this.resolveSupportUrl();

    const inlineKeyboard = [
      [
        {
          text: '🚀 Open SuperTom',
          web_app: { url: miniAppUrl },
        },
      ],
      [
        {
          text: '💰 Payout Channel',
          url: payoutChannelUrl,
        },
        {
          text: '🆘 Support',
          url: supportUrl,
        },
      ],
    ];

    // 7. Dispatch message via Telegram Bot API
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        }),
      });

      const data: any = await res.json();

      if (!data.ok) {
        // Fallback: Retry with plain text stripped of HTML tags
        logger.warn('[TelegramBot] HTML sendMessage failed, retrying plain text:', data.description);
        const fallbackRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: messageText.replace(/<[^>]+>/g, ''),
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: inlineKeyboard,
            },
          }),
        });
        const fallbackData: any = await fallbackRes.json();
        if (!fallbackData.ok) {
          logger.error('[TelegramBot] Fallback sendMessage also failed:', fallbackData);
          return { ok: false, error: fallbackData.description || 'Failed to deliver message' };
        }
        return { ok: true, messageId: fallbackData.result?.message_id };
      }

      logger.info(`[TelegramBot] Sent welcome message to TG user ${fromId} (${firstName})`);
      return { ok: true, messageId: data.result?.message_id };
    } catch (err: unknown) {
      logger.error('[TelegramBot] Network error delivering welcome message:', err);
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  /**
   * POST /api/v1/bot/webhook
   * Receives incoming Telegram webhook updates (/start commands, channel posts, etc.)
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

      // 2. Handle Direct Player Messages (/start, commands)
      const message = req.body?.message;
      if (!message || !message.text || !message.chat?.id || !message.from?.id) {
        return;
      }

      const text = message.text.trim();

      // Handle /start commands (e.g. "/start", "/start TOM12345")
      if (text.startsWith('/start')) {
        await TelegramBotController.handleStartCommand({
          chatId: message.chat.id,
          from: message.from,
          text,
        });
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
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=false`
      );
      const data = await tgRes.json();
      sendSuccess(res, { webhookUrl, telegramResponse: data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register webhook';
      sendError(res, msg, 500, 'WEBHOOK_SETUP_ERROR');
    }
  }
}
