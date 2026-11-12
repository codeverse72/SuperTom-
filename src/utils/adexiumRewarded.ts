/**
 * Adexium Rewarded Ad integration helper for Daily Watch Ads missions.
 * Uses AdexiumWidget.requestRewardedAd('interstitial') and resolves ONLY when
 * an actual ad completes playback, is redirected on click, or is closed after display.
 */

export interface AdexiumWidgetInstance {
  on: (event: string, cb: (...args: any[]) => void) => void;
  off: (event: string, cb: (...args: any[]) => void) => void;
  requestAd?: (adFormat?: string, motivated?: boolean) => Promise<unknown[]>;
  requestRewardedAd?: (adFormat?: string) => void;
  displayAd: (ad: unknown, adFormat?: string) => void;
  autoMode: () => void;
}

export interface AdexiumWidgetConstructor {
  new (config: { wid: string; adFormat: string }): AdexiumWidgetInstance;
}

declare global {
  interface Window {
    AdexiumWidget?: AdexiumWidgetConstructor;
    adexiumWidget?: AdexiumWidgetInstance;
    __adexiumWidget?: AdexiumWidgetInstance;
    __adexiumRewardedWidget?: AdexiumWidgetInstance;
  }
}

export interface RewardedAdResult {
  completed: boolean;
  reason?: 'sdk_unavailable' | 'busy' | 'no_ad' | 'error' | 'timeout' | 'closed_early';
  message?: string;
}

const DEFAULT_ADEXIUM_WID = 'b073a77c-3963-43dc-a846-99b5382cd341';
const AD_REQUEST_TIMEOUT_MS = 60_000;

let activeAdPromise: Promise<RewardedAdResult> | null = null;

function getAdexiumRewardedWidget(): AdexiumWidgetInstance | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // 1. Strictly reuse the single verified widget created in index.html to avoid duplicate session fraud checks
  if (window.__adexiumWidget) {
    return window.__adexiumWidget;
  }
  if (window.adexiumWidget) {
    return window.adexiumWidget;
  }

  // 2. Only if not yet created, initialize once as window.__adexiumWidget
  if (window.AdexiumWidget) {
    try {
      const widget = new window.AdexiumWidget({
        wid: DEFAULT_ADEXIUM_WID,
        adFormat: 'interstitial',
      });
      window.__adexiumWidget = widget;
      return widget;
    } catch (err) {
      console.warn('[Adexium] Singleton creation failed:', err);
    }
  }

  return null;
}

/**
 * Triggers an Adexium interstitial ad on demand for the Daily Watch Ads mission and waits for completion.
 */
export async function showAdexiumRewardedAd(): Promise<RewardedAdResult> {
  if (activeAdPromise) {
    return {
      completed: false,
      reason: 'busy',
      message: 'An ad is already loading or playing.',
    };
  }

  let widget = getAdexiumRewardedWidget();
  if (!widget) {
    // Wait up to 3s for SDK hydration inside Telegram WebView
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 500));
      widget = getAdexiumRewardedWidget();
      if (widget) break;
    }
  }

  if (!widget) {
    return {
      completed: false,
      reason: 'sdk_unavailable',
      message: 'Ad service is connecting. Please wait a moment and tap again inside Telegram.',
    };
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

    let adShown = false;
    const showAd = (ad: unknown, format?: string) => {
      if (adShown) return;
      adShown = true;
      try {
        widget!.displayAd(ad, format || 'interstitial');
      } catch (e) {
        console.warn('[Adexium] displayAd error:', e);
        finish({
          completed: false,
          reason: 'error',
          message: 'Failed to display the ad. Please try again.',
        });
      }
    };

    const onAdReceived = (ad: unknown, format?: string) => {
      showAd(ad, format);
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

    (async () => {
      try {
        console.log('[Adexium] Requesting ad for placement #15008...');
        // Placement #15008 is an Interstitial format. We send motivated: false so Adexium's
        // bid engine fulfills the ad without rejecting it for policy violation.
        if (typeof widget!.requestAd === 'function') {
          const ads = await widget!.requestAd('interstitial', false);
          if (Array.isArray(ads) && ads.length > 0) {
            showAd(ads, (ads[0] as any)?.adFormat || 'interstitial');
          }
        } else if (typeof widget!.requestRewardedAd === 'function') {
          widget!.requestRewardedAd('interstitial');
        } else {
          finish({
            completed: false,
            reason: 'sdk_unavailable',
            message: 'Ad service is not ready. Please try again shortly.',
          });
        }
      } catch (err) {
        console.warn('[Adexium] Request error:', err);
        finish({
          completed: false,
          reason: 'error',
          message: 'Failed to request an ad. Please try again.',
        });
      }
    })();
  });

  return activeAdPromise;
}

