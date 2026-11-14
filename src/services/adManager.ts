/**
 * SuperTom Central Ad Frequency & Interstitial Controller
 *
 * Orchestrates cross-app ad impressions across high-value touchpoints:
 * - App Launch / Opening (after initial mount & auth setup)
 * - Tab Navigation (switching between Home, Store, Missions, Payout, Profile)
 * - In-Game Actions (feeding King Tom, claiming mining income, lucky wheel spins, opening deposit)
 * - Direct "Watch & Earn" triggers (Missions tab, Profile menu)
 *
 * Enforces intelligent frequency capping ("not continuously but often"):
 * - Smart cooldown: 50 seconds minimum between automatic interstitial impressions
 * - Action-based throttle for high-frequency actions (feeding / petting)
 * - Persistent throttle timestamp in sessionStorage to respect navigation & quick reloads
 * - Seamless Adsgram Primary (#59392) -> Adexium Fallback (#15008) cascade
 * - Completely non-blocking: network errors, ad blockers, or unfilled ads fail silently without disrupting gameplay
 * - Automatically credits backend ad sessions so passive views count towards the daily "Watch 30 Ads" quest & 5-day withdrawal unlock!
 */

import { runServerVerifiedAdSession, AdSessionResult } from '../utils/adexiumRewarded';

export type AdTriggerReason =
  | 'app_open'
  | 'tab_switch'
  | 'feed_tom'
  | 'spin_wheel'
  | 'claim_mining'
  | 'open_deposit'
  | 'chest_click'
  | 'manual';

export interface TriggerAdOptions {
  force?: boolean;
  silent?: boolean;
  onStateChange?: (state: string, text?: string) => void;
}

export interface TriggerAdResult {
  shown: boolean;
  completed: boolean;
  reason?: string;
  message?: string;
}

const STORAGE_KEY_LAST_AD = 'supertom_last_auto_ad_time';
const DEFAULT_COOLDOWN_MS = 50_000; // 50 seconds cooldown between automatic ads
const APP_OPEN_MIN_INTERVAL_MS = 40_000; // Minimum 40s since last ad to show on app open

class AdManager {
  private isAdActive = false;
  private feedActionCount = 0;
  private lastAdTimestamp = 0;

  constructor() {
    this.initLastAdTimestamp();
  }

  private initLastAdTimestamp() {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.sessionStorage?.getItem(STORAGE_KEY_LAST_AD);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > 0) {
            this.lastAdTimestamp = parsed;
          }
        }
      } catch {
        // Ignore storage exceptions
      }
    }
  }

  private saveLastAdTimestamp(ts: number) {
    this.lastAdTimestamp = ts;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.setItem(STORAGE_KEY_LAST_AD, String(ts));
      } catch {
        // Ignore storage exceptions
      }
    }
  }

  /**
   * Returns current active cooldown in milliseconds.
   * Debug / test mode drops cooldown to 10s for rapid testing.
   */
  public getCooldownMs(): number {
    if (typeof window !== 'undefined') {
      const isDebug =
        (import.meta as any).env?.VITE_ADS_DEBUG === 'true' ||
        new URLSearchParams(window.location.search).get('test_ads') === 'true' ||
        window.localStorage?.getItem('supertom_test_ads') === 'true';
      if (isDebug) return 10_000;
    }
    return DEFAULT_COOLDOWN_MS;
  }

  /**
   * Checks whether an ad should be triggered given the trigger reason and frequency caps.
   */
  public canTriggerAd(reason: AdTriggerReason, force = false): boolean {
    if (force || reason === 'manual') return true;
    if (this.isAdActive) return false;

    const now = Date.now();
    const elapsed = now - this.lastAdTimestamp;
    const cooldown = this.getCooldownMs();

    switch (reason) {
      case 'app_open':
        // Show on app launch if no ad was shown in the last 40 seconds
        return this.lastAdTimestamp === 0 || elapsed >= APP_OPEN_MIN_INTERVAL_MS;

      case 'feed_tom':
        // Increment feed count and trigger if threshold reached & cooldown elapsed
        this.feedActionCount++;
        if (this.feedActionCount >= 3 && elapsed >= cooldown) {
          return true;
        }
        return false;

      case 'tab_switch':
      case 'spin_wheel':
      case 'claim_mining':
      case 'open_deposit':
      case 'chest_click':
      default:
        return elapsed >= cooldown;
    }
  }

  /**
   * Triggers an ad with intelligent frequency capping and graceful silent fallback.
   */
  public async triggerAd(
    reason: AdTriggerReason,
    options?: TriggerAdOptions
  ): Promise<TriggerAdResult> {
    const isSilent = options?.silent ?? (reason !== 'manual');

    if (!this.canTriggerAd(reason, options?.force)) {
      return {
        shown: false,
        completed: false,
        reason: 'COOLDOWN_ACTIVE',
      };
    }

    if (this.isAdActive) {
      return {
        shown: false,
        completed: false,
        reason: 'AD_ALREADY_ACTIVE',
      };
    }

    this.isAdActive = true;

    try {
      if (reason === 'feed_tom') {
        this.feedActionCount = 0;
      }

      const sessionResult: AdSessionResult = await runServerVerifiedAdSession(options?.onStateChange);

      if (sessionResult.completed) {
        this.saveLastAdTimestamp(Date.now());
        return {
          shown: true,
          completed: true,
          message: sessionResult.message,
        };
      } else {
        // If the ad was closed early or no inventory was available
        if (!isSilent) {
          console.info(`[AdManager] Non-completed ad session (${reason}):`, sessionResult.state);
        }
        // Set partial cooldown to prevent immediate retries
        this.saveLastAdTimestamp(Date.now() - Math.floor(this.getCooldownMs() / 2));
        return {
          shown: false,
          completed: false,
          reason: sessionResult.state,
          message: sessionResult.message,
        };
      }
    } catch (err: unknown) {
      if (!isSilent) {
        console.warn(`[AdManager] Error playing ad (${reason}):`, err);
      }
      return {
        shown: false,
        completed: false,
        reason: 'UNEXPECTED_ERROR',
      };
    } finally {
      this.isAdActive = false;
    }
  }

  /**
   * Helper specifically for app launch with a polite delay so UI renders first.
   */
  public triggerAppOpenAd(delayMs = 1800): void {
    if (typeof window === 'undefined') return;
    setTimeout(() => {
      this.triggerAd('app_open', { silent: true }).catch(() => {});
    }, delayMs);
  }

  /**
   * Helper for tab changes.
   */
  public triggerTabSwitchAd(targetTab?: string): void {
    this.triggerAd('tab_switch', { silent: true }).catch(() => {});
  }

  /**
   * Helper for in-game actions (feed, claim, spin, chest).
   */
  public triggerActionAd(action: 'feed_tom' | 'spin_wheel' | 'claim_mining' | 'open_deposit' | 'chest_click'): void {
    this.triggerAd(action, { silent: true }).catch(() => {});
  }
}

export const adManager = new AdManager();
