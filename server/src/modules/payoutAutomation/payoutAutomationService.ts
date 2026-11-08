import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { Decimal } from '@prisma/client/runtime/library';

export interface TelegramChannelVerificationResult {
  success: boolean;
  channelId?: string;
  channelTitle?: string;
  username?: string;
  memberCount?: number;
  canPostMessages: boolean;
  isAdministrator: boolean;
  error?: string;
}

export interface ExtractedFormatResult {
  detectedHeading: string;
  detectedSuccessIndicator: string;
  detectedCurrency: string;
  detectedAmount?: string;
  detectedUsd?: string;
  detectedTxHash?: string;
  detectedExplorerDomain?: string;
  detectedEmojis: string[];
  recommendedTemplate: {
    heading: string;
    successMessage: string;
    footer: string;
    emojis: string;
    currencyDisplay: string;
    showUsd: boolean;
    showPoops: boolean;
    showExplorerLink: boolean;
    maskUserAddress: boolean;
  };
}

export class PayoutAutomationService {
  /**
   * Helper to normalize a channel input (e.g., "@SuperTomPayouts", "https://t.me/SuperTomPayouts", "-1001234567890")
   */
  public static normalizeChannelId(input: string): string {
    let clean = input.trim();
    if (clean.startsWith('https://t.me/')) {
      clean = clean.replace('https://t.me/', '');
      if (clean.startsWith('+')) {
        // Invite link - return as is for reference
        return clean;
      }
      clean = `@${clean}`;
    }
    if (!clean.startsWith('@') && !clean.startsWith('-') && !clean.startsWith('+')) {
      clean = `@${clean}`;
    }
    return clean;
  }

  /**
   * Get blockchain explorer link for transaction hash and network
   */
  public static getExplorerUrl(network: string, txHash: string): string {
    const cleanHash = txHash.trim();
    const net = (network || 'TRC20').toUpperCase();
    if (net.includes('TRON') || net.includes('TRC20')) {
      return `https://tronscan.org/#/transaction/${cleanHash}`;
    }
    if (net.includes('TON')) {
      return `https://tonviewer.com/transaction/${cleanHash}`;
    }
    if (net.includes('BSC') || net.includes('BEP20')) {
      return `https://bscscan.com/tx/${cleanHash}`;
    }
    if (net.includes('SOL')) {
      return `https://solscan.io/tx/${cleanHash}`;
    }
    return `https://etherscan.io/tx/${cleanHash}`;
  }

  /**
   * Mask wallet address or username for player privacy
   */
  public static maskIdentity(addressOrUser: string): string {
    if (!addressOrUser) return 'Player';
    const clean = addressOrUser.trim();
    if (clean.startsWith('@')) {
      if (clean.length <= 4) return clean;
      return `${clean.slice(0, 3)}***`;
    }
    if (clean.length > 10) {
      return `${clean.slice(0, 5)}...${clean.slice(-4)}`;
    }
    return `${clean.slice(0, 3)}***`;
  }

  /**
   * Verify Telegram Bot access & post permissions in destination payout channel
   */
  public static async verifyDestinationChannel(channelInput: string): Promise<TelegramChannelVerificationResult> {
    const channelId = this.normalizeChannelId(channelInput);
    const token = env.TELEGRAM_BOT_TOKEN;

    if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') {
      return {
        success: false,
        canPostMessages: false,
        isAdministrator: false,
        error: 'Telegram Bot Token is not configured in backend environment.',
      };
    }

    try {
      // 1. Get Chat details
      const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(channelId)}`);
      const chatData: any = await chatRes.json();

      if (!chatData.ok) {
        return {
          success: false,
          canPostMessages: false,
          isAdministrator: false,
          error: chatData.description || 'Channel not found or bot does not have access.',
        };
      }

      const chat = chatData.result;
      const actualChatId = chat.id.toString();

      // 2. Get Bot Member info to check Administrator & can_post_messages permissions
      const botMeRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const botMe: any = await botMeRes.json();
      const botUserId = botMe?.result?.id;

      let isAdministrator = false;
      let canPostMessages = false;

      if (botUserId) {
        const memberRes = await fetch(
          `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(actualChatId)}&user_id=${botUserId}`
        );
        const memberData: any = await memberRes.json();
        if (memberData.ok) {
          const status = memberData.result.status;
          isAdministrator = status === 'administrator' || status === 'creator';
          canPostMessages = isAdministrator && (memberData.result.can_post_messages !== false);
        }
      }

      // 3. Member count
      let memberCount = 0;
      try {
        const countRes = await fetch(
          `https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=${encodeURIComponent(actualChatId)}`
        );
        const countData: any = await countRes.json();
        if (countData.ok) memberCount = countData.result;
      } catch {
        // Optional
      }

      return {
        success: isAdministrator && canPostMessages,
        channelId: actualChatId,
        channelTitle: chat.title || chat.username,
        username: chat.username ? `@${chat.username}` : undefined,
        memberCount,
        canPostMessages,
        isAdministrator,
        error: !canPostMessages
          ? 'Bot is not an administrator or lacks "Post Messages" permission in this channel.'
          : undefined,
      };
    } catch (err: unknown) {
      return {
        success: false,
        canPostMessages: false,
        isAdministrator: false,
        error: err instanceof Error ? err.message : 'Failed to connect to Telegram API.',
      };
    }
  }

  /**
   * Verify Reference channel connectivity (must be public or bot must be member)
   */
  public static async verifyReferenceChannel(channelInput: string): Promise<TelegramChannelVerificationResult> {
    const channelId = this.normalizeChannelId(channelInput);
    const token = env.TELEGRAM_BOT_TOKEN;

    if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') {
      return {
        success: false,
        canPostMessages: false,
        isAdministrator: false,
        error: 'Telegram Bot Token is not configured.',
      };
    }

    try {
      const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(channelId)}`);
      const chatData: any = await chatRes.json();

      if (!chatData.ok) {
        return {
          success: false,
          canPostMessages: false,
          isAdministrator: false,
          error: chatData.description || 'Reference channel not reachable. Ensure username is correct or bot is added.',
        };
      }

      const chat = chatData.result;
      return {
        success: true,
        channelId: chat.id.toString(),
        channelTitle: chat.title || chat.username,
        username: chat.username ? `@${chat.username}` : undefined,
        canPostMessages: false,
        isAdministrator: false,
      };
    } catch (err: unknown) {
      return {
        success: false,
        canPostMessages: false,
        isAdministrator: false,
        error: err instanceof Error ? err.message : 'Failed to contact Telegram API.',
      };
    }
  }

  /**
   * Analyze reference payout message and extract formatting structures
   */
  public static analyzeReferenceMessage(rawText: string): ExtractedFormatResult {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Detect emojis
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu;
    const matches = rawText.match(emojiRegex) || [];
    const detectedEmojis = Array.from(new Set(matches)).slice(0, 8);

    // 2. Detect Heading
    let detectedHeading = '✅ SuperTom Withdrawal Complete';
    if (lines.length > 0) {
      const firstLine = lines[0];
      if (/withdraw|payout|paid|complete|success|transfer/i.test(firstLine)) {
        detectedHeading = firstLine;
      }
    }

    // 3. Detect Amount & Currency
    let detectedCurrency = 'USDT';
    let detectedAmount: string | undefined;
    const amountMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(USDT|USD|TON|TRX|SOL|ETH)/i);
    if (amountMatch) {
      detectedAmount = amountMatch[1];
      detectedCurrency = amountMatch[2].toUpperCase();
    }

    // 4. Detect USD
    let detectedUsd: string | undefined;
    const usdMatch = rawText.match(/\$(\d+(?:\.\d+)?)/);
    if (usdMatch) {
      detectedUsd = `$${usdMatch[1]}`;
    }

    // 5. Detect Tx Hash & Explorer Domain
    let detectedTxHash: string | undefined;
    let detectedExplorerDomain: string | undefined;
    const txMatch = rawText.match(/(?:tx|hash|transaction|view)[:\s]*([a-zA-Z0-9_]{16,66})/i);
    if (txMatch) {
      detectedTxHash = txMatch[1];
    }
    const domainMatch = rawText.match(/(tronscan\.org|tonviewer\.com|bscscan\.com|etherscan\.io|solscan\.io)/i);
    if (domainMatch) {
      detectedExplorerDomain = domainMatch[1];
    }

    // 6. Formulate Recommended SuperTom Template
    const emojisJoined = detectedEmojis.length > 0 ? detectedEmojis.join(',') : '💎,💰,🚀,🐱,✅,🔗';
    const recommendedTemplate = {
      heading: detectedHeading.includes('SuperTom')
        ? detectedHeading
        : `✅ SuperTom Withdrawal Complete`,
      successMessage: 'Payment verified and transferred on-chain!',
      footer: '🐱 Thank you for mining with SuperTom! 24/7 Support: @SuperTomCare',
      emojis: emojisJoined,
      currencyDisplay: detectedCurrency,
      showUsd: !!detectedUsd || detectedCurrency === 'USDT',
      showPoops: true,
      showExplorerLink: true,
      maskUserAddress: true,
    };

    return {
      detectedHeading,
      detectedSuccessIndicator: '✅ Complete / Verified',
      detectedCurrency,
      detectedAmount,
      detectedUsd,
      detectedTxHash,
      detectedExplorerDomain,
      detectedEmojis,
      recommendedTemplate,
    };
  }

  /**
   * Ensure default templates exist in database
   */
  public static async ensureDefaultTemplates(): Promise<void> {
    const count = await prisma.payoutMessageTemplate.count();
    if (count > 0) return;

    await prisma.payoutMessageTemplate.createMany({
      data: [
        {
          name: 'SuperTom Classic Gold',
          description: 'Official high-trust format with network badge, masked recipient, and blockchain verification button.',
          heading: '✅ SuperTom Withdrawal Complete',
          successMessage: 'Transaction successfully finalized on-chain!',
          footer: '🐱 Keep mining with King Tom! Questions? Contact @SuperTomCare',
          emojis: '💎,💰,🚀,🐱,✅,🔗',
          currencyDisplay: 'USDT',
          showUsd: true,
          showPoops: true,
          showExplorerLink: true,
          maskUserAddress: true,
          isDefault: true,
        },
        {
          name: 'Royal Feline Celebration',
          description: 'High energy announcement celebrating King Tom payouts with community mining stats.',
          heading: '👑 King Tom Royal Payout Disbursed! 🎉',
          successMessage: 'A fellow feline has received their verified rewards!',
          footer: '🐱 Feed King Tom biscuits to multiply your hourly Poops! Support: @SuperTomCare',
          emojis: '👑,🎉,💎,💰,🐱,⚡',
          currencyDisplay: 'USDT',
          showUsd: true,
          showPoops: true,
          showExplorerLink: true,
          maskUserAddress: true,
          isDefault: false,
        },
        {
          name: 'Proof of Reserves Minimal',
          description: 'Sleek, transparent receipt design with explicit transaction ID and zero fluff.',
          heading: '⚡ Verified Withdrawal Sent',
          successMessage: 'Instant on-chain transfer confirmed.',
          footer: 'Join official chat & support: @SuperTomCare',
          emojis: '⚡,🔗,🛡️,✅',
          currencyDisplay: 'USDT',
          showUsd: false,
          showPoops: false,
          showExplorerLink: true,
          maskUserAddress: true,
          isDefault: false,
        },
      ],
    });
    logger.info('[PayoutAutomation] Initialized 3 default payout announcement templates.');
  }

  /**
   * Get or initialize configuration
   */
  public static async getOrCreateConfig() {
    let config = await prisma.payoutChannelConfig.findFirst();
    if (!config) {
      config = await prisma.payoutChannelConfig.create({
        data: {
          referenceChannel: '@ReferencePayoutChannel',
          destinationChannel: '@SuperTomPayouts',
          referenceStatus: 'DISCONNECTED',
          destinationStatus: 'DISCONNECTED',
          automationEnabled: false,
          publishingMode: 'MANUAL_APPROVAL',
        },
      });
    }
    return config;
  }

  /**
   * Render Announcement Text from template and actual withdrawal record
   */
  public static renderMessage(params: {
    template: {
      heading: string;
      successMessage: string;
      footer: string;
      currencyDisplay: string;
      showUsd: boolean;
      showPoops: boolean;
      showExplorerLink: boolean;
      maskUserAddress: boolean;
      rawTemplate?: string | null;
    };
    network: string;
    amountUsdt: number | string;
    amountPoops: bigint | number | string;
    walletAddress: string;
    txHash: string;
    recipientIdentifier: string;
  }): { message: string; explorerUrl: string } {
    const { template, network, amountUsdt, amountPoops, walletAddress, txHash, recipientIdentifier } = params;

    const explorerUrl = this.getExplorerUrl(network, txHash);
    const maskedAddress = template.maskUserAddress ? this.maskIdentity(walletAddress) : walletAddress;
    const maskedUser = template.maskUserAddress ? this.maskIdentity(recipientIdentifier) : recipientIdentifier;
    const formattedUsdt = Number(amountUsdt).toFixed(2);
    const formattedPoops = Number(amountPoops).toLocaleString();

    // If custom rawTemplate is supplied with tokens:
    if (template.rawTemplate && template.rawTemplate.trim().length > 0) {
      const rendered = template.rawTemplate
        .replace(/{heading}/g, template.heading)
        .replace(/{network}/g, network)
        .replace(/{currency}/g, template.currencyDisplay || 'USDT')
        .replace(/{amount_usdt}/g, formattedUsdt)
        .replace(/{amount_crypto}/g, `${formattedUsdt} ${template.currencyDisplay || 'USDT'}`)
        .replace(/{amount_poops}/g, formattedPoops)
        .replace(/{recipient}/g, maskedUser)
        .replace(/{wallet}/g, maskedAddress)
        .replace(/{tx_hash}/g, txHash)
        .replace(/{tx_hash_short}/g, this.maskIdentity(txHash))
        .replace(/{explorer_link}/g, explorerUrl)
        .replace(/{footer}/g, template.footer);
      return { message: rendered, explorerUrl };
    }

    // Default SuperTom Clean Markdown layout
    const lines: string[] = [
      `*${template.heading}*`,
      ``,
      `💎 *Network:* \`${network}\``,
      `💰 *Amount:* *${formattedUsdt} ${template.currencyDisplay || 'USDT'}*`,
    ];

    if (template.showUsd && template.currencyDisplay !== 'USDT') {
      lines.push(`💵 *USD Value:* $${formattedUsdt}`);
    }

    if (template.showPoops) {
      lines.push(`💩 *Burned Balance:* ${formattedPoops} Poops`);
    }

    lines.push(`👤 *Recipient:* \`${maskedUser}\``);
    lines.push(`👛 *Wallet:* \`${maskedAddress}\``);

    if (template.showExplorerLink) {
      lines.push(`🔗 *TxHash:* [${this.maskIdentity(txHash)}](${explorerUrl})`);
    }

    lines.push(``);
    lines.push(`✨ _${template.successMessage}_`);
    lines.push(``);
    lines.push(`${template.footer}`);

    return { message: lines.join('\n'), explorerUrl };
  }

  /**
   * Broadcast message to Telegram channel
   */
  public static async broadcastToTelegram(params: {
    channelId: string;
    text: string;
    explorerUrl?: string;
  }): Promise<{ ok: boolean; messageId?: number; error?: string }> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') {
      return { ok: false, error: 'Telegram Bot Token not configured on server.' };
    }

    const inline_keyboard: any[] = [];
    const row: any[] = [];

    if (params.explorerUrl) {
      row.push({ text: '🔍 View on Blockchain', url: params.explorerUrl });
    }
    row.push({ text: '🚀 Play SuperTom', url: 'https://t.me/SuperrTombot' });
    inline_keyboard.push(row);

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: params.channelId,
          text: params.text,
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
          reply_markup: { inline_keyboard },
        }),
      });

      const data: any = await res.json();
      if (!data.ok) {
        // Fallback: retry without Markdown parse_mode in case user input has special characters
        const fallbackRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: params.channelId,
            text: params.text.replace(/[*_`\[\]()]/g, ''),
            reply_markup: { inline_keyboard },
          }),
        });
        const fallbackData: any = await fallbackRes.json();
        if (!fallbackData.ok) {
          return { ok: false, error: data.description || 'Telegram API rejected message.' };
        }
        return { ok: true, messageId: fallbackData.result?.message_id };
      }

      return { ok: true, messageId: data.result?.message_id };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error reaching Telegram API.' };
    }
  }

  /**
   * Core Hook: Triggered automatically when a withdrawal is marked COMPLETED
   */
  public static async onWithdrawalCompleted(withdrawalId: string): Promise<any> {
    try {
      // 1. Idempotency Check: Already created?
      const existing = await prisma.payoutAnnouncement.findUnique({
        where: { withdrawalId },
      });
      if (existing) {
        logger.info(`[PayoutAutomation] Announcement already exists for withdrawal ${withdrawalId} (status: ${existing.status})`);
        return existing;
      }

      // 2. Load Withdrawal & User
      const withdrawal = await prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        include: { user: true },
      });
      if (!withdrawal || !withdrawal.txHash) {
        logger.warn(`[PayoutAutomation] Cannot create announcement: withdrawal ${withdrawalId} not found or missing txHash.`);
        return null;
      }

      // 3. Load Automation Config
      const config = await this.getOrCreateConfig();

      // 4. Load Active or Default Template
      await this.ensureDefaultTemplates();
      let template = config.activeTemplateId
        ? await prisma.payoutMessageTemplate.findUnique({ where: { id: config.activeTemplateId } })
        : null;

      if (!template) {
        template = await prisma.payoutMessageTemplate.findFirst({ where: { isDefault: true } })
          || await prisma.payoutMessageTemplate.findFirst();
      }

      if (!template) {
        throw new Error('No payout message template available in database.');
      }

      // 5. Generate Rendered Message
      const recipientIdentifier = withdrawal.user.username
        ? `@${withdrawal.user.username}`
        : `User #${withdrawal.user.telegramId.toString()}`;

      const { message, explorerUrl } = this.renderMessage({
        template,
        network: withdrawal.network,
        amountUsdt: Number(withdrawal.amountUsdt),
        amountPoops: withdrawal.amountPoops,
        walletAddress: withdrawal.walletAddress,
        txHash: withdrawal.txHash,
        recipientIdentifier,
      });

      // 6. Create Announcement Record
      const announcement = await prisma.payoutAnnouncement.create({
        data: {
          withdrawalId: withdrawal.id,
          userId: withdrawal.userId,
          templateId: template.id,
          network: withdrawal.network,
          currency: template.currencyDisplay || 'USDT',
          amountCrypto: withdrawal.amountUsdt,
          amountUsdt: withdrawal.amountUsdt,
          amountPoops: withdrawal.amountPoops,
          walletAddress: withdrawal.walletAddress,
          txHash: withdrawal.txHash,
          explorerUrl,
          recipientMasked: this.maskIdentity(recipientIdentifier),
          renderedMessage: message,
          status: 'PENDING_APPROVAL',
        },
      });

      await prisma.payoutAutomationLog.create({
        data: {
          eventType: 'ANNOUNCEMENT_QUEUED',
          status: 'INFO',
          message: `Payout announcement generated for withdrawal ${withdrawal.id} (${withdrawal.amountUsdt} USDT)`,
          details: { announcementId: announcement.id, withdrawalId: withdrawal.id },
        },
      });

      // 7. If Mode is AUTOMATIC and Automation is Enabled -> Publish immediately!
      if (config.automationEnabled && config.publishingMode === 'AUTOMATIC') {
        const publishResult = await this.publishAnnouncement(announcement.id, 'AUTOMATED_SYSTEM');
        return publishResult;
      }

      return announcement;
    } catch (err) {
      logger.error('[PayoutAutomation] Error in onWithdrawalCompleted hook:', err);
      return null;
    }
  }

  /**
   * Publish an Announcement (Manual Approval or Automatic)
   */
  public static async publishAnnouncement(
    announcementId: string,
    operator: string = 'ADMIN'
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const announcement = await prisma.payoutAnnouncement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      return { success: false, error: 'Announcement not found.' };
    }

    if (announcement.status === 'PUBLISHED') {
      return { success: true, messageId: Number(announcement.telegramMessageId || 0) };
    }

    const config = await this.getOrCreateConfig();
    const destinationChannel = this.normalizeChannelId(config.destinationChannel);

    // Call Telegram API
    const res = await this.broadcastToTelegram({
      channelId: destinationChannel,
      text: announcement.renderedMessage,
      explorerUrl: announcement.explorerUrl || undefined,
    });

    if (!res.ok) {
      // Mark as Failed
      await prisma.payoutAnnouncement.update({
        where: { id: announcementId },
        data: {
          status: 'FAILED',
          failureReason: res.error,
        },
      });

      await prisma.payoutChannelConfig.update({
        where: { id: config.id },
        data: {
          failedAttemptsCount: { increment: 1 },
        },
      });

      await prisma.payoutAutomationLog.create({
        data: {
          eventType: 'PUBLISH_FAILED',
          status: 'ERROR',
          message: `Failed to broadcast payout announcement ${announcementId}: ${res.error}`,
          details: { announcementId, destinationChannel, error: res.error },
        },
      });

      return { success: false, error: res.error };
    }

    // Success! Update announcement and config metrics
    const now = new Date();
    await prisma.payoutAnnouncement.update({
      where: { id: announcementId },
      data: {
        status: 'PUBLISHED',
        telegramMessageId: res.messageId ? BigInt(res.messageId) : null,
        telegramChatId: destinationChannel,
        publishedAt: now,
        publishedBy: operator,
        failureReason: null,
      },
    });

    await prisma.payoutChannelConfig.update({
      where: { id: config.id },
      data: {
        lastPublishedAt: now,
        lastPublishedTxHash: announcement.txHash,
        lastPublishedAmount: announcement.amountUsdt,
        totalPublishedCount: { increment: 1 },
      },
    });

    await prisma.payoutAutomationLog.create({
      data: {
        eventType: 'ANNOUNCEMENT_PUBLISHED',
        status: 'SUCCESS',
        message: `Payout announcement broadcasted to ${destinationChannel} (Message ID: ${res.messageId})`,
        details: { announcementId, txHash: announcement.txHash, telegramMessageId: res.messageId },
      },
    });

    return { success: true, messageId: res.messageId };
  }
}
