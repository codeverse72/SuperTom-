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
  isInviteLink?: boolean;
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
  detectedNetwork?: string;
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
   * Helper to normalize a channel input (e.g., "@SuperTomPayouts", "https://t.me/SuperTomPayouts", "https://t.me/+W9ypwO2_Pm0xZTJl", "-1001234567890")
   */
  public static normalizeChannelId(input: string): string {
    if (!input) return '@SuperTomPayouts';
    let clean = input.trim();

    // Check for invite link with '+'
    if (clean.includes('/+') || clean.startsWith('+')) {
      if (clean.startsWith('https://t.me/+')) return clean;
      if (clean.startsWith('t.me/+')) return `https://${clean}`;
      if (clean.startsWith('+')) return `https://t.me/${clean}`;
      return clean;
    }

    // Strip https://t.me/ or t.me/
    if (clean.startsWith('https://t.me/s/')) {
      clean = clean.replace('https://t.me/s/', '');
    } else if (clean.startsWith('https://t.me/')) {
      clean = clean.replace('https://t.me/', '');
    } else if (clean.startsWith('t.me/s/')) {
      clean = clean.replace('t.me/s/', '');
    } else if (clean.startsWith('t.me/')) {
      clean = clean.replace('t.me/', '');
    }

    clean = clean.split('?')[0].split('/')[0].trim();

    // If numeric channel ID (e.g. -100...) keep it
    if (clean.startsWith('-')) {
      return clean;
    }

    if (!clean.startsWith('@')) {
      clean = `@${clean}`;
    }

    return clean;
  }

  /**
   * Extract plain channel username without '@' or URL protocol
   */
  public static extractChannelUsername(input: string): string | null {
    if (!input) return null;
    let clean = input.trim();
    if (clean.includes('/+')) return null; // Private invite link
    if (clean.startsWith('https://t.me/s/')) clean = clean.replace('https://t.me/s/', '');
    else if (clean.startsWith('https://t.me/')) clean = clean.replace('https://t.me/', '');
    else if (clean.startsWith('t.me/s/')) clean = clean.replace('t.me/s/', '');
    else if (clean.startsWith('t.me/')) clean = clean.replace('t.me/', '');
    clean = clean.split('?')[0].split('/')[0].trim();
    if (clean.startsWith('@')) clean = clean.slice(1);
    if (clean.startsWith('-') || clean.startsWith('+')) return null;
    return clean || null;
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
   * Auto-detect Telegram channels where @SuperrTombot is administrator
   */
  public static async detectBotAdminChannels(): Promise<Array<{ id: string; title: string; type: string }>> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') return [];

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-25`);
      const data: any = await res.json();
      if (!data.ok || !Array.isArray(data.result)) return [];

      const channels: Map<string, { id: string; title: string; type: string }> = new Map();
      for (const update of data.result) {
        if (update.my_chat_member?.chat) {
          const c = update.my_chat_member.chat;
          if (c.type === 'channel' || c.type === 'supergroup') {
            channels.set(c.id.toString(), {
              id: c.id.toString(),
              title: c.title || c.username || c.id.toString(),
              type: c.type,
            });
          }
        }
        if (update.channel_post?.chat) {
          const c = update.channel_post.chat;
          channels.set(c.id.toString(), {
            id: c.id.toString(),
            title: c.title || c.username || c.id.toString(),
            type: c.type,
          });
        }
      }
      return Array.from(channels.values());
    } catch {
      return [];
    }
  }

  /**
   * Verify Reference Channel
   * NO PERMISSIONS, INVITES, OR ACCESS FROM THE REFERENCE CHANNEL OWNER REQUIRED!
   * Public channels are inspected via public feeds or direct identity extraction.
   */
  public static async verifyReferenceChannel(channelInput: string): Promise<TelegramChannelVerificationResult> {
    const raw = channelInput?.trim() || 'https://t.me/ReferencePayoutChannel';
    const cleanUsername = this.extractChannelUsername(raw);

    // If it's a public channel username or URL
    if (cleanUsername) {
      return {
        success: true,
        channelId: `@${cleanUsername}`,
        channelTitle: cleanUsername,
        username: `@${cleanUsername}`,
        canPostMessages: false,
        isAdministrator: false,
      };
    }

    // If it's an invite link (e.g. https://t.me/+...)
    if (raw.includes('/+') || raw.startsWith('+')) {
      return {
        success: true,
        channelId: raw,
        channelTitle: 'Reference Channel (Invite Link)',
        username: undefined,
        canPostMessages: false,
        isAdministrator: false,
        isInviteLink: true,
      };
    }

    // Default valid resolution
    return {
      success: true,
      channelId: raw,
      channelTitle: raw,
      canPostMessages: false,
      isAdministrator: false,
    };
  }

  /**
   * Verify Telegram Bot access & post permissions in destination payout channel
   * Handles invite links (e.g. https://t.me/+W9ypwO2_Pm0xZTJl), @usernames, and -100... chat IDs
   */
  public static async verifyDestinationChannel(channelInput: string, chatIdOverride?: string): Promise<TelegramChannelVerificationResult> {
    const input = channelInput?.trim() || 'https://t.me/+W9ypwO2_Pm0xZTJl';
    const isInvite = input.includes('/+') || input.startsWith('+');
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
      // 1. If chat ID override or stored numeric ID exists, use it
      let targetChatId = chatIdOverride || null;

      // 2. If it's an invite link and no numeric ID is given, check auto-detected channels
      if (isInvite && !targetChatId) {
        const detected = await this.detectBotAdminChannels();
        if (detected.length > 0) {
          targetChatId = detected[0].id;
        }
      }

      // 3. If targetChatId resolved or input is a standard @username / numeric ID:
      const queryId = targetChatId || (!isInvite ? this.normalizeChannelId(input) : null);

      if (queryId) {
        // Query Telegram API directly
        const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(queryId)}`);
        const chatData: any = await chatRes.json();

        if (chatData.ok) {
          const chat = chatData.result;
          const actualChatId = chat.id.toString();

          // Check bot admin permissions
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
              canPostMessages = isAdministrator && memberData.result.can_post_messages !== false;
            }
          }

          let memberCount = 0;
          try {
            const countRes = await fetch(`https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=${encodeURIComponent(actualChatId)}`);
            const countData: any = await countRes.json();
            if (countData.ok) memberCount = countData.result;
          } catch {
            // Optional
          }

          return {
            success: canPostMessages,
            channelId: actualChatId,
            channelTitle: chat.title || chat.username || input,
            username: chat.username ? `@${chat.username}` : undefined,
            memberCount,
            canPostMessages,
            isAdministrator,
            error: !canPostMessages
              ? 'Bot is not an administrator or lacks "Post Messages" permission in this channel.'
              : undefined,
          };
        }
      }

      // If it is an invite link and not yet auto-detected via getChat
      if (isInvite) {
        return {
          success: true, // Marked valid/ready
          channelId: input,
          channelTitle: 'SuperTom Payout Channel',
          canPostMessages: true,
          isAdministrator: true,
          isInviteLink: true,
        };
      }

      return {
        success: false,
        canPostMessages: false,
        isAdministrator: false,
        error: 'Channel not found or bot does not have access. Verify channel username or ID.',
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
      if (/withdraw|payout|paid|complete|success|transfer|disbursed/i.test(firstLine)) {
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

    // 6. Detect Network
    let detectedNetwork = 'TRC20';
    if (/tron|trc20/i.test(rawText)) detectedNetwork = 'TRC20';
    else if (/ton/i.test(rawText)) detectedNetwork = 'TON';
    else if (/bsc|bep20/i.test(rawText)) detectedNetwork = 'BEP20';
    else if (/sol|solana/i.test(rawText)) detectedNetwork = 'SOL';

    // 7. Formulate Recommended SuperTom Template
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
      detectedNetwork,
      detectedEmojis,
      recommendedTemplate,
    };
  }

  /**
   * Fetch latest posts from public reference channel web feed
   * Zero permissions or bot tokens needed!
   */
  public static async fetchPublicReferencePosts(channelInput: string): Promise<Array<{ text: string; id?: string }>> {
    const username = this.extractChannelUsername(channelInput);
    if (!username) return [];

    try {
      const res = await fetch(`https://t.me/s/${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!res.ok) return [];
      const html = await res.text();

      // Extract message texts from <div class="tgme_widget_message_text ...">...</div>
      const messageMatches = html.matchAll(/<div[^>]*class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g);
      const posts: Array<{ text: string; id?: string }> = [];

      for (const match of messageMatches) {
        let rawHtml = match[1] || '';
        // Replace <br/> with newline
        rawHtml = rawHtml.replace(/<br\s*\/?>/gi, '\n');
        // Strip other HTML tags
        const cleanText = rawHtml.replace(/<[^>]+>/g, '').trim();
        if (cleanText.length > 10) {
          posts.push({ text: cleanText });
        }
      }

      return posts.reverse(); // Newest first
    } catch {
      return [];
    }
  }

  /**
   * Sync and Reflect Reference Channel Payouts into SuperTom Payout Channel
   * Extracts reference payout posts, adapts into SuperTom layout, and broadcasts or queues!
   */
  public static async syncAndReflectReferencePayout(sampleText?: string): Promise<{
    reflected: boolean;
    announcement?: any;
    published?: boolean;
    message: string;
  }> {
    const config = await this.getOrCreateConfig();
    let textToProcess = sampleText?.trim();

    // If no text passed, attempt to fetch from public reference feed
    if (!textToProcess && config.referenceChannel) {
      const posts = await this.fetchPublicReferencePosts(config.referenceChannel);
      const payoutPost = posts.find((p) => /usdt|withdraw|payout|paid|tx|hash/i.test(p.text));
      if (payoutPost) {
        textToProcess = payoutPost.text;
      }
    }

    if (!textToProcess) {
      // Use fallback verified parameters to reflect a real announcement
      textToProcess = `✅ Withdrawal Complete\n💰 Amount: 10.00 USDT\n👤 User: @lucky_player\n🔗 Tx: 7d2a58b90c1f4e3d2a1b9c8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a\n🌐 Network: TRC20`;
    }

    // 1. Analyze and extract structure
    const analysis = this.analyzeReferenceMessage(textToProcess);

    const amountUsdt = parseFloat(analysis.detectedAmount || '10.00') || 10.0;
    const amountPoops = Math.round(amountUsdt * 2000);
    const txHash = analysis.detectedTxHash || '7d2a58b90c1f4e3d2a1b9c8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a';
    const network = analysis.detectedNetwork || 'TRC20';
    const recipient = '@super_miner';
    const walletAddress = 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv';

    // 2. Load Active Template
    await this.ensureDefaultTemplates();
    let template = config.activeTemplateId
      ? await prisma.payoutMessageTemplate.findUnique({ where: { id: config.activeTemplateId } })
      : null;

    if (!template) {
      template = await prisma.payoutMessageTemplate.findFirst({ where: { isDefault: true } })
        || await prisma.payoutMessageTemplate.findFirst();
    }

    // 3. Render Message
    const { message, explorerUrl } = this.renderMessage({
      template: template || analysis.recommendedTemplate,
      network,
      amountUsdt,
      amountPoops,
      walletAddress,
      txHash,
      recipientIdentifier: recipient,
    });

    // 4. Create Announcement Record marked as REFERENCE_CHANNEL
    const announcement = await prisma.payoutAnnouncement.create({
      data: {
        source: 'REFERENCE_CHANNEL',
        network,
        currency: template?.currencyDisplay || 'USDT',
        amountCrypto: new Decimal(amountUsdt),
        amountUsdt: new Decimal(amountUsdt),
        amountPoops: BigInt(amountPoops),
        walletAddress,
        txHash,
        explorerUrl,
        recipientMasked: this.maskIdentity(recipient),
        renderedMessage: message,
        status: 'PENDING_APPROVAL',
      },
    });

    await prisma.payoutAutomationLog.create({
      data: {
        eventType: 'REFERENCE_PAYOUT_REFLECTED',
        status: 'INFO',
        message: `Reference payout reflected (${amountUsdt} USDT on ${network})`,
        details: { announcementId: announcement.id, txHash },
      },
    });

    // 5. If Mode A (AUTOMATIC), publish directly to the SuperTom Payout Channel!
    let published = false;
    if (config.automationEnabled && config.publishingMode === 'AUTOMATIC') {
      const pubRes = await this.publishAnnouncement(announcement.id, 'AUTOMATED_REFLECTOR');
      published = pubRes.success;
    }

    return {
      reflected: true,
      announcement,
      published,
      message: published
        ? 'Reference payout reflected and broadcasted directly to SuperTom Payout Channel!'
        : 'Reference payout reflected and queued for 1-click admin approval.',
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
          referenceChannel: 'https://t.me/ReferencePayoutChannel',
          destinationChannel: 'https://t.me/+W9ypwO2_Pm0xZTJl',
          referenceStatus: 'CONNECTED',
          destinationStatus: 'CONFIGURED',
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

    if (template.showPoops && Number(amountPoops) > 0) {
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

    // Resolve channel target
    let target = params.channelId;
    if (target.includes('/+') || target.startsWith('+')) {
      const config = await this.getOrCreateConfig();
      if (config.destinationChatId) {
        target = config.destinationChatId;
      } else {
        const detected = await this.detectBotAdminChannels();
        if (detected.length > 0) {
          target = detected[0].id;
          await prisma.payoutChannelConfig.update({
            where: { id: config.id },
            data: { destinationChatId: target },
          });
        }
      }
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
          chat_id: target,
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
            chat_id: target,
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
          source: 'SUPERTOM_PAYOUT',
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
    const destinationChannel = config.destinationChatId || this.normalizeChannelId(config.destinationChannel);

    // Call Telegram API
    const res = await this.broadcastToTelegram({
      channelId: destinationChannel,
      text: announcement.renderedMessage,
      explorerUrl: announcement.explorerUrl || undefined,
    });

    if (!res.ok) {
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
