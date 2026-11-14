import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { verifyTelegramInitData } from '../../utils/telegramAuth.js';
import { signAccessToken, signRefreshToken, hashToken } from '../../utils/crypto.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import { LedgerService } from '../ledger/ledgerService.js';
import { MiningService } from '../mining/miningService.js';
import { ReferralService } from '../referrals/referralService.js';
import { WithdrawalEntitlementService } from '../payouts/withdrawalEntitlementService.js';
import { ensureCoreMissionsSeeded, mapMissionToDto } from '../missions/missionController.js';

const telegramAuthSchema = z.object({
  initData: z.string().min(1, 'initData is required'),
  startParam: z.string().optional().nullable(),
});

// In-memory 5-minute cache for biscuit products catalogue to eliminate redundant DB calls
let cachedBiscuitProducts: any[] | null = null;
let lastBiscuitProductsFetch = 0;
async function getCachedBiscuitProducts() {
  if (cachedBiscuitProducts && Date.now() - lastBiscuitProductsFetch < 300_000) {
    return cachedBiscuitProducts;
  }
  cachedBiscuitProducts = await prisma.biscuitProduct.findMany({
    where: { isActive: true },
    orderBy: { costPoops: 'asc' },
  });
  lastBiscuitProductsFetch = Date.now();
  return cachedBiscuitProducts;
}

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

    const { initData, startParam } = parseResult.data;
    const verification = verifyTelegramInitData(initData);

    if (!verification.isValid || !verification.data) {
      sendError(res, verification.error || 'Authentication signature invalid', 401, 'INVALID_TELEGRAM_AUTH');
      return;
    }

    const { user: tgUser, start_param } = verification.data;
    const tgId = BigInt(tgUser.id);

    const inputStartParam = (start_param && start_param.trim().length > 0)
      ? start_param.trim().toUpperCase()
      : (startParam && startParam.trim().length > 0)
      ? startParam.trim().toUpperCase()
      : null;

    try {
      // Find existing user or create a new player inside a transaction
      const result = await prisma.$transaction(async (tx) => {
        let user = await tx.user.findUnique({
          where: { telegramId: tgId },
          include: {
            miningSettlement: true,
            spinState: true,
            _count: {
              select: { referees: true, feedingEvents: true },
            },
          },
        });

        let isNewUser = false;

        // Check if input parameter represents a referrer's referralCode, or if a pending attribution exists from Telegram chat /start
        let effectiveReferralCode: string | null = inputStartParam;

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

        if (!user) {
          isNewUser = true;
          // Generate unique 8-character uppercase referral code
          const referralCode = `TOM${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

          user = await tx.user.create({
            data: {
              telegramId: tgId,
              username: tgUser.username || `tom_${tgUser.id}`,
              firstName: tgUser.first_name,
              lastName: tgUser.last_name,
              photoUrl: undefined,
              languageCode: tgUser.language_code || 'en',
              poopsBalance: 1000n, // 1,000 TomCoins welcome starter bonus for every new player
              level: 1,
              levelTitle: 'Feline Cadet',
              referralCode,
              referredById: referrerId,
            },
            include: {
              miningSettlement: true,
              spinState: true,
              _count: {
                select: { referees: true, feedingEvents: true },
              },
            },
          });

          // Record welcome bonus in immutable audit ledger
          await tx.ledgerEntry.create({
            data: {
              userId: user.id,
              type: 'MISSION_REWARD',
              amount: 1000n,
              balanceBefore: 0n,
              balanceAfter: 1000n,
              description: 'Welcome starter bonus: 1,000 TomCoins for joining SuperTom',
              idempotencyKey: `welcome_starter_bonus_${user.id}`,
            },
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

          // Initialize progressive lucky spin state (starts at milestone 1, first spin READY IMMEDIATELY)
          await tx.spinState.create({
            data: {
              userId: user.id,
              currentMilestone: 1,
              cycleCount: 1,
              nextUnlockAt: new Date(), // Immediate free spin on join!
              claimedMilestones: '[]',
            },
          });
        } else {
          // If existing user has no referrer linked yet and a valid referral code was passed
          if (!user.referredById && referrerId) {
            user = await tx.user.update({
              where: { id: user.id },
              data: { referredById: referrerId },
              include: {
                miningSettlement: true,
                spinState: true,
                _count: {
                  select: { referees: true, feedingEvents: true },
                },
              },
            });
          }

          // Update profile info on return ONLY if changed in Telegram
          const needsProfileUpdate =
            (tgUser.username && tgUser.username !== user.username) ||
            (tgUser.first_name && tgUser.first_name !== user.firstName) ||
            (tgUser.last_name !== undefined && tgUser.last_name !== user.lastName);

          if (needsProfileUpdate) {
            user = await tx.user.update({
              where: { id: user.id },
              data: {
                username: tgUser.username || user.username,
                firstName: tgUser.first_name || user.firstName,
                lastName: tgUser.last_name || user.lastName,
              },
              include: {
                miningSettlement: true,
                spinState: true,
                _count: {
                  select: { referees: true, feedingEvents: true },
                },
              },
            });
          }
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

        return { user, accessToken, refreshToken, isNewUser, referrerId };
      });

      // Immediately process & credit referral reward if applicable (idempotent, skips if already credited)
      const targetReferrerId = result.referrerId || result.user.referredById;
      if (targetReferrerId) {
        const rewardRes = await ReferralService.attributeAndCreditReferral({
          referrerId: targetReferrerId,
          refereeId: result.user.id,
          refereeName: tgUser.first_name || (tgUser.username ? `@${tgUser.username}` : `Miner ${tgId}`),
          refereeTelegramId: tgId,
        });

        if (rewardRes.success) {
          result.user.poopsBalance += 1000n;
        }
      }

      // 1. Auto-settle any completed hourly mining additions immediately (Option A) using preloaded state
      const settleResult = await MiningService.settleUserHourlyEarnings(result.user.id, {
        settlement: result.user.miningSettlement,
        balance: result.user.poopsBalance,
      });

      // 2. Ensure core missions exist, then fetch inventory and active missions in parallel
      await ensureCoreMissionsSeeded();
      const [inventories, activeBiscuits, missions] = await Promise.all([
        prisma.userInventory.findMany({ where: { userId: result.user.id } }),
        getCachedBiscuitProducts(),
        prisma.mission.findMany({
          where: { isActive: true },
          include: {
            userMissions: { where: { userId: result.user.id } },
          },
        }),
      ]);

      const userStats = result.user;

      const inventoryMap: Record<string, number> = {
        common: 0,
        silver: 0,
        gold: 0,
        diamond: 0,
      };
      for (const p of activeBiscuits) {
        inventoryMap[p.id] = 0;
      }
      for (const item of inventories) {
        inventoryMap[item.biscuitId] = item.quantity;
      }

      const now = new Date();
      const mappedMissions = missions.map((m) =>
        mapMissionToDto(
          m,
          {
            level: result.user.level,
            refereesCount: userStats?._count.referees,
            feedingEventsCount: userStats?._count.feedingEvents,
          },
          now
        )
      );

      const mappedBiscuits = activeBiscuits.map((b) => ({
        id: b.id,
        name: b.name,
        costPoops: Number(b.costPoops),
        productionBoostPerHour: b.productionBoostPerHour,
        currencyType: b.currencyType,
        badge: b.badge,
        color: b.color,
        borderColor: b.borderColor,
        glowColor: b.glowColor,
        description: b.description,
        isActive: b.isActive,
      }));

      const withdrawalEntitlement = await WithdrawalEntitlementService.getUserEntitlement(result.user.id);

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
          isNewUser: result.isNewUser,
        },
        initialState: {
          balancePoops: settleResult.newBalance,
          mining: {
            baseRatePerHour: result.user.miningSettlement?.baseRatePerHour ?? 10,
            boostRatePerHour: result.user.miningSettlement?.boostRatePerHour ?? 0,
            totalRatePerHour: settleResult.totalRatePerHour,
            unclaimedPoops: 0,
            settledAmount: settleResult.amountSettled,
            completedHoursSettled: settleResult.completedHours,
            newBalance: settleResult.newBalance,
            lastSettledAt: settleResult.lastSettledAt.toISOString(),
            msUntilNextHour: settleResult.msUntilNextHour,
            nextAdditionAt: settleResult.nextAdditionAt.toISOString(),
          },
          spinState: result.user.spinState ? {
            currentMilestone: result.user.spinState.currentMilestone,
            targetTimestamp: result.user.spinState.nextUnlockAt.getTime(),
            claimedMilestones: JSON.parse(result.user.spinState.claimedMilestones || '[]'),
            cycleCount: result.user.spinState.cycleCount,
          } : null,
          inventory: inventoryMap,
          missions: mappedMissions,
          biscuits: mappedBiscuits,
          withdrawalEntitlement,
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

