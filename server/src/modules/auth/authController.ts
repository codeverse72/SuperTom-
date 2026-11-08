import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { verifyTelegramInitData } from '../../utils/telegramAuth.js';
import { signAccessToken, signRefreshToken, hashToken } from '../../utils/crypto.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import { LedgerService } from '../ledger/ledgerService.js';

const telegramAuthSchema = z.object({
  initData: z.string().min(1, 'initData is required'),
});

export class AuthController {
  /**
   * POST /api/v1/auth/telegram
   * Validates raw Telegram WebApp initData, creates or loads player,
   * handles referral code attribution from start_param, and returns session tokens.
   */
  public static async authenticateTelegram(req: Request, res: Response): Promise<void> {
    const parseResult = telegramAuthSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 'Invalid request payload', 422, 'VALIDATION_ERROR', parseResult.error.format());
      return;
    }

    const { initData } = parseResult.data;
    const verification = verifyTelegramInitData(initData);

    if (!verification.isValid || !verification.data) {
      sendError(res, verification.error || 'Authentication signature invalid', 401, 'INVALID_TELEGRAM_AUTH');
      return;
    }

    const { user: tgUser, start_param } = verification.data;
    const tgId = BigInt(tgUser.id);

    try {
      // Find existing user or create a new player inside a transaction
      const result = await prisma.$transaction(async (tx) => {
        let user = await tx.user.findUnique({
          where: { telegramId: tgId },
          include: { miningSettlement: true, spinState: true },
        });

        let isNewUser = false;

        if (!user) {
          isNewUser = true;
          // Generate unique 8-character uppercase referral code
          const referralCode = `TOM${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

          // Check if start_param represents a referrer's referralCode, or if a pending attribution exists from Telegram chat /start
          let effectiveReferralCode: string | null = start_param ? start_param.trim().toUpperCase() : null;

          if (!effectiveReferralCode) {
            const pending = await tx.pendingReferral.findUnique({
              where: { telegramId: tgId },
            });
            if (pending) {
              effectiveReferralCode = pending.referralCode;
              await tx.pendingReferral.delete({ where: { telegramId: tgId } }).catch(() => {});
            }
          }

          let referrerId: string | null = null;
          if (effectiveReferralCode) {
            const referrer = await tx.user.findUnique({
              where: { referralCode: effectiveReferralCode },
              select: { id: true, telegramId: true },
            });
            // Strictly enforce no self-referral
            if (referrer && referrer.telegramId !== tgId) {
              referrerId = referrer.id;
            }
          }

          user = await tx.user.create({
            data: {
              telegramId: tgId,
              username: tgUser.username || `tom_${tgUser.id}`,
              firstName: tgUser.first_name,
              lastName: tgUser.last_name,
              photoUrl: undefined,
              languageCode: tgUser.language_code || 'en',
              poopsBalance: 0n,
              level: 1,
              levelTitle: 'Feline Cadet',
              referralCode,
              referredById: referrerId,
            },
            include: { miningSettlement: true, spinState: true },
          });

          // Initialize default mining engine for new player (10 Poops/hr base)
          await tx.miningSettlement.create({
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
          await tx.spinState.create({
            data: {
              userId: user.id,
              currentMilestone: 1,
              cycleCount: 1,
              nextUnlockAt: new Date(Date.now() + 2 * 3600 * 1000), // 2h from now
              claimedMilestones: '[]',
            },
          });

          // Attribute referral bonus ONLY NOW that the referent user has actually opened the bot
          if (referrerId) {
            await tx.referral.create({
              data: {
                referrerId,
                refereeId: user.id,
                rewardPoops: 2000n,
                commissionPercent: 10,
                totalCommissionPoops: 0n,
                status: 'REWARDED',
              },
            });

            // Credit referrer with 2,000 Poops bonus via double-entry Ledger
            await LedgerService.executeBalanceTransaction(tx, {
              userId: referrerId,
              type: 'REFERRAL_BONUS',
              amount: 2000n,
              description: `Referral bonus: @${tgUser.username || tgUser.id} opened SuperTom via your invite`,
              idempotencyKey: `ref_bonus_${referrerId}_${user.id}`,
            });

            // Credit the new player who opened the bot with a 1,000 Poop welcome starter bonus!
            const welcomeBonus = 1000n;
            const { balanceAfter: newPlayerBalance } = await LedgerService.executeBalanceTransaction(tx, {
              userId: user.id,
              type: 'REFERRAL_BONUS',
              amount: welcomeBonus,
              description: `Welcome bonus for joining via referral code ${effectiveReferralCode}`,
              idempotencyKey: `ref_welcome_${user.id}_${referrerId}`,
            });

            user.poopsBalance = newPlayerBalance;
          }
        } else {
          // Update profile info on return if changed in Telegram
          user = await tx.user.update({
            where: { id: user.id },
            data: {
              username: tgUser.username || user.username,
              firstName: tgUser.first_name || user.firstName,
              lastName: tgUser.last_name || user.lastName,
            },
            include: { miningSettlement: true, spinState: true },
          });
        }

        // Issue JWT access and refresh tokens
        const tokenPayload = {
          userId: user.id,
          telegramId: user.telegramId.toString(),
          username: user.username || undefined,
        };

        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken(tokenPayload);

        // Store hashed session token in database
        await tx.session.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(accessToken),
            refreshTokenHash: hashToken(refreshToken),
            expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days
            userAgent: req.headers['user-agent'] || 'Telegram WebApp',
            ipAddress: (req.ip || '0.0.0.0').toString(),
          },
        });

        return { user, accessToken, refreshToken, isNewUser };
      });

      sendSuccess(res, {
        token: result.accessToken,
        refreshToken: result.refreshToken,
        user: {
          userId: result.user.id,
          telegramId: result.user.telegramId.toString(),
          username: result.user.username || 'TomPlayer',
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          avatarUrl: result.user.photoUrl || '/assets/dashboard/avatar.png',
          level: result.user.level,
          levelTitle: result.user.levelTitle,
          referralCode: result.user.referralCode,
          createdAt: result.user.createdAt.toISOString(),
        },
        initialState: {
          balancePoops: Number(result.user.poopsBalance),
          mining: result.user.miningSettlement ? {
            baseRatePerHour: result.user.miningSettlement.baseRatePerHour,
            boostRatePerHour: result.user.miningSettlement.boostRatePerHour,
            totalRatePerHour: result.user.miningSettlement.totalRatePerHour,
            unclaimedPoops: Number(result.user.miningSettlement.unclaimedPoops),
            lastSettledAt: result.user.miningSettlement.lastSettledAt.toISOString(),
          } : null,
          spinState: result.user.spinState ? {
            currentMilestone: result.user.spinState.currentMilestone,
            targetTimestamp: result.user.spinState.nextUnlockAt.getTime(),
            claimedMilestones: JSON.parse(result.user.spinState.claimedMilestones || '[]'),
            cycleCount: result.user.spinState.cycleCount,
          } : null,
        },
      });
    } catch (err: unknown) {
      logger.error('Failed to authenticate Telegram user:', err);
      sendError(res, 'Authentication processing failed', 500, 'AUTH_FAILED');
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  public static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const tHash = hashToken(token);
        await prisma.session.updateMany({
          where: { tokenHash: tHash },
          data: { revokedAt: new Date() },
        });
      }
      sendSuccess(res, { loggedOut: true });
    } catch {
      sendSuccess(res, { loggedOut: true });
    }
  }
}

