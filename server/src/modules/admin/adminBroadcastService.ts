import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { TelegramBotController } from '../telegramBot/telegramBotController.js';

export type BroadcastAudienceSegment =
  | 'all_active'
  | 'inactive_24h'
  | 'inactive_72h'
  | 'inactive_7d'
  | 'low_balance';

export interface BroadcastTemplate {
  id: string;
  name: string;
  category: 'wake-up' | 'engagement' | 'quests' | 'growth' | 'announcement';
  badge: string;
  defaultAudience: BroadcastAudienceSegment;
  ctaText: string;
  includeSecondaryButtons: boolean;
  message: string;
}

export const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  {
    id: 'wakeup_mining_vault',
    name: 'Mining Vault Wake-Up (24h+)',
    category: 'wake-up',
    badge: 'Wake-Up',
    defaultAudience: 'inactive_24h',
    ctaText: '🚀 Wake Up & Mine',
    includeSecondaryButtons: false,
    message: [
      '🐱 <b>Hey {firstName}, King Tom misses you!</b>',
      '',
      '⏰ Your mining vault has been waiting — jump back in to settle your 💩 Poops and keep your hourly rate flowing!',
      '',
      '🍪 Feed Tom a biscuit, collect your earnings, and claim your daily streak before the day resets.',
      '',
      '👇 <b>Tap below to resume mining now!</b>',
    ].join('\n'),
  },
  {
    id: 'wakeup_lucky_spin',
    name: 'Free Lucky Wheel Reminder',
    category: 'engagement',
    badge: 'Spin Ready',
    defaultAudience: 'inactive_72h',
    ctaText: '🎡 Spin Lucky Wheel',
    includeSecondaryButtons: false,
    message: [
      '🎡 <b>Your Lucky Wheel Awaits, {firstName}!</b>',
      '',
      '💎 Players are winning bonus Poops and biscuits across the 2h / 4h / 8h milestone cycles.',
      '',
      '🔥 Your current balance is <b>{balance} Poops</b> — come spin the wheel and climb toward your next payout!',
    ].join('\n'),
  },
  {
    id: 'wakeup_daily_quests',
    name: 'Daily Quests & Watch Ads (+500 Poops)',
    category: 'quests',
    badge: 'Daily Bounty',
    defaultAudience: 'all_active',
    ctaText: '🎯 Open Daily Quests',
    includeSecondaryButtons: false,
    message: [
      '🏆 <b>Daily Missions Reset at 00:00 UTC, {firstName}!</b>',
      '',
      '📺 Watch sponsored ads and complete daily quests to grab extra <b>Poops</b> today.',
      '',
      '💰 Every Poop brings you closer to USDT &amp; TON withdrawals!',
    ].join('\n'),
  },
  {
    id: 'wakeup_referral_push',
    name: 'Invite Friends (+450 Poops / Invite)',
    category: 'growth',
    badge: 'Referrals',
    defaultAudience: 'all_active',
    ctaText: '👥 Invite & Earn +450',
    includeSecondaryButtons: false,
    message: [
      '👑 <b>Earn +450 Poops Per Friend, {firstName}!</b>',
      '',
      '🔗 Share your personal invite code <code>{referralCode}</code> with friends on Telegram.',
      '',
      '🎁 Every friend who opens SuperTom unlocks <b>+450 Poops</b> for you plus ongoing biscuit commissions!',
    ].join('\n'),
  },
  {
    id: 'wakeup_sleepers_7d',
    name: '7-Day Sleeper Comeback Alert',
    category: 'wake-up',
    badge: 'Win-Back',
    defaultAudience: 'inactive_7d',
    ctaText: '👑 Return to Kingdom',
    includeSecondaryButtons: true,
    message: [
      '🐾 <b>We Saved Your Royal Throne, {firstName}!</b>',
      '',
      '✨ SuperTom has fresh daily missions, Lucky Wheel prizes, and live USDT / TON payout options waiting for you.',
      '',
      '🍪 Pop in for 10 seconds to wake up King Tom and stack more Poops today!',
    ].join('\n'),
  },
  {
    id: 'announcement_payouts_live',
    name: 'Live Payouts & Activity Boost',
    category: 'announcement',
    badge: 'Announcement',
    defaultAudience: 'all_active',
    ctaText: '💰 Open SuperTom',
    includeSecondaryButtons: true,
    message: [
      '💎 <b>SuperTom Updates Are Live!</b>',
      '',
      '🚀 Miners across the kingdom are feeding Tom, clearing quests, and cashing out Poops into USDT / TON rewards.',
      '',
      '🐱 Jump back in now and grow your stack beyond <b>{balance} Poops</b>!',
    ].join('\n'),
  },
];

export interface BroadcastUserContext {
  firstName?: string | null;
  username?: string | null;
  poopsBalance?: bigint | number | null;
  referralCode?: string | null;
}

export function renderBroadcastMessage(template: string, user: BroadcastUserContext): string {
  const safeName = TelegramBotController.escapeHtml(
    user.firstName?.trim() || (user.username ? `@${user.username}` : 'Miner')
  );
  const safeUsername = TelegramBotController.escapeHtml(
    user.username ? `@${user.username.replace(/^@/, '')}` : 'SuperTomPlayer'
  );
  const safeBalance = TelegramBotController.escapeHtml(
    Number(user.poopsBalance ?? 0).toLocaleString('en-US')
  );
  const safeRefCode = TelegramBotController.escapeHtml(user.referralCode || 'TOMVIP');

  return template
    .replace(/\{firstName\}/g, safeName)
    .replace(/\{username\}/g, safeUsername)
    .replace(/\{balance\}/g, safeBalance)
    .replace(/\{referralCode\}/g, safeRefCode);
}

export function stripTelegramHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

export function buildAudienceWhereClause(segment: BroadcastAudienceSegment, now: Date = new Date()) {
  const baseWhere = { accountStatus: 'ACTIVE' as const };
  switch (segment) {
    case 'inactive_24h':
      return { ...baseWhere, updatedAt: { lt: new Date(now.getTime() - 24 * 3600 * 1000) } };
    case 'inactive_72h':
      return { ...baseWhere, updatedAt: { lt: new Date(now.getTime() - 72 * 3600 * 1000) } };
    case 'inactive_7d':
      return { ...baseWhere, updatedAt: { lt: new Date(now.getTime() - 7 * 24 * 3600 * 1000) } };
    case 'low_balance':
      return { ...baseWhere, poopsBalance: { lt: 1000n } };
    case 'all_active':
    default:
      return baseWhere;
  }
}

export interface BroadcastJobState {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  audience: BroadcastAudienceSegment;
  templateId?: string | null;
  totalTargets: number;
  processed: number;
  sentCount: number;
  failedCount: number;
  blockedCount: number;
  startedAt: string;
  finishedAt?: string;
  adminId: string;
  adminEmail?: string;
  cancelRequested: boolean;
  lastError?: string;
}

const activeJobs = new Map<string, BroadcastJobState>();
const MAX_STORED_JOBS = 25;

function pruneOldJobs() {
  if (activeJobs.size <= MAX_STORED_JOBS) return;
  const entries = Array.from(activeJobs.entries()).filter(([, j]) => j.status !== 'RUNNING');
  for (const [key] of entries.slice(0, activeJobs.size - MAX_STORED_JOBS)) {
    activeJobs.delete(key);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AdminBroadcastService {
  public static getTemplates(): BroadcastTemplate[] {
    return BROADCAST_TEMPLATES;
  }

  public static async getAudienceCounts(now: Date = new Date()) {
    const [allActive, inactive24h, inactive72h, inactive7d, lowBalance] = await Promise.all([
      prisma.user.count({ where: buildAudienceWhereClause('all_active', now) }),
      prisma.user.count({ where: buildAudienceWhereClause('inactive_24h', now) }),
      prisma.user.count({ where: buildAudienceWhereClause('inactive_72h', now) }),
      prisma.user.count({ where: buildAudienceWhereClause('inactive_7d', now) }),
      prisma.user.count({ where: buildAudienceWhereClause('low_balance', now) }),
    ]);

    return {
      all_active: allActive,
      inactive_24h: inactive24h,
      inactive_72h: inactive72h,
      inactive_7d: inactive7d,
      low_balance: lowBalance,
    };
  }

  public static async buildReplyMarkup(options: {
    includeMiniAppButton: boolean;
    ctaText?: string;
    includeSecondaryButtons?: boolean;
  }) {
    const keyboard: Array<Array<{ text: string; web_app?: { url: string }; url?: string }>> = [];

    if (options.includeMiniAppButton) {
      keyboard.push([
        {
          text: options.ctaText?.trim() || '🚀 Open SuperTom',
          web_app: { url: TelegramBotController.resolveMiniAppUrl() },
        },
      ]);
    }

    if (options.includeSecondaryButtons) {
      const [payoutUrl, supportUrl] = await Promise.all([
        TelegramBotController.resolvePayoutChannelUrl(),
        Promise.resolve(TelegramBotController.resolveSupportUrl()),
      ]);
      keyboard.push([
        { text: '💰 Payout Channel', url: payoutUrl },
        { text: '🆘 Support', url: supportUrl },
      ]);
    }

    return keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;
  }

  public static async sendTelegramMessage(params: {
    chatId: string;
    htmlText: string;
    replyMarkup?: unknown;
  }): Promise<{ ok: boolean; blocked?: boolean; error?: string }> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') {
      return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' };
    }

    const sendPayload = async (body: Record<string, unknown>) => {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return (await res.json()) as {
        ok?: boolean;
        error_code?: number;
        description?: string;
        parameters?: { retry_after?: number };
      };
    };

    try {
      let data = await sendPayload({
        chat_id: params.chatId,
        text: params.htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
      });

      // Handle Telegram rate limit (429 retry_after)
      if (!data.ok && data.error_code === 429) {
        const retrySec = Math.min(30, Math.max(1, data.parameters?.retry_after ?? 2));
        await sleep(retrySec * 1000);
        data = await sendPayload({
          chat_id: params.chatId,
          text: params.htmlText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
        });
      }

      // Retry without HTML formatting if admin used unsupported HTML tags
      if (!data.ok && data.error_code === 400 && data.description?.toLowerCase().includes('parse entities')) {
        data = await sendPayload({
          chat_id: params.chatId,
          text: stripTelegramHtml(params.htmlText),
          disable_web_page_preview: true,
          ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
        });
      }

      if (data.ok) {
        return { ok: true };
      }

      const desc = data.description || 'Unknown Telegram error';
      const isBlocked =
        data.error_code === 403 ||
        desc.toLowerCase().includes('blocked') ||
        desc.toLowerCase().includes('deactivated') ||
        desc.toLowerCase().includes('chat not found');

      return { ok: false, blocked: isBlocked, error: desc };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Network error sending Telegram message',
      };
    }
  }

  public static getRunningJob(): BroadcastJobState | null {
    for (const job of activeJobs.values()) {
      if (job.status === 'RUNNING') return job;
    }
    return null;
  }

  public static getJob(jobId: string): BroadcastJobState | null {
    return activeJobs.get(jobId) ?? null;
  }

  public static listRecentJobs(): BroadcastJobState[] {
    return Array.from(activeJobs.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 10);
  }

  public static cancelJob(jobId: string): BroadcastJobState | null {
    const job = activeJobs.get(jobId);
    if (!job || job.status !== 'RUNNING') return null;
    job.cancelRequested = true;
    return job;
  }

  public static async startBroadcastJob(params: {
    audience: BroadcastAudienceSegment;
    message: string;
    templateId?: string | null;
    includeMiniAppButton: boolean;
    ctaText?: string;
    includeSecondaryButtons?: boolean;
    adminId: string;
    adminEmail?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<BroadcastJobState> {
    const where = buildAudienceWhereClause(params.audience);
    const recipients = await prisma.user.findMany({
      where,
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        username: true,
        poopsBalance: true,
        referralCode: true,
      },
      orderBy: { updatedAt: 'asc' },
    });

    const jobId = `bc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: BroadcastJobState = {
      id: jobId,
      status: 'RUNNING',
      audience: params.audience,
      templateId: params.templateId ?? null,
      totalTargets: recipients.length,
      processed: 0,
      sentCount: 0,
      failedCount: 0,
      blockedCount: 0,
      startedAt: new Date().toISOString(),
      adminId: params.adminId,
      adminEmail: params.adminEmail,
      cancelRequested: false,
    };

    activeJobs.set(jobId, job);
    pruneOldJobs();

    // Execute dispatch asynchronously so HTTP request returns immediately
    void (async () => {
      try {
        const replyMarkup = await this.buildReplyMarkup({
          includeMiniAppButton: params.includeMiniAppButton,
          ctaText: params.ctaText,
          includeSecondaryButtons: params.includeSecondaryButtons,
        });

        const BATCH_SIZE = 20; // ~20 msg/sec, safely within Telegram 30 msg/sec limit
        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
          if (job.cancelRequested) {
            job.status = 'CANCELLED';
            break;
          }

          const batch = recipients.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (user) => {
              if (job.cancelRequested) return;
              const rendered = renderBroadcastMessage(params.message, user);
              const result = await this.sendTelegramMessage({
                chatId: user.telegramId.toString(),
                htmlText: rendered,
                replyMarkup,
              });

              job.processed += 1;
              if (result.ok) {
                job.sentCount += 1;
              } else {
                job.failedCount += 1;
                if (result.blocked) job.blockedCount += 1;
                if (result.error) job.lastError = result.error;
              }
            })
          );

          if (i + BATCH_SIZE < recipients.length && !job.cancelRequested) {
            await sleep(1050);
          }
        }

        if (job.status === 'RUNNING') {
          job.status = job.cancelRequested ? 'CANCELLED' : 'COMPLETED';
        }
      } catch (err: unknown) {
        job.status = 'FAILED';
        job.lastError = err instanceof Error ? err.message : 'Broadcast job crashed';
        logger.error(`[Broadcast] Job ${job.id} failed:`, err);
      } finally {
        job.finishedAt = new Date().toISOString();

        try {
          await prisma.adminAuditLog.create({
            data: {
              adminId: params.adminId,
              action: job.status === 'CANCELLED' ? 'BROADCAST_CANCELLED' : 'BROADCAST_SENT',
              targetEntity: 'TELEGRAM_BROADCAST',
              targetId: job.id,
              newValue: JSON.stringify({
                audience: params.audience,
                templateId: params.templateId || 'custom',
                totalTargets: job.totalTargets,
                sentCount: job.sentCount,
                failedCount: job.failedCount,
                blockedCount: job.blockedCount,
                status: job.status,
                messagePreview: params.message.slice(0, 180),
              }),
              ipAddress: params.ipAddress ?? null,
              userAgent: params.userAgent ?? null,
            },
          });
        } catch (auditErr) {
          logger.warn('[Broadcast] Failed to write AdminAuditLog:', auditErr);
        }
      }
    })();

    return job;
  }
}

