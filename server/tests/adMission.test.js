import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const WATCH_ADS_MISSION_ID = 'm7_watch_30_ads';
const WATCH_ADS_DAILY_TARGET = 30;
const WATCH_ADS_REWARD_POOPS = 500n;
const WATCH_ADS_COOLDOWN_MS = 10_000;

function getUtcDayStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function evaluateWatchAdsProgress({ existing, now }) {
  const startOfToday = getUtcDayStart(now);

  if (
    existing &&
    existing.status === 'CLAIMED' &&
    existing.claimedAt &&
    new Date(existing.claimedAt) >= startOfToday
  ) {
    return { errorCode: 'MISSION_ALREADY_CLAIMED' };
  }

  const isFromPreviousDay =
    Boolean(existing?.claimedAt && new Date(existing.claimedAt) < startOfToday) ||
    Boolean(existing?.updatedAt && new Date(existing.updatedAt) < startOfToday);

  const currentProgress = !existing || isFromPreviousDay ? 0 : existing.progress;

  if (currentProgress >= WATCH_ADS_DAILY_TARGET) {
    return {
      verified: true,
      progress: WATCH_ADS_DAILY_TARGET,
      status: 'COMPLETED',
    };
  }

  if (
    existing &&
    !isFromPreviousDay &&
    currentProgress > 0 &&
    now.getTime() - new Date(existing.updatedAt).getTime() < WATCH_ADS_COOLDOWN_MS
  ) {
    return { errorCode: 'AD_WATCH_COOLDOWN' };
  }

  const nextProgress = Math.min(WATCH_ADS_DAILY_TARGET, currentProgress + 1);
  const verified = nextProgress >= WATCH_ADS_DAILY_TARGET;

  return {
    verified,
    progress: nextProgress,
    status: verified ? 'COMPLETED' : 'IN_PROGRESS',
  };
}

function canClaimWatchAdsReward({ userMission, now }) {
  const startOfToday = getUtcDayStart(now);
  const claimedToday = Boolean(userMission.claimedAt && new Date(userMission.claimedAt) >= startOfToday);
  const updatedBeforeToday = Boolean(new Date(userMission.updatedAt) < startOfToday);

  if (userMission.status === 'CLAIMED' && claimedToday) return false;
  if (userMission.claimedAt && !claimedToday) return false;
  if (updatedBeforeToday) return false;
  if (userMission.status !== 'COMPLETED') return false;
  if (userMission.progress < WATCH_ADS_DAILY_TARGET) return false;

  return true;
}

describe('Daily Watch 30 Ads Quest (m7_watch_30_ads)', () => {
  test('Mission configuration matches 30 ads/day for 500 Poops', () => {
    assert.equal(WATCH_ADS_MISSION_ID, 'm7_watch_30_ads');
    assert.equal(WATCH_ADS_DAILY_TARGET, 30);
    assert.equal(WATCH_ADS_REWARD_POOPS, 500n);
  });

  test('Increments 1 ad at a time and completes only on 30/30', () => {
    const base = new Date('2026-11-12T10:00:00Z');
    let state = null;

    for (let i = 1; i <= 29; i++) {
      const now = new Date(base.getTime() + i * 15_000);
      const res = evaluateWatchAdsProgress({ existing: state, now });
      assert.equal(res.progress, i);
      assert.equal(res.verified, false);
      assert.equal(res.status, 'IN_PROGRESS');
      assert.equal(
        canClaimWatchAdsReward({
          userMission: { status: res.status, progress: res.progress, claimedAt: null, updatedAt: now },
          now,
        }),
        false,
        `Must NOT allow claiming at ${i}/30`
      );
      state = { status: res.status, progress: res.progress, claimedAt: null, updatedAt: now };
    }

    const thirtiethTime = new Date(base.getTime() + 30 * 15_000);
    const finalRes = evaluateWatchAdsProgress({ existing: state, now: thirtiethTime });
    assert.equal(finalRes.progress, 30);
    assert.equal(finalRes.verified, true);
    assert.equal(finalRes.status, 'COMPLETED');
    assert.equal(
      canClaimWatchAdsReward({
        userMission: { status: finalRes.status, progress: finalRes.progress, claimedAt: null, updatedAt: thirtiethTime },
        now: thirtiethTime,
      }),
      true
    );
  });

  test('Enforces 10s cooldown between consecutive same-day ad completions', () => {
    const t0 = new Date('2026-11-12T12:00:00Z');
    const existing = { status: 'IN_PROGRESS', progress: 4, claimedAt: null, updatedAt: t0 };

    const tooFast = evaluateWatchAdsProgress({
      existing,
      now: new Date(t0.getTime() + 3_000),
    });
    assert.equal(tooFast.errorCode, 'AD_WATCH_COOLDOWN');

    const afterCooldown = evaluateWatchAdsProgress({
      existing,
      now: new Date(t0.getTime() + 12_000),
    });
    assert.equal(afterCooldown.progress, 5);
    assert.equal(afterCooldown.status, 'IN_PROGRESS');
  });

  test('Resets partial or claimed progress at 00:00 UTC next day', () => {
    const yesterday = new Date('2026-11-12T23:59:50Z');
    const today = new Date('2026-11-13T00:00:05Z');

    // Partial 18/30 from yesterday resets to 1/30 on first ad today
    const partialRes = evaluateWatchAdsProgress({
      existing: { status: 'IN_PROGRESS', progress: 18, claimedAt: null, updatedAt: yesterday },
      now: today,
    });
    assert.equal(partialRes.progress, 1);
    assert.equal(partialRes.status, 'IN_PROGRESS');

    // Yesterday's unclaimed 30/30 cannot be claimed today without re-watching
    assert.equal(
      canClaimWatchAdsReward({
        userMission: { status: 'COMPLETED', progress: 30, claimedAt: null, updatedAt: yesterday },
        now: today,
      }),
      false
    );

    // Yesterday's claimed quest resets cleanly today
    const afterClaimRes = evaluateWatchAdsProgress({
      existing: { status: 'CLAIMED', progress: 30, claimedAt: yesterday, updatedAt: yesterday },
      now: today,
    });
    assert.equal(afterClaimRes.progress, 1);
    assert.equal(afterClaimRes.status, 'IN_PROGRESS');

    // Same-day claimed quest rejects re-watching today
    const sameDayClaimed = evaluateWatchAdsProgress({
      existing: { status: 'CLAIMED', progress: 30, claimedAt: today, updatedAt: today },
      now: new Date(today.getTime() + 20_000),
    });
    assert.equal(sameDayClaimed.errorCode, 'MISSION_ALREADY_CLAIMED');
  });
});

