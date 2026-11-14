/**
 * Multi-Provider Rewarded Advertisement Controller (Adexium + Adsgram in Parallel)
 * 
 * Implements a strict, server-verified rewarded ad lifecycle:
 * 1. Validates Telegram WebApp authentication freshness (anti-replay check).
 * 2. Runs Adexium (Placement dd81f1ec-401b-498c-a2f3-0a4bb0032b59) and Adsgram (Unit 59392) in parallel.
 * 3. Alternates primary delivery across impressions (round-robin / dual active mediation).
 * 4. Cross-network automatic fallback if one provider has no inventory or encounters an error.
 * 5. Creates an immutable backend ad session via POST /api/v1/ads/session/create.
 * 6. Prevents duplicate show attempts (0x191) with promise locking.
 * 7. Verifies completion cryptographically on the backend before crediting rewards.
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

export interface AdsgramShowPromiseResult {
  done: boolean;
  description?: string;
  state?: 'load' | 'render' | 'playing' | 'destroy';
  error?: boolean;
}

export interface AdsgramAdController {
  show: () => Promise<AdsgramShowPromiseResult>;
  destroy: () => void;
}

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
    Adsgram?: {
      init: (config: {
        blockId: string;
        debug?: boolean;
        debugBannerType?: 'FullscreenMedia' | 'RewardedVideo';
      }) => AdsgramAdController;
    };
    AdexiumWidget?: AdexiumWidgetConstructor;
    adexiumWidget?: AdexiumWidgetInstance;
    __adexiumWidget?: AdexiumWidgetInstance;
  }
}

export interface AdSessionResult {
  completed: boolean;
  state: AdLifecycleState;
  provider?: 'adsgram' | 'adexium';
  message?: string;
  sessionData?: CompleteAdSessionResponse;
  canFallback?: boolean;
}

export const DEFAULT_ADSGRAM_BLOCK_ID = '59392';
export const DEFAULT_ADEXIUM_WID = 'dd81f1ec-401b-498c-a2f3-0a4bb0032b59';
const AD_REQUEST_TIMEOUT_MS = 45_000;
const MAX_TELEGRAM_AUTH_AGE_SECONDS = 900; // 15 minutes max age

let currentActiveSession: Promise<AdSessionResult> | null = null;
let lastServedProvider: 'adsgram' | 'adexium' = 'adexium';

function getAdsgramBlockId(): string {
  const envVal = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_ADSGRAM_REWARDED_BLOCK_ID?.trim();
  return envVal || DEFAULT_ADSGRAM_BLOCK_ID;
}

function getAdexiumWid(): string {
  const envVal = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_ADEXIUM_PLACEMENT_ID?.trim();
  return envVal || DEFAULT_ADEXIUM_WID;
}

/**
 * Checks if the current Telegram WebApp authentication is fresh (< 15 mins).
 */
export function checkTelegramAuthFreshness(): { isFresh: boolean; reason?: string } {
  const initData = getRawTelegramInitData();
  if (!initData) {
    const isDev = Boolean(
      (import.meta as any).env?.DEV ||
      (import.meta as any).env?.VITE_ADS_DEBUG === 'true' ||
      (typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.localStorage?.getItem('supertom_test_ads') === 'true'
      ))
    );
    if (isDev) {
      return { isFresh: true };
    }
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
        wid: getAdexiumWid(),
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
 * Executes an Adexium ad session with full event listeners, timeout handling, and server verification.
 */
async function runAdexiumSession(
  onStateChange?: (state: AdLifecycleState, statusText?: string) => void
): Promise<AdSessionResult> {
  let widget = getAdexiumWidget();
  if (!widget) {
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 400));
      widget = getAdexiumWidget();
      if (widget) break;
    }
  }

  if (!widget) {
    return {
      completed: false,
      state: 'NO_AD_AVAILABLE',
      provider: 'adexium',
      message: 'Adexium ad widget not initialized or unavailable.',
      canFallback: true,
    };
  }

  const sessionRes = await adService.createSession('adexium');
  if (!sessionRes.success || !sessionRes.data) {
    const errCode = sessionRes.error?.code;
    const msg = sessionRes.error?.message || 'Failed to start ad session.';
    if (errCode === 'MISSION_ALREADY_CLAIMED') {
      onStateChange?.('REWARD_CREDITED', msg);
      return { completed: false, state: 'REWARD_CREDITED', provider: 'adexium', message: msg, canFallback: false };
    }
    if (errCode === 'TELEGRAM_SESSION_EXPIRED') {
      onStateChange?.('SESSION_EXPIRED', msg);
      return { completed: false, state: 'SESSION_EXPIRED', provider: 'adexium', message: msg, canFallback: false };
    }
    return { completed: false, state: 'FAILED', provider: 'adexium', message: msg, canFallback: true };
  }

  const { sessionId, sessionToken } = sessionRes.data;

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
      finish({
        completed: false,
        state: 'FAILED',
        provider: 'adexium',
        message: 'Adexium advertisement request timed out.',
        canFallback: true,
      });
    }, AD_REQUEST_TIMEOUT_MS);

    const handleAdReceived = (ad: unknown, format?: string) => {
      try {
        widget!.displayAd(ad, format || 'interstitial');
      } catch (err) {
        console.warn('[Adexium] displayAd error:', err);
        finish({
          completed: false,
          state: 'FAILED',
          provider: 'adexium',
          message: 'Failed to display advertisement.',
          canFallback: true,
        });
      }
    };

    const handleAdDisplayed = () => {
      adDisplayed = true;
      displayStartTime = Date.now();
      onStateChange?.('AD_RUNNING', 'Advertisement in progress...');
    };

    const handleAdCompleted = () => {
      // Settle in handleAdClosed
    };

    const handleAdClosed = async () => {
      if (!adDisplayed) {
        finish({
          completed: false,
          state: 'FAILED',
          provider: 'adexium',
          message: 'Advertisement was closed before display completed.',
          canFallback: false,
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
            provider: 'adexium',
            message: msg,
            canFallback: false,
          });
          return;
        }

        onStateChange?.('REWARD_CREDITED', verifyRes.data.message || 'Reward credited successfully!');
        finish({
          completed: true,
          state: 'REWARD_CREDITED',
          provider: 'adexium',
          message: verifyRes.data.message,
          sessionData: verifyRes.data,
          canFallback: false,
        });
      } catch (err) {
        console.error('[Adexium] Complete session request failed:', err);
        const msg = 'Network error verifying reward. Please check your connection.';
        onStateChange?.('FAILED', msg);
        finish({
          completed: false,
          state: 'FAILED',
          provider: 'adexium',
          message: msg,
          canFallback: false,
        });
      }
    };

    const handleNoAdFound = () => {
      finish({
        completed: false,
        state: 'NO_AD_AVAILABLE',
        provider: 'adexium',
        message: 'No Adexium sponsored ads available right now.',
        canFallback: true,
      });
    };

    const handleRequestError = () => {
      finish({
        completed: false,
        state: 'FAILED',
        provider: 'adexium',
        message: 'Adexium ad could not load.',
        canFallback: true,
      });
    };

    widget!.on('adReceived', handleAdReceived);
    widget!.on('adDisplayed', handleAdDisplayed);
    widget!.on('adPlaybackCompleted', handleAdCompleted);
    widget!.on('adRedirected', handleAdCompleted);
    widget!.on('adClosed', handleAdClosed);
    widget!.on('noAdFound', handleNoAdFound);
    widget!.on('requestAdError', handleRequestError);

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
}

/**
 * Executes an Adsgram rewarded video session with timeout handling and server verification.
 */
async function runAdsgramSession(
  onStateChange?: (state: AdLifecycleState, statusText?: string) => void
): Promise<AdSessionResult> {
  let adsgramAvailable = typeof window !== 'undefined' && Boolean(window.Adsgram);
  if (!adsgramAvailable && typeof window !== 'undefined') {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 300));
      if (window.Adsgram) {
        adsgramAvailable = true;
        break;
      }
    }
  }

  if (!adsgramAvailable || !window.Adsgram?.init) {
    return {
      completed: false,
      state: 'NO_AD_AVAILABLE',
      provider: 'adsgram',
      message: 'Adsgram SDK not available.',
      canFallback: true,
    };
  }

  const sessionRes = await adService.createSession('adsgram');
  if (!sessionRes.success || !sessionRes.data) {
    const errCode = sessionRes.error?.code;
    const errMsg = sessionRes.error?.message || 'Failed to start ad session.';

    if (errCode === 'MISSION_ALREADY_CLAIMED') {
      onStateChange?.('REWARD_CREDITED', errMsg);
      return { completed: false, state: 'REWARD_CREDITED', provider: 'adsgram', message: errMsg, canFallback: false };
    }

    if (errCode === 'TELEGRAM_SESSION_EXPIRED') {
      onStateChange?.('SESSION_EXPIRED', errMsg);
      return { completed: false, state: 'SESSION_EXPIRED', provider: 'adsgram', message: errMsg, canFallback: false };
    }

    return { completed: false, state: 'FAILED', provider: 'adsgram', message: errMsg, canFallback: true };
  }

  const { sessionId, sessionToken } = sessionRes.data;
  const blockId = getAdsgramBlockId();

  const isDebugRequested =
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ADS_DEBUG === 'true' ||
    (typeof window !== 'undefined' && (
      new URLSearchParams(window.location.search).get('test_ads') === 'true' ||
      window.location.hash.includes('test_ads=true') ||
      window.localStorage?.getItem('supertom_test_ads') === 'true'
    ));

  try {
    const controller = window.Adsgram.init({
      blockId,
      debug: Boolean(isDebugRequested),
      debugBannerType: 'RewardedVideo',
    });
    onStateChange?.('AD_RUNNING', 'Advertisement in progress...');
    const startTime = Date.now();
    const result = await controller.show();

    if (result && result.done === true) {
      const viewDurationMs = Date.now() - startTime;
      onStateChange?.('VERIFYING_REWARD', 'Verifying advertisement completion...');

      const verifyRes = await adService.completeSession(sessionId, sessionToken, viewDurationMs);
      if (verifyRes.success && verifyRes.data) {
        onStateChange?.('REWARD_CREDITED', verifyRes.data.message || 'Reward credited successfully!');
        return {
          completed: true,
          state: 'REWARD_CREDITED',
          provider: 'adsgram',
          message: verifyRes.data.message,
          sessionData: verifyRes.data,
          canFallback: false,
        };
      } else {
        const msg = verifyRes.error?.message || 'Failed to verify advertisement completion.';
        onStateChange?.('FAILED', msg);
        return { completed: false, state: 'FAILED', provider: 'adsgram', message: msg, canFallback: false };
      }
    } else {
      const msg = 'Ad closed early. Watch until the timer finishes to earn progress.';
      onStateChange?.('FAILED', msg);
      return {
        completed: false,
        state: 'FAILED',
        provider: 'adsgram',
        message: msg,
        canFallback: false,
      };
    }
  } catch (err: unknown) {
    const errObj = err as Partial<AdsgramShowPromiseResult> & { message?: string };
    const desc = (errObj?.description || errObj?.message || '').toLowerCase();

    // If user explicitly skipped or closed early
    if (desc.includes('skip') || desc.includes('close') || desc.includes('abort') || desc.includes('cancel')) {
      const msg = 'Ad closed early. Watch until the timer finishes to earn progress.';
      onStateChange?.('FAILED', msg);
      return {
        completed: false,
        state: 'FAILED',
        provider: 'adsgram',
        message: msg,
        canFallback: false,
      };
    }

    console.warn('[Ads] Adsgram returned no ad or error:', err);
    return {
      completed: false,
      state: 'NO_AD_AVAILABLE',
      provider: 'adsgram',
      message: 'No Adsgram sponsored ads available right now.',
      canFallback: true,
    };
  }
}

/**
 * Starts a server-verified rewarded ad session utilizing both Adexium and Adsgram in parallel.
 * 
 * Parallel Serving Strategy:
 * 1. Alternates primary provider between Adexium (dd81f1ec-401b-498c-a2f3-0a4bb0032b59) and Adsgram (59392).
 * 2. If the chosen network has no inventory or errors, immediately cascades to the alternate network.
 * 3. Guarantees balanced distribution and maximum fill rate across both platforms.
 * 4. Verifies playback on the backend cryptographically before crediting quest / withdrawal progression.
 * 
 * @param onStateChange Optional lifecycle callback to update the Watch Ad button UI
 * @param preferredProvider Optional override to target 'adexium' or 'adsgram' directly
 */
export async function runServerVerifiedAdSession(
  onStateChange?: (state: AdLifecycleState, statusText?: string) => void,
  preferredProvider?: 'adsgram' | 'adexium'
): Promise<AdSessionResult> {
  // Prevent duplicate concurrent advertisement requests (0x191 prevention)
  if (currentActiveSession) {
    return {
      completed: false,
      state: 'FAILED',
      message: 'An advertisement session is already in progress.',
    };
  }

  currentActiveSession = (async (): Promise<AdSessionResult> => {
    // 1. Verify Telegram Authentication Freshness
    const authCheck = checkTelegramAuthFreshness();
    if (!authCheck.isFresh) {
      onStateChange?.('SESSION_EXPIRED', authCheck.reason);
      return {
        completed: false,
        state: 'SESSION_EXPIRED',
        message: authCheck.reason,
      };
    }

    // 2. Parallel Provider Selection: Alternate between Adexium and Adsgram
    const primaryProvider: 'adsgram' | 'adexium' =
      preferredProvider || (lastServedProvider === 'adexium' ? 'adsgram' : 'adexium');
    const fallbackProvider: 'adsgram' | 'adexium' =
      primaryProvider === 'adexium' ? 'adsgram' : 'adexium';

    onStateChange?.('LOADING_AD', `Connecting to ${primaryProvider === 'adexium' ? 'Adexium' : 'Adsgram'}...`);

    const primaryResult = primaryProvider === 'adexium'
      ? await runAdexiumSession(onStateChange)
      : await runAdsgramSession(onStateChange);

    if (primaryResult.completed) {
      lastServedProvider = primaryProvider;
      return primaryResult;
    }

    // 3. Parallel Failover: If primary has no fill/error, try alternate provider
    if (primaryResult.canFallback) {
      console.info(`[Ads] Parallel mediation: ${primaryProvider} unavailable/unfilled, switching to ${fallbackProvider}...`);
      onStateChange?.('LOADING_AD', `Connecting to ${fallbackProvider === 'adexium' ? 'Adexium' : 'Adsgram'}...`);

      const fallbackResult = fallbackProvider === 'adexium'
        ? await runAdexiumSession(onStateChange)
        : await runAdsgramSession(onStateChange);

      if (fallbackResult.completed) {
        lastServedProvider = fallbackProvider;
        return fallbackResult;
      }

      onStateChange?.(fallbackResult.state, fallbackResult.message || 'No sponsored ads available right now.');
      return fallbackResult;
    }

    return primaryResult;
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
