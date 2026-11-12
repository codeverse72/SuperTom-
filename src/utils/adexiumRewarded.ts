/**
 * Adexium Rewarded Ad integration helper for Daily Watch Ads missions.
 * Uses AdexiumWidget.requestRewardedAd('interstitial') and resolves ONLY when
 * an actual ad completes playback, is redirected on click, or is closed after display.
 */

export interface AdexiumWidgetInstance {
  on: (event: string, cb: (...args: any[]) => void) => void;
  off: (event: string, cb: (...args: any[]) => void) => void;
  requestRewardedAd: (adFormat?: string) => void;
  displayAd: (ad: unknown) => void;
  autoMode: () => void;
}

export interface AdexiumWidgetConstructor {
  new (config: { wid: string; adFormat: string }): AdexiumWidgetInstance;
}

declare global {
  interface Window {
    AdexiumWidget?: AdexiumWidgetConstructor;
    __adexiumWidget?: AdexiumWidgetInstance;
    __adexiumRewardedWidget?: AdexiumWidgetInstance;
  }
}

export interface RewardedAdResult {
  completed: boolean;
  reason?: 'sdk_unavailable' | 'busy' | 'no_ad' | 'error' | 'timeout' | 'closed_early';
  message?: string;
}

const DEFAULT_ADEXIUM_WID = 'dd81f1ec-401b-498c-a2f3-0a4bb0032b59';
const AD_REQUEST_TIMEOUT_MS = 60_000;

let activeAdPromise: Promise<RewardedAdResult> | null = null;

function getAdexiumRewardedWidget(): AdexiumWidgetInstance | null {
  if (typeof window === 'undefined' || !window.AdexiumWidget) {
    return null;
  }

  const configuredWid =
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ADEXIUM_REWARDED_WID?.trim() ||
    DEFAULT_ADEXIUM_WID;

  // Keep a dedicated widget instance separate from autoMode() so background
  // auto-fetch ticks (every 10s) cannot emit stray 'noAdFound'/'adReceived' events.
  if (!window.__adexiumRewardedWidget) {
    window.__adexiumRewardedWidget = new window.AdexiumWidget({
      wid: configuredWid,
      adFormat: 'interstitial',
    });
  }

  return window.__adexiumRewardedWidget;
}

/**
 * Triggers an Adexium rewarded interstitial ad and waits for completion.
 */
export function showAdexiumRewardedAd(): Promise<RewardedAdResult> {
  if (activeAdPromise) {
    return Promise.resolve({
      completed: false,
      reason: 'busy',
      message: 'An ad is already loading or playing.',
    });
  }

  let widget: AdexiumWidgetInstance | null = null;
  try {
    widget = getAdexiumRewardedWidget();
  } catch (err) {
    return Promise.resolve({
      completed: false,
      reason: 'sdk_unavailable',
      message: err instanceof Error ? err.message : 'Unable to initialize Adexium ads in this environment.',
    });
  }

  if (!widget || typeof widget.requestRewardedAd !== 'function') {
    return Promise.resolve({
      completed: false,
      reason: 'sdk_unavailable',
      message: 'Ad service is still loading or blocked. Please disable ad blockers and try again inside Telegram.',
    });
  }

  activeAdPromise = new Promise<RewardedAdResult>((resolve) => {
    let settled = false;
    let adDisplayed = false;
    let playbackCompleted = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      widget!.off('adReceived', onAdReceived);
      widget!.off('adDisplayed', onAdDisplayed);
      widget!.off('adPlaybackCompleted', onPlaybackCompleted);
      widget!.off('adRedirected', onRedirected);
      widget!.off('adClosed', onClosed);
      widget!.off('noAdFound', onNoAdFound);
      widget!.off('requestAdError', onRequestError);
      activeAdPromise = null;
    };

    const finish = (result: RewardedAdResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish({
        completed: false,
        reason: 'timeout',
        message: 'Ad request timed out. Please try again in a moment.',
      });
    }, AD_REQUEST_TIMEOUT_MS);

    const onAdReceived = (ad: unknown) => {
      try {
        widget!.displayAd(ad);
      } catch {
        finish({
          completed: false,
          reason: 'error',
          message: 'Failed to display the ad. Please try again.',
        });
      }
    };

    const onAdDisplayed = () => {
      adDisplayed = true;
    };

    const onPlaybackCompleted = () => {
      playbackCompleted = true;
      finish({ completed: true });
    };

    const onRedirected = () => {
      playbackCompleted = true;
      finish({ completed: true });
    };

    const onClosed = () => {
      if (playbackCompleted || adDisplayed) {
        finish({ completed: true });
      } else {
        finish({
          completed: false,
          reason: 'closed_early',
          message: 'Ad was closed before completing.',
        });
      }
    };

    const onNoAdFound = () => {
      finish({
        completed: false,
        reason: 'no_ad',
        message: 'No sponsored ads are available right now. Please try again shortly.',
      });
    };

    const onRequestError = () => {
      finish({
        completed: false,
        reason: 'error',
        message: 'Ad could not load. Please check your connection or open inside Telegram.',
      });
    };

    widget!.on('adReceived', onAdReceived);
    widget!.on('adDisplayed', onAdDisplayed);
    widget!.on('adPlaybackCompleted', onPlaybackCompleted);
    widget!.on('adRedirected', onRedirected);
    widget!.on('adClosed', onClosed);
    widget!.on('noAdFound', onNoAdFound);
    widget!.on('requestAdError', onRequestError);

    try {
      widget!.requestRewardedAd('interstitial');
    } catch {
      finish({
        completed: false,
        reason: 'error',
        message: 'Failed to request an ad. Please try again.',
      });
    }
  });

  return activeAdPromise;
}

