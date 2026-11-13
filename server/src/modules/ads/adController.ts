import { Response } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { env } from '../../config/env.js';
import { verifyTelegramInitData } from '../../utils/telegramAuth.js';
import {
  WATCH_ADS_MISSION_ID,
  WATCH_ADS_DAILY_TARGET,
  getUtcDayStart,
} from '../missions/missionController.js';
import { WithdrawalEntitlementService } from '../payouts/withdrawalEntitlementService.js';

export const ADEXIUM_PLACEMENT_ID = 'b073a77c-3963-43dc-a846-99b5382cd341';
export const DEFAULT_ADSGRAM_BLOCK_ID = process.env.ADSGRAM_BLOCK_ID || '59392';
export const AD_SESSION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const MIN_VIEW_DURATION_MS = 4000; // Minimum 4 seconds playback before completion
export const AD_SESSION_COOLDOWN_MS = 8000; // Minimum 8 seconds between new ad sessions

export class AdController {
  /**
   * Generates a tamper-proof HMAC-SHA256 signature for the session.
   */
  public static generateSessionToken(sessionId: string, userId: string, nonce: string, expiresAtMs: number): string {
    const payload = `${sessionId}:${userId}:${nonce}:${expiresAtMs}`;
    return crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('hex');
  }

  /**
   * Verifies the tamper-proof HMAC-SHA256 signature.
   */
  public static verifySessionToken(sessionId: string, userId: string, nonce: string, expiresAtMs: number, token: string): boolean {
    const expected = AdController.generateSessionToken(sessionId, userId, nonce, expiresAtMs);
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  }

  /**
   * POST /api/v1/ads/session/create
   * Creates a cryptographically signed rewarded-ad session for the authenticated user.
   */
  public static async createSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
        return;
      }

      // Check Telegram initData freshness if provided in header
      const initDataRaw = (req.headers['x-telegram-init-data'] as string | undefined)?.trim();
      if (initDataRaw) {
        // Enforce max age of 900 seconds (15 minutes), matching Adexium's freshness rule
        const validation = verifyTelegramInitData(initDataRaw, env.TELEGRAM_BOT_TOKEN, 900);
        if (!validation.isValid) {
          sendError(
            res,
            'Telegram session expired. Please close and reopen SuperTom from @SuperrTombot.',
            401,
            'TELEGRAM_SESSION_EXPIRED'
          );
          return;
        }
      }

      const now = new Date();
      const startOfToday = getUtcDayStart(now);

      // Check if user already claimed today's daily 30 ads quest
      const userMission = await prisma.userMission.findUnique({
        where: { userId_missionId: { userId, missionId: WATCH_ADS_MISSION_ID } },
      });

      if (
        userMission &&
        userMission.status === 'CLAIMED' &&
        userMission.claimedAt &&
        new Date(userMission.claimedAt) >= startOfToday
      ) {
        sendError(
          res,
          'You have already completed and claimed all 30 daily ads today. Resets at 00:00 UTC!',
          400,
          'MISSION_ALREADY_CLAIMED'
        );
        return;
      }

      // Rate limit / cooldown check: prevent spamming session creation
      const recentSession = await prisma.adSession.findFirst({
        where: {
          userId,
          createdAt: { gte: new Date(now.getTime() - AD_SESSION_COOLDOWN_MS) },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentSession) {
        sendError(
          res,
          'Please finish watching the current advertisement before starting a new one.',
          429,
          'AD_SESSION_COOLDOWN'
        );
        return;
      }

      const { provider: requestedProvider } = (req.body as { provider?: string }) || {};
      const provider = requestedProvider === 'adexium' ? 'adexium' : 'adsgram';
      const placementId = provider === 'adexium' ? ADEXIUM_PLACEMENT_ID : DEFAULT_ADSGRAM_BLOCK_ID;

      const sessionId = crypto.randomUUID();
      const nonce = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(now.getTime() + AD_SESSION_EXPIRY_MS);
      const sessionToken = AdController.generateSessionToken(sessionId, userId, nonce, expiresAt.getTime());

      await prisma.adSession.create({
        data: {
          id: sessionId,
          userId,
          provider,
          placementId,
          status: 'PENDING',
          isCompleted: false,
          sessionNonce: nonce,
          sessionTokenHash: sessionToken,
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
          userAgent: req.headers['user-agent'] || null,
          expiresAt,
        },
      });

      sendSuccess(res, {
        sessionId,
        sessionToken,
        provider,
        placementId,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err) {
      console.error('[AdController.createSession] Error:', err);
      sendError(res, 'Internal server error creating ad session', 500, 'INTERNAL_ERROR');
    }
  }

  /**
   * POST /api/v1/ads/session/complete
   * Cryptographically verifies session completion and idempotently credits daily quest progress.
   */
  public static async completeSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
        return;
      }

      const { sessionId, sessionToken, viewDurationMs } = req.body as {
        sessionId?: string;
        sessionToken?: string;
        viewDurationMs?: number;
      };

      if (!sessionId || !sessionToken) {
        sendError(res, 'Missing required sessionId or sessionToken parameter', 400, 'MISSING_PARAMETERS');
        return;
      }

      const now = new Date();
      const startOfToday = getUtcDayStart(now);

      const result = await prisma.$transaction(async (tx) => {
        const session = await tx.adSession.findUnique({
          where: { id: sessionId },
        });

        if (!session) {
          return { errorStatus: 404, errorCode: 'SESSION_NOT_FOUND', errorMsg: 'Ad session not found' } as const;
        }

        if (session.userId !== userId) {
          return { errorStatus: 403, errorCode: 'FORBIDDEN', errorMsg: 'Session does not belong to this user' } as const;
        }

        // Idempotency: Reject if session was already completed or expired
        if (session.status === 'COMPLETED' || session.isCompleted) {
          return {
            errorStatus: 409,
            errorCode: 'SESSION_ALREADY_COMPLETED',
            errorMsg: 'This advertisement session has already been credited.',
          } as const;
        }

        if (session.status !== 'PENDING') {
          return {
            errorStatus: 400,
            errorCode: 'SESSION_NOT_ACTIVE',
            errorMsg: `Advertisement session is not active (status: ${session.status}).`,
          } as const;
        }

        if (new Date(session.expiresAt) < now) {
          await tx.adSession.update({
            where: { id: sessionId },
            data: { status: 'EXPIRED' },
          });
          return { errorStatus: 400, errorCode: 'SESSION_EXPIRED', errorMsg: 'Advertisement session has expired.' } as const;
        }

        // Verify HMAC Token
        const isTokenValid = AdController.verifySessionToken(
          session.id,
          session.userId,
          session.sessionNonce,
          session.expiresAt.getTime(),
          sessionToken
        );

        if (!isTokenValid) {
          return { errorStatus: 403, errorCode: 'INVALID_SESSION_TOKEN', errorMsg: 'Tampered or invalid session token.' } as const;
        }

        // Verify minimum view duration (prevent zero-second bot callbacks)
        const duration = Number(viewDurationMs) || 0;
        if (duration < MIN_VIEW_DURATION_MS) {
          return {
            errorStatus: 400,
            errorCode: 'VIEW_DURATION_TOO_SHORT',
            errorMsg: 'Advertisement was dismissed too early. Please watch the full ad.',
          } as const;
        }

        // Mark session completed atomically
        await tx.adSession.update({
          where: { id: sessionId },
          data: {
            status: 'COMPLETED',
            isCompleted: true,
            completedAt: now,
            viewDurationMs: duration,
          },
        });

        // Update User Daily Watch 30 Ads Mission
        const existingMission = await tx.userMission.findUnique({
          where: { userId_missionId: { userId, missionId: WATCH_ADS_MISSION_ID } },
        });

        const isFromPreviousDay =
          Boolean(existingMission?.claimedAt && new Date(existingMission.claimedAt) < startOfToday) ||
          Boolean(existingMission?.updatedAt && new Date(existingMission.updatedAt) < startOfToday);

        const currentProgress = !existingMission || isFromPreviousDay ? 0 : existingMission.progress;
        const nextProgress = Math.min(WATCH_ADS_DAILY_TARGET, currentProgress + 1);
        const nextVerified = nextProgress >= WATCH_ADS_DAILY_TARGET;
        const nextStatus = nextVerified ? 'COMPLETED' : 'IN_PROGRESS';

        await tx.userMission.upsert({
          where: { userId_missionId: { userId, missionId: WATCH_ADS_MISSION_ID } },
          create: {
            userId,
            missionId: WATCH_ADS_MISSION_ID,
            status: nextStatus,
            progress: nextProgress,
            total: WATCH_ADS_DAILY_TARGET,
          },
          update: {
            status: nextStatus,
            progress: nextProgress,
            total: WATCH_ADS_DAILY_TARGET,
            ...(isFromPreviousDay ? { claimedAt: null } : {}),
          },
        });

        return {
          verified: true,
          missionProgress: nextProgress,
          total: WATCH_ADS_DAILY_TARGET,
          isQuestCompleted: nextVerified,
        } as const;
      });

      if ('errorMsg' in result && result.errorMsg) {
        sendError(res, result.errorMsg, result.errorStatus, result.errorCode);
        return;
      }

      let adWithdrawalUnlocked = false;
      if (result.isQuestCompleted) {
        try {
          const entitlement = await WithdrawalEntitlementService.getUserEntitlement(userId);
          if (entitlement.remainingWithdrawals > 0) {
            adWithdrawalUnlocked = true;
          }
        } catch (e) {
          console.error('[AdController] Entitlement check error:', e);
        }
      }

      sendSuccess(res, {
        completed: true,
        sessionId,
        progress: result.missionProgress,
        total: result.total,
        isQuestCompleted: result.isQuestCompleted,
        adWithdrawalUnlocked,
        message: adWithdrawalUnlocked
          ? '🎉 Congratulations! You completed 30 ads today and unlocked a FREE withdrawal request (5/5 Days completed)!'
          : result.isQuestCompleted
          ? 'Congratulations! You reached 30/30 daily ads. Claim your 500 TomCoins reward!'
          : `Advertisement recorded successfully (${result.missionProgress}/${result.total})!`,
      });
    } catch (err) {
      console.error('[AdController.completeSession] Error:', err);
      sendError(res, 'Internal server error completing ad session', 500, 'INTERNAL_ERROR');
    }
  }

  /**
   * GET /api/v1/ads/session/:id
   * Fetches status of an ad session.
   */
  public static async getSessionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!userId || !id) {
        sendError(res, 'Unauthorized or missing session ID', 400, 'BAD_REQUEST');
        return;
      }

      const session = await prisma.adSession.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          provider: true,
          placementId: true,
          status: true,
          isCompleted: true,
          viewDurationMs: true,
          createdAt: true,
          completedAt: true,
          expiresAt: true,
        },
      });

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found', 404, 'NOT_FOUND');
        return;
      }

      sendSuccess(res, session);
    } catch (err) {
      console.error('[AdController.getSessionStatus] Error:', err);
      sendError(res, 'Failed to retrieve session status', 500, 'INTERNAL_ERROR');
    }
  }
}
