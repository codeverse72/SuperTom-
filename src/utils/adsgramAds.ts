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

function getPrimaryAdProvider(): 'adexium' | 'adsgram' {
  const envVal = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_PRIMARY_AD_PROVIDER?.toLowerCase().trim();
  if (envVal === 'adsgram') return 'adsgram';
  // Default to Adexium placement #15008 (verified Active) so users can watch ads immediately
  // without seeing the Adsgram moderation popup while unit 59392 is reviewed.
  return 'adexium';
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
 * By default runs Adexium active placement #15008 so ads play immediately while Adsgram
 * unit 59392 finishes moderation. Can be set to 'adsgram' via VITE_PRIMARY_AD_PROVIDER.
 */
export async function showRewardedAdWithWaterfall(): Promise<RewardedAdRunResult> {
  const primary = getPrimaryAdProvider();

  if (primary === 'adexium') {
    const adexiumRes = await showAdexiumRewardedAd();
    if (adexiumRes.completed) {
      return { completed: true, provider: 'adexium' };
    }

    if (adexiumRes.reason === 'closed_early' || adexiumRes.reason === 'busy') {
      return {
        completed: false,
        provider: 'adexium',
        reason: adexiumRes.reason === 'closed_early' ? 'skipped' : 'busy',
        message: adexiumRes.message || 'Please finish the ad to earn quest progress.',
      };
    }

    // Fallback to Adsgram if Adexium had no inventory or SDK issue
    const adsgramRes = await showAdsgramRewardedAd();
    if (adsgramRes.completed) {
      return adsgramRes;
    }

    return {
      completed: false,
      provider: 'adexium',
      reason: adexiumRes.reason === 'no_ad' ? 'no_ad' : 'error',
      message: adexiumRes.message || adsgramRes.message || 'No sponsored ads are available right now. Please try again shortly.',
    };
  }

  // Primary: Adsgram
  const adsgramRes = await showAdsgramRewardedAd();
  if (adsgramRes.completed) {
    return adsgramRes;
  }

  if (adsgramRes.reason === 'skipped' || adsgramRes.reason === 'busy') {
    return adsgramRes;
  }

  // Fallback to Adexium
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

