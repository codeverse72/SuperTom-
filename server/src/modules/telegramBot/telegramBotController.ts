import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { PayoutAutomationService } from '../payoutAutomation/payoutAutomationService.js';
import { ReferralService } from '../referrals/referralService.js';

export type BotLanguage = 'en' | 'fa' | 'ru' | 'fr';

export interface BotTranslation {
  langName: string;
  flag: string;
  langSwitchedAlert: string;
  welcomeTitle: string;
  welcomeBackHeading: string;
  newWelcomeHeading: string;
  miningActive: string;
  feedTomIntro: string;
  invitedBy: string;
  whatYouCanDo: string;
  featureFeed: string;
  featureSpin: string;
  featureMissions: string;
  featurePayouts: string;
  featureReferrals: string;
  startMiningCta: string;
  btnOpenApp: string;
  btnPayoutChannel: string;
  btnSupport: string;
  btnChangeLang: string;
  btnWatchAds: string;
}

export const BOT_TRANSLATIONS: Record<BotLanguage, BotTranslation> = {
  en: {
    langName: 'English',
    flag: '🇬🇧',
    langSwitchedAlert: 'Language set to English! 🇬🇧',
    welcomeTitle: '🐱 <b>WELCOME TO SUPERTOM!</b>',
    welcomeBackHeading: '👋 Welcome back, <b>{name}</b>! 👑',
    newWelcomeHeading: '👋 Welcome, <b>{name}</b>!',
    miningActive: '🎉 <i>Your mining empire is active and generating rewards!</i>',
    feedTomIntro: '💎 <b>Feed Tom with biscuits</b>, increase your mining rate, complete missions and collect rewards.',
    invitedBy: '👑 <i>Invited by {referrer}! Your starter bonus is ready to claim.</i>',
    whatYouCanDo: '<b>🚀 WHAT YOU CAN DO:</b>',
    featureFeed: '🍪 <b>Feed Tom</b> — Increase your TomCoin production.',
    featureSpin: '🎡 <b>Spin &amp; Earn</b> — Unlock exciting spin rewards.',
    featureMissions: '🏆 <b>Missions</b> — Complete tasks and earn TomCoins.',
    featurePayouts: '💰 <b>Payouts</b> — Request withdrawals according to the platform\'s rules.',
    featureReferrals: '👥 <b>Referrals</b> — Invite friends and grow your rewards.',
    startMiningCta: '👇 <b>Tap "Open SuperTom" below to start mining!</b>',
    btnOpenApp: '🚀 Open SuperTom',
    btnPayoutChannel: '💰 Payout Channel',
    btnSupport: '🆘 Support',
    btnChangeLang: '🌐 Change Language',
    btnWatchAds: '🎬 Watch Ads & Earn Free TomCoins',
  },
  fa: {
    langName: 'فارسی',
    flag: '🇮🇷',
    langSwitchedAlert: 'زبان با موفقیت به فارسی تغییر یافت! 🇮🇷',
    welcomeTitle: '🐱 <b>به سوپرتام خوش آمدید!</b>',
    welcomeBackHeading: '👋 خوش آمدید، <b>{name}</b> عزیز! 👑',
    newWelcomeHeading: '👋 خوش آمدید، <b>{name}</b> عزیز!',
    miningActive: '🎉 <i>امپراتوری استخراج شما فعال است و در حال تولید پاداش می‌باشد!</i>',
    feedTomIntro: '💎 <b>به تام بیسکویت بدهید</b>، سرعت استخراج خود را افزایش دهید، ماموریت‌ها را تکمیل کنید و پاداش جمع‌آوری نمایید.',
    invitedBy: '👑 <i>توسط {referrer} دعوت شده‌اید! پاداش اولیه شما آماده دریافت است.</i>',
    whatYouCanDo: '<b>🚀 کارهایی که می‌توانید انجام دهید:</b>',
    featureFeed: '🍪 <b>غذا دادن به تام</b> — افزایش تولید تام‌کوین.',
    featureSpin: '🎡 <b>گردونه شانس</b> — برنده شدن جوایز هیجان‌انگیز روزانه.',
    featureMissions: '🏆 <b>ماموریت‌ها</b> — انجام تسک‌ها و کسب تام‌کوین رایگان.',
    featurePayouts: '💰 <b>برداشت و جوایز</b> — دریافت آنی ارز دیجیتال طبق قوانین پلتفرم.',
    featureReferrals: '👥 <b>معرفی دوستان</b> — دعوت از دوستان و دریافت پاداش‌های شگفت‌انگیز.',
    startMiningCta: '👇 <b>برای شروع استخراج، دکمه "ورود به سوپرتام" را در پایین لمس کنید!</b>',
    btnOpenApp: '🚀 ورود به سوپرتام',
    btnPayoutChannel: '💰 کانال پرداخت‌ها',
    btnSupport: '🆘 پشتیبانی ۲۴/۷',
    btnChangeLang: '🌐 تغییر زبان',
    btnWatchAds: '🎬 تماشای تبلیغ و دریافت پاداش',
  },
  ru: {
    langName: 'Русский',
    flag: '🇷🇺',
    langSwitchedAlert: 'Язык успешно изменен на русский! 🇷🇺',
    welcomeTitle: '🐱 <b>ДОБРО ПОЖАЛОВАТЬ В SUPERTOM!</b>',
    welcomeBackHeading: '👋 С возвращением, <b>{name}</b>! 👑',
    newWelcomeHeading: '👋 Добро пожаловать, <b>{name}</b>!',
    miningActive: '🎉 <i>Ваша империя майнинга активна и приносит награды!</i>',
    feedTomIntro: '💎 <b>Кормите Тома печеньем</b>, увеличивайте скорость майнинга, выполняйте задания и собирайте награды.',
    invitedBy: '👑 <i>Вас пригласил {referrer}! Приветственный бонус готов к получению.</i>',
    whatYouCanDo: '<b>🚀 ЧТО ВЫ МОЖЕТЕ ДЕЛАТЬ:</b>',
    featureFeed: '🍪 <b>Кормить Тома</b> — Увеличивайте добычу TomCoins.',
    featureSpin: '🎡 <b>Колесо Фортуны</b> — Выигрывайте ежедневные ценные награды.',
    featureMissions: '🏆 <b>Миссии</b> — Выполняйте задания и получайте TomCoins.',
    featurePayouts: '💰 <b>Выплаты</b> — Запрашивайте вывод криптовалюты.',
    featureReferrals: '👥 <b>Рефералы</b> — Приглашайте друзей и увеличивайте прибыль.',
    startMiningCta: '👇 <b>Нажмите «Открыть SuperTom» ниже, чтобы начать майнинг!</b>',
    btnOpenApp: '🚀 Открыть SuperTom',
    btnPayoutChannel: '💰 Канал выплат',
    btnSupport: '🆘 Поддержка',
    btnChangeLang: '🌐 Сменить язык',
    btnWatchAds: '🎬 Смотреть рекламу и зарабатывать',
  },
  fr: {
    langName: 'Français',
    flag: '🇫🇷',
    langSwitchedAlert: 'Langue définie sur le français ! 🇫🇷',
    welcomeTitle: '🐱 <b>BIENVENUE SUR SUPERTOM !</b>',
    welcomeBackHeading: '👋 Bon retour parmi nous, <b>{name}</b> ! 👑',
    newWelcomeHeading: '👋 Bienvenue, <b>{name}</b> !',
    miningActive: '🎉 <i>Votre empire de minage est actif et génère des récompenses !</i>',
    feedTomIntro: '💎 <b>Nourrissez Tom avec des biscuits</b>, augmentez votre taux de minage, accomplissez des missions et récoltez des gains.',
    invitedBy: '👑 <i>Invité par {referrer} ! Votre bonus de bienvenue est prêt.</i>',
    whatYouCanDo: '<b>🚀 CE QUE VOUS POUVEZ FAIRE :</b>',
    featureFeed: '🍪 <b>Nourrir Tom</b> — Boostez votre production de TomCoins.',
    featureSpin: '🎡 <b>Roue de la Fortune</b> — Débloquez des récompenses exclusives.',
    featureMissions: '🏆 <b>Missions</b> — Remplissez des objectifs et gagnez des TomCoins.',
    featurePayouts: '💰 <b>Retraits</b> — Demandez des retraits en crypto.',
    featureReferrals: '👥 <b>Parrainage</b> — Invitez vos amis et démultipliez vos gains.',
    startMiningCta: '👇 <b>Appuyez sur « Ouvrir SuperTom » ci-dessous pour miner !</b>',
    btnOpenApp: '🚀 Ouvrir SuperTom',
    btnPayoutChannel: '💰 Canal des Retraits',
    btnSupport: '🆘 Support 24/7',
    btnChangeLang: '🌐 Changer de langue',
    btnWatchAds: '🎬 Regarder des pubs & Gagner des TomCoins',
  },
};

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
   * Resolve destination URL for the SuperTom Mini App with language parameter
   */
  public static resolveMiniAppUrl(refCode?: string | null, lang: string = 'en'): string {
    const baseAppUrl = (env.FRONTEND_URL && env.FRONTEND_URL !== '*')
      ? env.FRONTEND_URL.split(',')[0].trim()
      : 'https://super-tom.vercel.app';

    try {
      const url = new URL(baseAppUrl);
      url.searchParams.set('lang', lang);
      if (refCode && refCode.trim().length > 0) {
        url.searchParams.set('startapp', refCode.trim());
      }
      return url.toString();
    } catch {
      const glue = baseAppUrl.includes('?') ? '&' : '?';
      let full = `${baseAppUrl}${glue}lang=${encodeURIComponent(lang)}`;
      if (refCode && refCode.trim().length > 0) {
        full += `&startapp=${encodeURIComponent(refCode.trim())}`;
      }
      return full;
    }
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
   * Builds the multilingual language selection prompt with inline buttons
   */
  public static renderLanguagePrompt(refCode?: string | null): {
    text: string;
    inlineKeyboard: any[][];
  } {
    const text = [
      `🌐 <b>Choose Your Language / زبان خود را انتخاب کنید / Выберите язык / Choisissez votre langue</b>`,
      ``,
      `👋 Welcome to <b>SuperTom</b>! Please select the language in which you want to see the texts:`,
      `لطفاً زبان مورد نظر خود را برای مشاهده پیام‌ها انتخاب کنید:`,
      `Пожалуйста, выберите язык, на котором хотите читать сообщения:`,
      `Veuillez choisir la langue dans laquelle vous souhaitez afficher les messages :`,
    ].join('\n');

    const refSuffix = refCode && refCode.trim().length > 0 ? `:${refCode.trim()}` : '';

    const inlineKeyboard = [
      [
        { text: '🇬🇧 English', callback_data: `set_lang:en${refSuffix}` },
        { text: '🇮🇷 فارسی', callback_data: `set_lang:fa${refSuffix}` },
      ],
      [
        { text: '🇷🇺 Русский', callback_data: `set_lang:ru${refSuffix}` },
        { text: '🇫🇷 Français', callback_data: `set_lang:fr${refSuffix}` },
      ],
    ];

    return { text, inlineKeyboard };
  }

  /**
   * Builds the translated welcome message and localized interactive buttons
   */
  public static async renderWelcomeMessage(
    lang: BotLanguage,
    params: {
      firstName: string;
      isReturningUser: boolean;
      referrerName?: string | null;
      refCode?: string | null;
    }
  ): Promise<{ text: string; inlineKeyboard: any[][] }> {
    const t = BOT_TRANSLATIONS[lang] || BOT_TRANSLATIONS.en;
    const name = this.escapeHtml(params.firstName || 'Miner');

    const lines: string[] = [t.welcomeTitle, ''];

    if (params.isReturningUser) {
      lines.push(t.welcomeBackHeading.replace('{name}', name));
      lines.push(t.miningActive);
      lines.push('');
      lines.push(t.feedTomIntro);
    } else {
      lines.push(t.newWelcomeHeading.replace('{name}', name));
      lines.push(t.miningActive);
      if (params.referrerName) {
        lines.push('');
        lines.push(t.invitedBy.replace('{referrer}', this.escapeHtml(params.referrerName)));
      }
      lines.push('');
      lines.push(t.feedTomIntro);
    }

    lines.push('');
    lines.push(t.whatYouCanDo);
    lines.push('');
    lines.push(t.featureFeed);
    lines.push(t.featureSpin);
    lines.push(t.featureMissions);
    lines.push(t.featurePayouts);
    lines.push(t.featureReferrals);
    lines.push('');
    lines.push(t.startMiningCta);

    const miniAppUrl = this.resolveMiniAppUrl(params.refCode, lang);
    const payoutChannelUrl = await this.resolvePayoutChannelUrl();
    const supportUrl = this.resolveSupportUrl();

    const inlineKeyboard = [
      [
        {
          text: t.btnOpenApp,
          web_app: { url: miniAppUrl },
        },
      ],
      [
        {
          text: t.btnPayoutChannel,
          url: payoutChannelUrl,
        },
        {
          text: t.btnSupport,
          url: supportUrl,
        },
      ],
      [
        {
          text: t.btnChangeLang,
          callback_data: 'prompt_lang',
        },
      ],
      [
        {
          text: t.btnWatchAds,
          web_app: { url: `${miniAppUrl}&tab=missions&startapp=watch_ad` },
        },
      ],
    ];

    return { text: lines.join('\n'), inlineKeyboard };
  }

  /**
   * Ensure Webhook and Bot Commands are registered with Telegram API on server boot
   */
  public static async ensureWebhookRegistered(): Promise<void> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') return;

    try {
      const webhookUrl = 'https://supertom-backend.onrender.com/api/v1/bot/webhook';
      const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const infoData: any = await infoRes.json();

      if (!infoData.ok || infoData.result?.url !== webhookUrl) {
        logger.info(`[TelegramBot] Registering Telegram webhook: ${webhookUrl}...`);
        await fetch(
          `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=false`
        );
      } else {
        logger.info(`[TelegramBot] Webhook verified and active: ${webhookUrl}`);
      }

      // Register standard bot commands menu in Telegram
      await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: [
            { command: 'start', description: 'Start SuperTom & choose language' },
            { command: 'language', description: 'Change language (English, فارسی, Русский, Français)' },
            { command: 'ads', description: 'Watch ads & earn free TomCoins' },
            { command: 'help', description: 'Support & payout instructions' },
          ],
        }),
      }).catch((cmdErr) => logger.warn('[TelegramBot] setMyCommands failed:', cmdErr));
    } catch (err) {
      logger.error(`[TelegramBot] Failed to verify/register webhook on startup:`, err);
    }
  }

  /**
   * Core Handler: Responds to Telegram /start command by presenting the Language Selection prompt
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
    const chatId = params.chatId.toString();

    // 1. Extract optional referral code from "/start <refCode>"
    const parts = params.text.trim().split(/\s+/);
    const rawRefCode = parts.length > 1 ? parts[1].trim().toUpperCase() : null;

    // 2. Ensure user record exists in Supabase
    let user = await prisma.user.findUnique({
      where: { telegramId: fromId },
      include: { miningSettlement: true, spinState: true },
    });

    if (!user) {
      const referralCode = `TOM${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      user = await prisma.user.create({
        data: {
          telegramId: fromId,
          username: params.from.username || `tom_${params.from.id}`,
          firstName: params.from.first_name,
          lastName: params.from.last_name,
          languageCode: params.from.language_code || 'en',
          poopsBalance: 1000n, // 1,000 TomCoins starter welcome bonus
          level: 1,
          levelTitle: 'Feline Cadet',
          referralCode,
        },
        include: { miningSettlement: true, spinState: true },
      });

      // Initialize default mining engine for new player
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

      // Initialize progressive lucky spin state
      await prisma.spinState.create({
        data: {
          userId: user.id,
          currentMilestone: 1,
          cycleCount: 1,
          nextUnlockAt: new Date(Date.now() + 2 * 3600 * 1000),
          claimedMilestones: '[]',
        },
      });

      // Record welcome bonus in immutable audit ledger
      await prisma.ledgerEntry.create({
        data: {
          userId: user.id,
          type: 'MISSION_REWARD',
          amount: 1000n,
          balanceBefore: 0n,
          balanceAfter: 1000n,
          description: 'Welcome starter bonus: 1,000 TomCoins for joining SuperTom',
          idempotencyKey: `welcome_starter_bonus_${user.id}`,
        },
      }).catch(() => {});

      logger.info(`[TelegramBot] New user registered via Telegram /start: ID ${user.id}, TG ${fromId}`);
    }

    // 3. Render and deliver the multilingual Language Selection prompt
    const { text, inlineKeyboard } = this.renderLanguagePrompt(rawRefCode);

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        }),
      });

      const data: any = await res.json();
      if (!data.ok) {
        logger.error('[TelegramBot] Failed to send language prompt:', data);
        return { ok: false, error: data.description };
      }

      return { ok: true, messageId: data.result?.message_id };
    } catch (err: unknown) {
      logger.error('[TelegramBot] Network error delivering language prompt:', err);
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  /**
   * Responds to /language or /lang command by re-prompting language selection
   */
  public static async handleLanguageCommand(params: {
    chatId: number | string;
    from: TelegramUser;
  }): Promise<void> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') return;

    const { text, inlineKeyboard } = this.renderLanguagePrompt();
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId.toString(),
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      }),
    }).catch((e) => logger.error('[TelegramBot] handleLanguageCommand error:', e));
  }

  /**
   * Handles interactive button clicks (callback queries for language selection)
   */
  public static async handleCallbackQuery(query: any): Promise<void> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') return;

    const queryId = query.id;
    const data: string = query.data || '';
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    const from: TelegramUser = query.from;

    if (!chatId || !from) return;

    const fromId = BigInt(from.id);

    // 1. User clicked "🌐 Change Language"
    if (data === 'prompt_lang') {
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: queryId }),
      }).catch(() => {});

      const { text, inlineKeyboard } = this.renderLanguagePrompt();

      if (messageId) {
        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: inlineKeyboard },
          }),
        }).catch(async () => {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
              reply_markup: { inline_keyboard: inlineKeyboard },
            }),
          });
        });
      }
      return;
    }

    // 2. User selected a language: "set_lang:<lang>[:<refCode>]"
    if (data.startsWith('set_lang:')) {
      const parts = data.split(':');
      const chosenLangRaw = parts[1] || 'en';
      const refCode = parts[2] ? parts[2].trim().toUpperCase() : null;

      const validLangs: BotLanguage[] = ['en', 'fa', 'ru', 'fr'];
      const chosenLang: BotLanguage = validLangs.includes(chosenLangRaw as BotLanguage)
        ? (chosenLangRaw as BotLanguage)
        : 'en';

      const t = BOT_TRANSLATIONS[chosenLang];

      // Acknowledge Telegram callback immediately
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: queryId,
          text: t.langSwitchedAlert,
        }),
      }).catch(() => {});

      // Save user language in Supabase
      let user = await prisma.user.findUnique({
        where: { telegramId: fromId },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { languageCode: chosenLang },
        }).catch((e) => logger.warn('[TelegramBot] Failed to update languageCode:', e));
      }

      let referrerName: string | null = null;

      // Handle referral if passed in callback and user not referred yet
      if (refCode && user && !user.referredById) {
        try {
          const referrer = await prisma.user.findUnique({
            where: { referralCode: refCode },
            select: { id: true, telegramId: true, username: true, firstName: true },
          });

          if (referrer && referrer.telegramId !== fromId) {
            referrerName = referrer.firstName || (referrer.username ? `@${referrer.username}` : 'a fellow feline miner');
            await ReferralService.attributeAndCreditReferral({
              referrerId: referrer.id,
              refereeId: user.id,
              refereeName: from.first_name || (from.username ? `@${from.username}` : `Miner ${fromId}`),
              refereeTelegramId: fromId,
            });
            logger.info(`[TelegramBot] Referral credited: ${referrer.id} invited ${user.id}`);
          }
        } catch (refErr) {
          logger.warn('[TelegramBot] Referral attribution error:', refErr);
        }
      }

      // Build translated welcome message
      const welcome = await this.renderWelcomeMessage(chosenLang, {
        firstName: from.first_name || 'Miner',
        isReturningUser: !!user,
        referrerName,
        refCode,
      });

      // Edit the existing message or send a fresh one
      if (messageId) {
        const editRes = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: welcome.text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: welcome.inlineKeyboard },
          }),
        });

        const editData: any = await editRes.json();
        if (!editData.ok) {
          // Fallback to sending new message if edit fails
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: welcome.text,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
              reply_markup: { inline_keyboard: welcome.inlineKeyboard },
            }),
          });
        }
      }
    }
  }

  /**
   * POST /api/v1/bot/webhook
   * Receives incoming Telegram webhook updates (/start commands, callback queries, channel posts)
   */
  public static async handleWebhook(req: Request, res: Response): Promise<void> {
    // Acknowledge Telegram immediately
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

      // 2. Handle Interactive Button Clicks (Callback Queries)
      const callbackQuery = req.body?.callback_query;
      if (callbackQuery && callbackQuery.data && callbackQuery.from) {
        await TelegramBotController.handleCallbackQuery(callbackQuery);
        return;
      }

      // 3. Handle Direct Player Messages (/start, /language, /help)
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
      } else if (
        text.startsWith('/language') ||
        text.startsWith('/lang') ||
        text === '🌐 Change Language' ||
        text === '🌐 تغییر زبان' ||
        text === '🌐 Сменить язык' ||
        text === '🌐 Changer de langue'
      ) {
        await TelegramBotController.handleLanguageCommand({
          chatId: message.chat.id,
          from: message.from,
        });
      } else if (text.startsWith('/ads') || text.startsWith('/watch')) {
        const token = env.TELEGRAM_BOT_TOKEN;
        if (token && token !== 'TEST_BOT_TOKEN_PLACEHOLDER') {
          const user = await prisma.user.findUnique({
            where: { telegramId: BigInt(message.from.id) },
            select: { languageCode: true, referralCode: true },
          });
          const lang = (user?.languageCode as BotLanguage) || 'en';
          const t = BOT_TRANSLATIONS[lang] || BOT_TRANSLATIONS.en;
          const miniAppUrl = TelegramBotController.resolveMiniAppUrl(user?.referralCode || null, lang);

          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: message.chat.id.toString(),
              text: `🎬 <b>${t.btnWatchAds}</b>\n\nWatch sponsored video advertisements to earn TomCoins, boost your mining, and unlock <b>FREE cryptocurrency withdrawals</b> (30 ads/day for 5 days)!\n\n👇 Tap below to start watching:`,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: t.btnWatchAds,
                      web_app: { url: `${miniAppUrl}&tab=missions&startapp=watch_ad` },
                    },
                  ],
                ],
              },
            }),
          }).catch((e) => logger.error('[TelegramBot] /ads command error:', e));
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
