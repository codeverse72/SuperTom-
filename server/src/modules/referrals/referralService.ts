import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { LedgerService } from '../ledger/ledgerService.js';

export interface AttributeReferralParams {
  referrerId: string;
  refereeId: string;
  refereeName?: string;
  refereeTelegramId?: bigint;
}

export interface AttributeReferralResult {
  success: boolean;
  reason?: string;
  rewardPoops?: number;
  totalReferees?: number;
}

export class ReferralService {
  /**
   * Immediately attributes and credits referral rewards when a referent opens the bot.
   * Can be triggered when the referent sends /start or clicks START in Telegram chat,
   * OR when they open and authenticate in the SuperTom Mini App.
   *
   * Idempotent: strictly prevents double-crediting if called multiple times for the same referee.
   */
  public static async attributeAndCreditReferral(
    params: AttributeReferralParams
  ): Promise<AttributeReferralResult> {
    const { referrerId, refereeId, refereeName, refereeTelegramId } = params;

    // 1. Strict anti-fraud: prevent self-referral
    if (referrerId === refereeId) {
      logger.warn(`[ReferralService] Self-referral rejected: user ${refereeId}`);
      return { success: false, reason: 'SELF_REFERRAL_NOT_ALLOWED' };
    }

    const referralRewardPoops =
      Number.isSafeInteger(env.REFERRAL_SIGNUP_BONUS_POOPS) && env.REFERRAL_SIGNUP_BONUS_POOPS > 0
        ? env.REFERRAL_SIGNUP_BONUS_POOPS
        : 450;
    const referralRewardBigInt = BigInt(referralRewardPoops);

    try {
      // 2. Check if a Referral record already exists for this referee (idempotency check)
      const existingReferral = await prisma.referral.findUnique({
        where: { refereeId },
      });

      if (existingReferral) {
        logger.info(`[ReferralService] Referee ${refereeId} already attributed to referrer ${existingReferral.referrerId}. Status: ${existingReferral.status}`);
        return {
          success: false,
          reason: 'ALREADY_CREDITED',
          rewardPoops: Number(existingReferral.rewardPoops),
        };
      }

      // 3. Execute atomic double-entry balance credits inside a Prisma transaction
      const result = await prisma.$transaction(async (tx) => {
        // Ensure referee is linked to referrer
        await tx.user.update({
          where: { id: refereeId },
          data: { referredById: referrerId },
        });

        // Create official Referral record in Supabase
        const referral = await tx.referral.create({
          data: {
            referrerId,
            refereeId,
            rewardPoops: referralRewardBigInt,
            commissionPercent: 10,
            totalCommissionPoops: 0n,
            status: 'REWARDED',
          },
        });

        // Credit Referrer with configured referral bonus (default 450 Poops) via double-entry Ledger
        const { balanceAfter: referrerBalance } = await LedgerService.executeBalanceTransaction(tx, {
          userId: referrerId,
          type: 'REFERRAL_BONUS',
          amount: referralRewardBigInt,
          description: `Referral bonus: ${refereeName || 'Friend'} opened SuperTom via your invite`,
          idempotencyKey: `ref_bonus_${referrerId}_${refereeId}`,
        });

        // Credit Referee with 1,000 Poops welcome starter bonus via double-entry Ledger
        const { balanceAfter: refereeBalance } = await LedgerService.executeBalanceTransaction(tx, {
          userId: refereeId,
          type: 'REFERRAL_BONUS',
          amount: 1000n,
          description: `Welcome bonus for joining SuperTom via referral invite`,
          idempotencyKey: `ref_welcome_${refereeId}_${referrerId}`,
        });

        // Clean up pending referral record if present
        if (refereeTelegramId) {
          await tx.pendingReferral.deleteMany({
            where: { telegramId: refereeTelegramId },
          }).catch(() => {});
        }

        // Count total referees to update "Invite 3 Friends" quest progress
        const totalReferees = await tx.user.count({
          where: { referredById: referrerId },
        });

        const isQuestComplete = totalReferees >= 3;
        const inviteMission = await tx.mission.findFirst({
          where: { id: 'm4_invite_3' },
        });

        if (inviteMission) {
          await tx.userMission.upsert({
            where: {
              userId_missionId: {
                userId: referrerId,
                missionId: 'm4_invite_3',
              },
            },
            create: {
              userId: referrerId,
              missionId: 'm4_invite_3',
              status: isQuestComplete ? 'COMPLETED' : 'IN_PROGRESS',
              progress: Math.min(3, totalReferees),
              total: 3,
            },
            update: {
              progress: Math.min(3, totalReferees),
              status: isQuestComplete ? 'COMPLETED' : 'IN_PROGRESS',
            },
          });
        }

        return {
          referral,
          referrerBalance,
          refereeBalance,
          totalReferees,
        };
      });

      const formattedReward = referralRewardPoops.toLocaleString('en-US');
      logger.info(
        `[ReferralService] Referral successfully rewarded! Referrer ${referrerId} credited +${formattedReward} Poops (new bal: ${result.referrerBalance}). Referee ${refereeId} credited +1,000 Poops (new bal: ${result.refereeBalance}). Total referees: ${result.totalReferees}`
      );

      // 4. Send instant Telegram celebratory notification to the Referrer
      this.notifyReferrerViaTelegram(referrerId, refereeName, result.totalReferees, referralRewardPoops).catch((err) => {
        logger.warn('[ReferralService] Telegram referrer alert dispatch failed (non-fatal):', err);
      });

      return {
        success: true,
        rewardPoops: referralRewardPoops,
        totalReferees: result.totalReferees,
      };
    } catch (error) {
      logger.error('[ReferralService] Error rewarding referral:', error);
      return { success: false, reason: 'INTERNAL_ERROR' };
    }
  }

  /**
   * Send real-time Telegram notification to the referrer when their referee opens the bot
   */
  private static async notifyReferrerViaTelegram(
    referrerId: string,
    refereeName: string | undefined,
    totalReferees: number,
    rewardPoops: number
  ): Promise<void> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'TEST_BOT_TOKEN_PLACEHOLDER') return;

    const referrer = await prisma.user.findUnique({
      where: { id: referrerId },
      select: { telegramId: true, firstName: true },
    });

    if (!referrer?.telegramId) return;

    const friendName = refereeName ? refereeName.replace(/<[^>]+>/g, '') : 'A fellow feline miner';
    const message = [
      `🎉 <b>NEW REFERRAL REWARD!</b>`,
      ``,
      `🌟 <b>${friendName}</b> just opened SuperTom using your invite link!`,
      ``,
      `💰 <b>+${rewardPoops.toLocaleString('en-US')} Poops</b> has been credited directly to your balance!`,
      `👥 Total friends invited: <b>${totalReferees}</b>`,
      `👑 You earn <b>+10%</b> lifetime mining commission on everything they mine!`,
    ].join('\n');

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: referrer.telegramId.toString(),
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  }
}

