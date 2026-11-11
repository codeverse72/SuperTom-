/**
 * Adexium Telegram Mini App Interstitial Integration
 *
 * Manages the official Adexium TMA widget lifecycle across SuperTom:
 * - Only initializes inside genuine Telegram Mini App sessions (required by Adexium & TMA policy).
 * - Fires an initial interstitial check shortly after launch plus periodic checks while active.
 * - Exposes non-motivated transition breaks (tab switches, closing Feed/Spin modals) with cooldowns.
 * - Pauses completely on `/admin`, Deposit/Withdrawal checkout (`payout`), open modals, and hidden tabs.
 */

const DEFAULT_ADEXIUM_WID = 'dd81f1ec-401b-498c-a2f3-0a4bb0032b59';
const ADEXIUM_SCRIPT_SELECTOR = 'script[src*="cdn.tgads.space/assets/js/adexium-widget.min.js"]';

const FIRST_AD_DELAY_MS = 10_000;
const HEARTBEAT_INTERVAL_MS = 45_000;
const AD_DISPLAY_COOLDOWN_MS = 45_000;
const AD_RETRY_COOLDOWN_MS = 15_000;

export type AdexiumBreakTrigger =
  | 'initial'
  | 'heartbeat'
  | 'tab_switch'
  | 'spin_complete'
  | 'feed_complete';

interface AdexiumWidgetConfig {
  wid: string;
  adFormat: 'interstitial' | 'push-like' | 'video';
  debug?: boolean;
  isFullScreen?: boolean;
  firstAdImpressionIntervalInSeconds?: number;
  adImpressionIntervalInSeconds?: number;
}

interface AdexiumWidgetInstance {
  requestAd: (format: 'interstitial' | 'push-like' | 'video') => Promise<unknown[] | undefined>;
  displayAd: (ads: unknown[], format?: string) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => () => void;
  autoMode: () => void;
}

type AdexiumWidgetConstructor = new (config: AdexiumWidgetConfig) => AdexiumWidgetInstance;

declare global {
  interface Window {
    AdexiumWidget?: AdexiumWidgetConstructor;
  }
}

let widgetInstance: AdexiumWidgetInstance | null = null;
let isRequestInFlight = false;
let lastAdDisplayedAt = 0;
let lastAdAttemptAt = 0;
let pendingBreakTimer: number | null = null;
const pausedReasons = new Set<string>();

/**
 * Checks whether Telegram WebApp launch context is present so standalone
 * desktop browsers and Adexium's non-emulated TMA rules are respected.
 */
function hasTelegramUserContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    return true;
  }
  try {
    const rawParams =
      window.sessionStorage.getItem('__telegram__initParams') ||
      window.sessionStorage.getItem('tapps/launchParams') ||
      window.sessionStorage.getItem('telegram-apps/launch-params') ||
      window.sessionStorage.getItem('tma.js/launch-params');
    return Boolean(rawParams && rawParams.includes('tgWebAppData') && rawParams.includes('user'));
  } catch {
    return false;
  }
}

function getOrCreateWidget(): AdexiumWidgetInstance | null {
  if (widgetInstance) return widgetInstance;
  if (typeof window === 'undefined' || !window.AdexiumWidget || !hasTelegramUserContext()) {
    return null;
  }

  const envWid = (import.meta.env.VITE_ADEXIUM_WID as string | undefined)?.trim();
  const wid = envWid || DEFAULT_ADEXIUM_WID;

  try {
    const instance = new window.AdexiumWidget({
      wid,
      adFormat: 'interstitial',
    });

    instance.on('adReceived', (adsArg: unknown) => {
      if (Array.isArray(adsArg) && adsArg.length > 0) {
        instance.displayAd(adsArg);
      }
    });

    instance.on('adDisplayed', () => {
      lastAdDisplayedAt = Date.now();
      isRequestInFlight = false;
    });

    instance.on('noAdFound', () => {
      isRequestInFlight = false;
    });

    instance.on('requestAdError', () => {
      isRequestInFlight = false;
    });

    widgetInstance = instance;
    return widgetInstance;
  } catch (err) {
    console.warn('[Adexium] Failed to initialize widget:', err);
    return null;
  }
}

function canTriggerAdNow(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (document.hidden || pausedReasons.size > 0 || isRequestInFlight) return false;
  if (!hasTelegramUserContext()) return false;

  const now = Date.now();
  if (lastAdDisplayedAt > 0 && now - lastAdDisplayedAt < AD_DISPLAY_COOLDOWN_MS) {
    return false;
  }
  if (lastAdAttemptAt > 0 && now - lastAdAttemptAt < AD_RETRY_COOLDOWN_MS) {
    return false;
  }
  return true;
}

async function triggerInterstitialRequest(_reason: AdexiumBreakTrigger): Promise<void> {
  if (!canTriggerAdNow()) return;

  const widget = getOrCreateWidget();
  if (!widget) return;

  isRequestInFlight = true;
  lastAdAttemptAt = Date.now();

  try {
    await widget.requestAd('interstitial');
  } catch (err) {
    console.warn('[Adexium] Ad request failed:', err);
  } finally {
    isRequestInFlight = false;
  }
}

/**
 * Temporarily pauses or resumes interstitial triggers for a named UI state
 * (e.g., Deposit/Withdrawal screen, active Spin wheel, or Admin routes).
 */
export function setAdPaused(reason: string, paused: boolean): void {
  if (paused) {
    pausedReasons.add(reason);
    if (pendingBreakTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(pendingBreakTimer);
      pendingBreakTimer = null;
    }
  } else {
    pausedReasons.delete(reason);
  }
}

/**
 * Requests a non-motivated interstitial transition if cooldowns and UI state permit.
 */
export function requestAdBreak(reason: AdexiumBreakTrigger, delayMs = 0): void {
  if (typeof window === 'undefined' || pausedReasons.size > 0) return;

  if (delayMs <= 0) {
    void triggerInterstitialRequest(reason);
    return;
  }

  if (pendingBreakTimer !== null) {
    window.clearTimeout(pendingBreakTimer);
  }
  pendingBreakTimer = window.setTimeout(() => {
    pendingBreakTimer = null;
    void triggerInterstitialRequest(reason);
  }, delayMs);
}

/**
 * Initializes the Adexium SDK integration for SuperTom Mini App sessions.
 * Schedules the initial check + active heartbeat and returns a cleanup callback.
 */
export function initAdexiumAutoAds(): () => void {
  if (typeof window === 'undefined' || !hasTelegramUserContext()) {
    return () => {};
  }

  let initialTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let scriptEl: HTMLScriptElement | null = null;
  let scriptLoadHandler: (() => void) | null = null;

  const startLifecycle = () => {
    getOrCreateWidget();
    if (initialTimer === null) {
      initialTimer = window.setTimeout(() => {
        void triggerInterstitialRequest('initial');
      }, FIRST_AD_DELAY_MS);
    }
    if (heartbeatTimer === null) {
      heartbeatTimer = window.setInterval(() => {
        void triggerInterstitialRequest('heartbeat');
      }, HEARTBEAT_INTERVAL_MS);
    }
  };

  if (window.AdexiumWidget) {
    startLifecycle();
  } else {
    scriptEl = document.querySelector<HTMLScriptElement>(ADEXIUM_SCRIPT_SELECTOR);
    if (scriptEl) {
      scriptLoadHandler = () => {
        startLifecycle();
      };
      scriptEl.addEventListener('load', scriptLoadHandler, { once: true });
    }
  }

  return () => {
    if (initialTimer !== null) {
      window.clearTimeout(initialTimer);
    }
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
    }
    if (pendingBreakTimer !== null) {
      window.clearTimeout(pendingBreakTimer);
      pendingBreakTimer = null;
    }
    if (scriptEl && scriptLoadHandler) {
      scriptEl.removeEventListener('load', scriptLoadHandler);
    }
  };
}
