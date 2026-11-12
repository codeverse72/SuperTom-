/**
 * Adexium Rewarded Advertisement Controller
 * 
 * Implements a strict, server-verified rewarded ad lifecycle:
 * 1. Validates Telegram WebApp authentication freshness (anti-replay check).
 * 2. Creates an immutable backend ad session via POST /api/v1/ads/session/create.
 * 3. Invokes the official Adexium SDK methods without manipulating undocumented internals.
 * 4. Manages frontend lifecycle states preventing duplicate show attempts (0x191).
 * 5. Verifies completion cryptographically on the backend before crediting rewards.
 */

import { adService, CompleteAdSessionResponse } from '../services/adService';
import { getRawTelegramInitData } from './telegram';

export type AdLifecycleState =
  | 'READY'
  | 'LOADING_AD'
  | 'AD_RUNNING'
  | 'VERIFYING_REWARD'
  | 'REWARD_CREDITED'
  | 'NO_AD_AVAILABLE'
  | 'FAILED'
  | 'SESSION_EXPIRED';

export interface AdexiumWidgetInstance {
  on: (event: string, cb: (...args: any[]) => void) => void;
  off: (event: string, cb: (...args: any[]) => void) => void;
  requestAd?: (adFormat?: string, motivated?: boolean) => Promise<unknown[]>;
  requestRewardedAd?: (adFormat?: string) => void;
  displayAd: (ad: unknown, adFormat?: string) => void;
}

export interface AdexiumWidgetConstructor {
  new (config: { wid: string; adFormat: string }): AdexiumWidgetInstance;
}

declare global {
  interface Window {
    AdexiumWidget?: AdexiumWidgetConstructor;
    adexiumWidget?: AdexiumWidgetInstance;
    __adexiumWidget?: AdexiumWidgetInstance;
  }
}

export interface AdSessionResult {
  completed: boolean;
  state: AdLifecycleState;
  message?: string;
  sessionData?: CompleteAdSessionResponse;
}

export const DEFAULT_ADEXIUM_WID = 'b073a77c-3963-43dc-a846-99b5382cd341';
const AD_REQUEST_TIMEOUT_MS = 45_000;
const MAX_TELEGRAM_AUTH_AGE_SECONDS = 900; // 15 minutes max age required by Adexium

let currentActiveSession: Promise<AdSessionResult> | null = null;

/**
 * Checks if the current Telegram WebApp authentication is fresh (< 15 mins).
 */
export function checkTelegramAuthFreshness(): { isFresh: boolean; reason?: string } {
  const initData = getRawTelegramInitData();
  if (!initData) {
    return {
      isFresh: false,
      reason: 'No Telegram authentication context found. Please open SuperTom inside Telegram.',
    };
  }

  try {
    const params = new URLSearchParams(initData);
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      return { isFresh: false, reason: 'Missing auth_date in Telegram initialization data.' };
    }

    const authDate = parseInt(authDateStr, 10);
    if (isNaN(authDate)) {
      return { isFresh: false, reason: 'Invalid auth_date format.' };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ageSeconds = nowSeconds - authDate;

    if (ageSeconds > MAX_TELEGRAM_AUTH_AGE_SECONDS) {
      return {
        isFresh: false,
        reason: 'Your Telegram session has expired. Please close and reopen SuperTom from @SuperrTombot.',
      };
    }

    return { isFresh: true };
  } catch {
    return { isFresh: false, reason: 'Failed to parse Telegram session context.' };
  }
}

/**
 * Retrieves or safely instantiates the Adexium singleton widget.
 */
export function getAdexiumWidget(): AdexiumWidgetInstance | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (window.__adexiumWidget) {
    return window.__adexiumWidget;
  }

  if (window.adexiumWidget) {
    return window.adexiumWidget;
  }

  if (window.AdexiumWidget) {
    try {
      const widget = new window.AdexiumWidget({
        wid: DEFAULT_ADEXIUM_WID,
        adFormat: 'interstitial',
      });
      window.__adexiumWidget = widget;
      return widget;
    } catch (err) {
      console.warn('[Adexium] SDK initialization deferred:', err);
    }
  }

  return null;
}

/**
 * Starts a server-verified rewarded ad session.
 * 
 * @param onStateChange Optional lifecycle callback to update the Watch Ad button UI
 */
export async function runServerVerifiedAdSession(
  onStateChange?: (state: AdLifecycleState, statusText?: string) => void
): Promise<AdSessionResult> {
  // Prevent duplicate concurrent advertisement requests
  if (currentActiveSession) {
    return {
      completed: false,
      state: 'FAILED',
      message: 'An advertisement session is already in progress.',
    };
  }

  currentActiveSession = (async (): Promise<AdSessionResult> => {
    // 1. Verify Telegram Authentication Freshness (Adexium 0x3 mitigation)
    const authCheck = checkTelegramAuthFreshness();
    if (!authCheck.isFresh) {
      onStateChange?.('SESSION_EXPIRED', authCheck.reason);
      return {
        completed: false,
        state: 'SESSION_EXPIRED',
        message: authCheck.reason,
      };
    }

    onStateChange?.('LOADING_AD', 'Connecting to secure ad server...');

    // 2. Obtain SDK Widget Instance (wait up to 3s if hydrating)
    let widget = getAdexiumWidget();
    if (!widget) {
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 500));
        widget = getAdexiumWidget();
        if (widget) break;
      }
    }

    if (!widget) {
      onStateChange?.('FAILED', 'Ad service unavailable. Please check your connection or ad blocker.');
      return {
        completed: false,
        state: 'FAILED',
        message: 'Ad service unavailable. Please disable ad blockers and reopen in Telegram.',
      };
    }

    // 3. Create Unique Backend Session (Idempotency & Replay Protection)
    const sessionRes = await adService.createSession();
    if (!sessionRes.success || !sessionRes.data) {
      const errCode = sessionRes.error?.code;
      const errMsg = sessionRes.error?.message || 'Failed to start ad session.';

      if (errCode === 'MISSION_ALREADY_CLAIMED') {
        onStateChange?.('REWARD_CREDITED', errMsg);
        return { completed: false, state: 'REWARD_CREDITED', message: errMsg };
      }

      if (errCode === 'TELEGRAM_SESSION_EXPIRED') {
        onStateChange?.('SESSION_EXPIRED', errMsg);
        return { completed: false, state: 'SESSION_EXPIRED', message: errMsg };
      }

      onStateChange?.('FAILED', errMsg);
      return { completed: false, state: 'FAILED', message: errMsg };
    }

    const { sessionId, sessionToken } = sessionRes.data;

    // 4. Request and Display Adexium Advertisement via Official SDK Lifecycle
    return new Promise<AdSessionResult>((resolve) => {
      let settled = false;
      let adDisplayed = false;
      let displayStartTime = 0;

      const cleanupListeners = () => {
        clearTimeout(timeoutId);
        widget!.off('adReceived', handleAdReceived);
        widget!.off('adDisplayed', handleAdDisplayed);
        widget!.off('adPlaybackCompleted', handleAdCompleted);
        widget!.off('adRedirected', handleAdCompleted);
        widget!.off('adClosed', handleAdClosed);
        widget!.off('noAdFound', handleNoAdFound);
        widget!.off('requestAdError', handleRequestError);
      };

      const finish = (result: AdSessionResult) => {
        if (settled) return;
        settled = true;
        cleanupListeners();
        resolve(result);
      };

      const timeoutId = window.setTimeout(() => {
        onStateChange?.('FAILED', 'Ad request timed out. Please try again.');
        finish({
          completed: false,
          state: 'FAILED',
          message: 'Advertisement request timed out. Please try again shortly.',
        });
      }, AD_REQUEST_TIMEOUT_MS);

      const handleAdReceived = (ad: unknown, format?: string) => {
        try {
          widget!.displayAd(ad, format || 'interstitial');
        } catch (err) {
          console.warn('[Adexium] displayAd error:', err);
          onStateChange?.('FAILED', 'Failed to display advertisement.');
          finish({
            completed: false,
            state: 'FAILED',
            message: 'Failed to display advertisement.',
          });
        }
      };

      const handleAdDisplayed = () => {
        adDisplayed = true;
        displayStartTime = Date.now();
        onStateChange?.('AD_RUNNING', 'Advertisement in progress...');
      };

      const handleAdCompleted = () => {
        // Will settle in handleAdClosed
      };

      const handleAdClosed = async () => {
        if (!adDisplayed) {
          onStateChange?.('FAILED', 'Advertisement closed before displaying.');
          finish({
            completed: false,
            state: 'FAILED',
            message: 'Advertisement was closed before display completed.',
          });
          return;
        }

        const viewDurationMs = Date.now() - displayStartTime;

        onStateChange?.('VERIFYING_REWARD', 'Verifying advertisement completion...');

        try {
          const verifyRes = await adService.completeSession(sessionId, sessionToken, viewDurationMs);

          if (!verifyRes.success || !verifyRes.data) {
            const msg = verifyRes.error?.message || 'Failed to verify advertisement completion.';
            onStateChange?.('FAILED', msg);
            finish({
              completed: false,
              state: 'FAILED',
              message: msg,
            });
            return;
          }

          onStateChange?.('REWARD_CREDITED', verifyRes.data.message || 'Reward credited successfully!');
          finish({
            completed: true,
            state: 'REWARD_CREDITED',
            message: verifyRes.data.message,
            sessionData: verifyRes.data,
          });
        } catch (err) {
          console.error('[Adexium] Complete session request failed:', err);
          onStateChange?.('FAILED', 'Network error verifying reward.');
          finish({
            completed: false,
            state: 'FAILED',
            message: 'Network error verifying reward. Please check your connection.',
          });
        }
      };

      const handleNoAdFound = () => {
        onStateChange?.('NO_AD_AVAILABLE', 'No sponsored ads available right now.');
        finish({
          completed: false,
          state: 'NO_AD_AVAILABLE',
          message: 'No sponsored ads are available in your region right now. Please try again shortly.',
        });
      };

      const handleRequestError = () => {
        onStateChange?.('FAILED', 'Ad could not load.');
        finish({
          completed: false,
          state: 'FAILED',
          message: 'Ad could not load. Please check your connection or reopen in Telegram.',
        });
      };

      // Register official SDK event listeners
      widget!.on('adReceived', handleAdReceived);
      widget!.on('adDisplayed', handleAdDisplayed);
      widget!.on('adPlaybackCompleted', handleAdCompleted);
      widget!.on('adRedirected', handleAdCompleted);
      widget!.on('adClosed', handleAdClosed);
      widget!.on('noAdFound', handleNoAdFound);
      widget!.on('requestAdError', handleRequestError);

      // Trigger request using standard Adexium SDK methods
      try {
        if (typeof widget!.requestAd === 'function') {
          widget!.requestAd('interstitial', false).catch((err) => {
            console.warn('[Adexium] requestAd rejected:', err);
            handleRequestError();
          });
        } else if (typeof widget!.requestRewardedAd === 'function') {
          widget!.requestRewardedAd('interstitial');
        } else {
          handleRequestError();
        }
      } catch (err) {
        console.warn('[Adexium] SDK call failed:', err);
        handleRequestError();
      }
    });
  })();

  try {
    return await currentActiveSession;
  } finally {
    currentActiveSession = null;
  }
}

/**
 * Backward-compatible alias for runServerVerifiedAdSession.
 */
export const showAdexiumRewardedAd = runServerVerifiedAdSession;

