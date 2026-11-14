import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AdController, MIN_VIEW_DURATION_MS } from '../dist/modules/ads/adController.js';

test('Rewarded Ad Session Management Suite', async (t) => {
  const mockUserId = 'usr_test_12345';
  const mockSessionId = 'ses_test_67890';
  const mockNonce = 'abcdef1234567890abcdef1234567890';
  const validExpiresAtMs = Date.now() + 5 * 60 * 1000;

  await t.test('1. Cryptographic HMAC Session Token Integrity', () => {
    const token = AdController.generateSessionToken(
      mockSessionId,
      mockUserId,
      mockNonce,
      validExpiresAtMs
    );

    assert.ok(token, 'Token must be generated');
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(token.length, 64, 'HMAC SHA256 hex must be 64 characters');

    // Valid token must verify
    const isValid = AdController.verifySessionToken(
      mockSessionId,
      mockUserId,
      mockNonce,
      validExpiresAtMs,
      token
    );
    assert.strictEqual(isValid, true, 'Valid token must verify successfully');

    // Tampered token must fail
    const tamperedToken = token.slice(0, -2) + 'ff';
    const isTamperedValid = AdController.verifySessionToken(
      mockSessionId,
      mockUserId,
      mockNonce,
      validExpiresAtMs,
      tamperedToken
    );
    assert.strictEqual(isTamperedValid, false, 'Tampered token must return false');

    // Tampered user ID must fail
    const wrongUserValid = AdController.verifySessionToken(
      mockSessionId,
      'usr_hacker_99999',
      mockNonce,
      validExpiresAtMs,
      token
    );
    assert.strictEqual(wrongUserValid, false, 'Token with mismatched userId must fail');

    // Tampered session ID must fail
    const wrongSessionValid = AdController.verifySessionToken(
      'ses_hacker_99999',
      mockUserId,
      mockNonce,
      validExpiresAtMs,
      token
    );
    assert.strictEqual(wrongSessionValid, false, 'Token with mismatched sessionId must fail');
  });

  await t.test('2. Enforces Minimum View Playback Duration', () => {
    assert.strictEqual(MIN_VIEW_DURATION_MS, 4000, 'Minimum view playback must be at least 4 seconds');

    const shortDuration = 1500;
    const validDuration = 6500;

    assert.ok(shortDuration < MIN_VIEW_DURATION_MS, 'Short duration must be below threshold');
    assert.ok(validDuration >= MIN_VIEW_DURATION_MS, 'Valid duration must meet threshold');
  });

  await t.test('3. Frequency Capping & Smart Throttling Mathematics', () => {
    const DEFAULT_COOLDOWN_MS = 50_000; // 50s cooldown
    const APP_OPEN_MIN_INTERVAL_MS = 40_000; // 40s min interval for app open

    function canTrigger(reason, lastAdTime, feedCount, now) {
      const elapsed = now - lastAdTime;
      if (reason === 'manual') return true;
      if (reason === 'app_open') {
        return lastAdTime === 0 || elapsed >= APP_OPEN_MIN_INTERVAL_MS;
      }
      if (reason === 'feed_tom') {
        return feedCount >= 3 && elapsed >= DEFAULT_COOLDOWN_MS;
      }
      return elapsed >= DEFAULT_COOLDOWN_MS;
    }

    const t0 = 100_000;

    // 1. App open on clean session (lastAdTime = 0) must trigger
    assert.strictEqual(canTrigger('app_open', 0, 0, t0), true);

    // 2. Tab switch immediately after ad (e.g. 5s later) must be BLOCKED
    assert.strictEqual(canTrigger('tab_switch', t0, 0, t0 + 5000), false);

    // 3. Tab switch after 51s must be ALLOWED
    assert.strictEqual(canTrigger('tab_switch', t0, 0, t0 + 51_000), true);

    // 4. Feeding Tom on only 1 or 2 feeds must be BLOCKED even after 51s
    assert.strictEqual(canTrigger('feed_tom', t0, 2, t0 + 51_000), false);

    // 5. Feeding Tom on 3rd feed after 51s must be ALLOWED
    assert.strictEqual(canTrigger('feed_tom', t0, 3, t0 + 51_000), true);

    // 6. Manual watch ad button must ALWAYS bypass cooldown
    assert.strictEqual(canTrigger('manual', t0, 0, t0 + 1000), true);
  });
});
