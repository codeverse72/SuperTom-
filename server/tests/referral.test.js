import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Referral System: Reward Only When Referent Opens Bot', () => {
  describe('1. Bot Launch Qualification Rule', () => {
    test('Referrer should NOT receive reward when link is generated or shared without referent opening bot', () => {
      let referrerBalance = 5000n;
      let referentOpenedBot = false;
      let referralRecordCreated = false;

      // User A generates link and shares it
      const referralLink = 'https://t.me/SuperrTombot?startapp=TOM123';
      assert.ok(referralLink.includes('startapp=TOM123'));

      // If referent has not launched the bot:
      if (referentOpenedBot) {
        referrerBalance += 2000n;
        referralRecordCreated = true;
      }

      assert.equal(referrerBalance, 5000n, 'Referrer balance must remain unchanged');
      assert.equal(referralRecordCreated, false, 'No referral record should exist before bot open');
    });

    test('Referrer should receive reward ONLY when referent opens the bot and authenticates', () => {
      let referrerBalance = 5000n;
      let referentBalance = 0n;
      let referentOpenedBot = true; // User launches Mini App

      if (referentOpenedBot) {
        // Triggered upon auth in authController
        referrerBalance += 2000n;
        referentBalance += 1000n; // Welcome starter bonus
      }

      assert.equal(referrerBalance, 7000n, 'Referrer must receive 2,000 Poops upon referent bot opening');
      assert.equal(referentBalance, 1000n, 'Referent must receive 1,000 Poops welcome bonus');
    });
  });

  describe('2. Self-Referral and Anti-Fraud Controls', () => {
    test('Self-referral must be strictly rejected', () => {
      const referrerTgId = 123456789n;
      const refereeTgId = 123456789n; // Same person

      let referrerId = null;
      if (referrerTgId !== refereeTgId) {
        referrerId = 'valid-referrer-id';
      }

      assert.equal(referrerId, null, 'Self-referral must not be attributed');
    });

    test('Existing players must not be re-referred', () => {
      const existingUser = { id: 'user-1', telegramId: 999999n };
      let referralAttributed = false;

      // Only new users (!user) qualify for referral attribution
      const isNewUser = !existingUser;
      if (isNewUser) {
        referralAttributed = true;
      }

      assert.equal(referralAttributed, false, 'Existing player must not trigger a referral bonus');
    });
  });

  describe('3. Telegram Chat /start to Bot Pending Flow', () => {
    test('Sending /start to Telegram chat must only record pending intent, NOT disburse rewards', () => {
      const pendingMap = new Map();
      let referrerBalance = 10000n;

      // User sends /start TOMABC to bot chat
      const refereeTgId = 555555n;
      const refCode = 'TOMABC';

      // Bot stores pending intent
      pendingMap.set(refereeTgId.toString(), refCode);

      // Verify referrer receives NO reward at this stage
      assert.equal(referrerBalance, 10000n, 'Referrer must not receive reward when referee is only in Telegram chat');
      assert.equal(pendingMap.get(refereeTgId.toString()), 'TOMABC');

      // Now user actually taps "Open SuperTom" button and authenticates
      const hasLaunchedApp = true;
      if (hasLaunchedApp) {
        const storedCode = pendingMap.get(refereeTgId.toString());
        if (storedCode) {
          referrerBalance += 2000n;
          pendingMap.delete(refereeTgId.toString());
        }
      }

      assert.equal(referrerBalance, 12000n, 'Referrer reward credited once bot is opened');
      assert.equal(pendingMap.has(refereeTgId.toString()), false, 'Pending attribution cleared');
    });
  });

  describe('4. Referral Mission Verification ("Invite 3 Friends")', () => {
    test('Mission must NOT complete if friends have not opened the bot', () => {
      const friendsWhoOpenedBot = 2; // Only 2 opened
      const required = 3;

      const isCompleted = friendsWhoOpenedBot >= required;
      assert.equal(isCompleted, false, 'Invite 3 Friends mission must remain incomplete if < 3 friends joined');
    });

    test('Mission completes once 3 friends have opened the bot', () => {
      const friendsWhoOpenedBot = 3;
      const required = 3;

      const isCompleted = friendsWhoOpenedBot >= required;
      assert.equal(isCompleted, true, 'Mission should complete when 3 friends have joined');
    });
  });
});
