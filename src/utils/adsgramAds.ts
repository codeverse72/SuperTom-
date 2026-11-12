/**
 * Adsgram Telegram Mini App SDK helper (`https://sad.adsgram.ai/js/sad.min.js`)
 * Primary provider for Watch 30 Ads Daily rewarded quests (UnitID: 59392).
 */
import { showAdexiumRewardedAd } from './adexiumRewarded';

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

declare global {
  interface Window {
    Adsgram?: {
      init: (config: {
        blockId: string;
        debug?: boolean;
        debugBannerType?: 'FullscreenMedia' | 'RewardedVideo';
      }) => AdsgramAdController;
    };
  }
}

export interface RewardedAdRunResult {
  completed: boolean;
  provider?: 'adsgram' | 'adexium';
  reason?: 'sdk_unavailable' | 'busy' | 'no_ad' | 'skipped' | 'error';
  message?: string;
}

export const DEFAULT_ADSGRAM_REWARDED_BLOCK_ID = '59392';

let activeAdsgramPromise: Promise<RewardedAdRunResult> | null = null;

function getAdsgramRewardedBlockId(): string {
  const configured = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_ADSGRAM_REWARDED_BLOCK_ID?.trim();
  return configured || DEFAULT_ADSGRAM_REWARDED_BLOCK_ID;
}

function getAdexiumRewardedWidOverride(): string | undefined {
  return (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_ADEXIUM_REWARDED_WID?.trim();
}

/**
 * Triggers an Adsgram Rewarded Video ad (`blockId: "59392"` by default).
 * Resolves `completed: true` only if the user finishes watching the ad (`result.done === true`).
 */
export async function showAdsgramRewardedAd(): Promise<RewardedAdRunResult> {
  if (activeAdsgramPromise) {
    return {
      completed: false,
      provider: 'adsgram',
      reason: 'busy',
      message: 'An ad is already loading or playing.',
    };
  }

  if (typeof window === 'undefined' || !window.Adsgram || typeof window.Adsgram.init !== 'function') {
    return {
      completed: false,
      provider: 'adsgram',
      reason: 'sdk_unavailable',
      message: 'Adsgram SDK is still loading or blocked by an ad blocker.',
    };
  }

  const blockId = getAdsgramRewardedBlockId();

  activeAdsgramPromise = (async (): Promise<RewardedAdRunResult> => {
    try {
      const controller = window.Adsgram!.init({ blockId });
      const result = await controller.show();

      if (result && result.done === false) {
        return {
          completed: false,
          provider: 'adsgram',
          reason: 'skipped',
          message: result.description || 'Please watch the full ad to earn quest progress.',
        };
      }

      return {
        completed: true,
        provider: 'adsgram',
      };
    } catch (err: unknown) {
      const errObj = err as Partial<AdsgramShowPromiseResult> & { message?: string };
      const desc = (errObj?.description || errObj?.message || '').trim();
      const lower = desc.toLowerCase();

      if (lower.includes('skip') || lower.includes('close') || lower.includes('abort')) {
        return {
          completed: false,
          provider: 'adsgram',
          reason: 'skipped',
          message: 'Ad closed early. Watch until the timer finishes to earn progress.',
        };
      }

      if (lower.includes('not found') || lower.includes('no banner') || lower.includes('empty') || lower.includes('moderation')) {
        return {
          completed: false,
          provider: 'adsgram',
          reason: 'no_ad',
          message: 'No sponsored ads are available right now (or block is still awaiting Adsgram approval).',
        };
      }

      return {
        completed: false,
        provider: 'adsgram',
        reason: errObj?.error === false ? 'no_ad' : 'error',
        message: desc || 'No sponsored ads are available right now. Please try again shortly.',
      };
    } finally {
      activeAdsgramPromise = null;
    }
  })();

  return activeAdsgramPromise;
}

/**
 * Primary Watch-Ads waterfall:
 * 1. Runs Adsgram Reward block (`59392` by default).
 * 2. Only falls back to Adexium rewarded if `VITE_ADEXIUM_REWARDED_WID` is explicitly set
 *    (keeping non-rewarded Adexium Interstitial `#14982` compliant with Adexium rules).
 */
export async function showRewardedAdWithWaterfall(): Promise<RewardedAdRunResult> {
  const adsgramRes = await showAdsgramRewardedAd();
  if (adsgramRes.completed) {
    return adsgramRes;
  }

  // If user skipped/closed early or another ad is already playing, do not trigger fallback
  if (adsgramRes.reason === 'skipped' || adsgramRes.reason === 'busy') {
    return adsgramRes;
  }

  const dedicatedAdexiumWid = getAdexiumRewardedWidOverride();
  if (dedicatedAdexiumWid) {
    const adexiumRes = await showAdexiumRewardedAd();
    if (adexiumRes.completed) {
      return { completed: true, provider: 'adexium' };
    }
    return {
      completed: false,
      provider: 'adexium',
      reason: adexiumRes.reason === 'closed_early' ? 'skipped' : 'no_ad',
      message: adexiumRes.message || adsgramRes.message,
    };
  }

  return adsgramRes;
}

