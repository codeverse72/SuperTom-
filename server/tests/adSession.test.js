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
});
