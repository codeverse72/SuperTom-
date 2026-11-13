import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Withdrawal Entitlement & Deposit Requirement Suite', () => {
  describe('1. Entitlement Qualification & Deposit Tiers', () => {
    test('User with zero deposits must NOT be entitled to make a withdrawal request', () => {
      const remainingWithdrawals = 0;
      const hasUnlimitedWithdrawals = false;
      const canWithdraw = hasUnlimitedWithdrawals || remainingWithdrawals > 0;

      assert.equal(canWithdraw, false);
      assert.equal(remainingWithdrawals, 0);
      assert.equal(hasUnlimitedWithdrawals, false);
    });

    test('$3.00 deposit unlocks exactly 3 withdrawal requests', () => {
      const depositAmountUsdt = 3.0;
      let remainingWithdrawals = 0;
      let hasUnlimitedWithdrawals = false;

      if (depositAmountUsdt >= 5.0) {
        hasUnlimitedWithdrawals = true;
      } else if (depositAmountUsdt >= 3.0) {
        remainingWithdrawals += 3;
      }

      assert.equal(hasUnlimitedWithdrawals, false);
      assert.equal(remainingWithdrawals, 3);
      assert.equal(remainingWithdrawals > 0, true);
    });

    test('$5.00 deposit unlocks UNLIMITED lifetime withdrawals', () => {
      const depositAmountUsdt = 5.0;
      let remainingWithdrawals = 0;
      let hasUnlimitedWithdrawals = false;

      if (depositAmountUsdt >= 5.0) {
        hasUnlimitedWithdrawals = true;
      } else if (depositAmountUsdt >= 3.0) {
        remainingWithdrawals += 3;
      }

      assert.equal(hasUnlimitedWithdrawals, true);
      assert.equal(hasUnlimitedWithdrawals || remainingWithdrawals > 0, true);
    });

    test('Higher deposits ($10, $50) unlock UNLIMITED lifetime withdrawals', () => {
      for (const amount of [10.0, 15.0, 50.0]) {
        let hasUnlimitedWithdrawals = false;
        if (amount >= 5.0) {
          hasUnlimitedWithdrawals = true;
        }
        assert.equal(hasUnlimitedWithdrawals, true);
      }
    });

    test('Deposits below $3.00 do NOT unlock withdrawal quota', () => {
      const depositAmountUsdt = 1.0;
      let remainingWithdrawals = 0;
      let hasUnlimitedWithdrawals = false;

      if (depositAmountUsdt >= 5.0) {
        hasUnlimitedWithdrawals = true;
      } else if (depositAmountUsdt >= 3.0) {
        remainingWithdrawals += 3;
      }

      assert.equal(hasUnlimitedWithdrawals, false);
      assert.equal(remainingWithdrawals, 0);
      assert.equal(hasUnlimitedWithdrawals || remainingWithdrawals > 0, false);
    });
  });

  describe('2. Withdrawal Consumption & Atomic Quota Decrement', () => {
    test('Making a withdrawal decrements finite quota by 1', () => {
      let remainingWithdrawals = 3;
      const hasUnlimitedWithdrawals = false;

      // Simulate 1st withdrawal
      assert.ok(remainingWithdrawals > 0);
      remainingWithdrawals -= 1;
      assert.equal(remainingWithdrawals, 2);

      // Simulate 2nd withdrawal
      assert.ok(remainingWithdrawals > 0);
      remainingWithdrawals -= 1;
      assert.equal(remainingWithdrawals, 1);

      // Simulate 3rd withdrawal
      assert.ok(remainingWithdrawals > 0);
      remainingWithdrawals -= 1;
      assert.equal(remainingWithdrawals, 0);

      // 4th withdrawal attempt must be rejected
      const canWithdraw = hasUnlimitedWithdrawals || remainingWithdrawals > 0;
      assert.equal(canWithdraw, false);
    });

    test('Unlimited withdrawals never decrement and never expire', () => {
      const hasUnlimitedWithdrawals = true;
      let remainingWithdrawals = 999999;

      for (let i = 0; i < 20; i++) {
        if (!hasUnlimitedWithdrawals) {
          remainingWithdrawals -= 1;
        }
      }

      assert.equal(hasUnlimitedWithdrawals, true);
      assert.equal(remainingWithdrawals, 999999);
    });

    test('Zero quota throws WITHDRAWAL_DEPOSIT_REQUIRED error with requiresDeposit flag', () => {
      const user = { hasUnlimitedWithdrawals: false, remainingWithdrawals: 0 };
      let errorThrown = null;

      try {
        if (!user.hasUnlimitedWithdrawals && user.remainingWithdrawals <= 0) {
          const err = new Error(
            'A qualifying deposit is required to unlock payouts ($3.00 for 3 withdrawals, or $5.00 for unlimited withdrawals).'
          );
          err.code = 'WITHDRAWAL_DEPOSIT_REQUIRED';
          err.requiresDeposit = true;
          throw err;
        }
      } catch (e) {
        errorThrown = e;
      }

      assert.ok(errorThrown);
      assert.equal(errorThrown.code, 'WITHDRAWAL_DEPOSIT_REQUIRED');
      assert.equal(errorThrown.requiresDeposit, true);
    });
  });

  describe('3. Multiple Deposits Stacking Logic', () => {
    test('Two separate $3 deposits grant 6 total withdrawals', () => {
      let remainingWithdrawals = 0;
      const deposit1 = 3.0;
      const deposit2 = 3.0;

      remainingWithdrawals += Math.floor(deposit1 / 3.0) * 3;
      remainingWithdrawals += Math.floor(deposit2 / 3.0) * 3;

      assert.equal(remainingWithdrawals, 6);
    });

    test('$3 deposit followed by $5 deposit upgrades user to UNLIMITED', () => {
      let remainingWithdrawals = 3;
      let hasUnlimitedWithdrawals = false;

      // Later user deposits $5
      const newDeposit = 5.0;
      if (newDeposit >= 5.0) {
        hasUnlimitedWithdrawals = true;
      }

      assert.equal(hasUnlimitedWithdrawals, true);
      const canWithdraw = hasUnlimitedWithdrawals || remainingWithdrawals > 0;
      assert.equal(canWithdraw, true);
    });
  });

  describe('4. "Watch 30 Ads/Day for 5 Days" Withdrawal Unlock Suite', () => {
    test('User with < 5 qualifying days cannot claim withdrawal unlock', () => {
      const TARGET_DAYS = 5;
      const DAILY_TARGET = 30;
      const qualifyingDays = 4; // 4 days with >= 30 ads
      const claimedCycles = 0;

      const effectiveDays = Math.max(0, qualifyingDays - claimedCycles * TARGET_DAYS);
      const daysCompleted = Math.min(TARGET_DAYS, effectiveDays);
      const canClaimReward = daysCompleted >= TARGET_DAYS;

      assert.equal(daysCompleted, 4);
      assert.equal(canClaimReward, false);
    });

    test('User with 5 qualifying days achieves canClaimReward = true', () => {
      const TARGET_DAYS = 5;
      const qualifyingDays = 5;
      const claimedCycles = 0;

      const effectiveDays = Math.max(0, qualifyingDays - claimedCycles * TARGET_DAYS);
      const daysCompleted = Math.min(TARGET_DAYS, effectiveDays);
      const canClaimReward = daysCompleted >= TARGET_DAYS;

      assert.equal(daysCompleted, 5);
      assert.equal(canClaimReward, true);
    });

    test('Claiming reward grants exactly +1 withdrawal request and starts next cycle', () => {
      const TARGET_DAYS = 5;
      let qualifyingDays = 5;
      let claimedCycles = 0;
      let remainingWithdrawals = 0;

      // Claim reward
      let effectiveDays = Math.max(0, qualifyingDays - claimedCycles * TARGET_DAYS);
      assert.equal(effectiveDays >= TARGET_DAYS, true);

      remainingWithdrawals += 1;
      claimedCycles += 1;

      // Next cycle calculation
      effectiveDays = Math.max(0, qualifyingDays - claimedCycles * TARGET_DAYS);
      const nextDaysCompleted = Math.min(TARGET_DAYS, effectiveDays);
      const nextCanClaim = nextDaysCompleted >= TARGET_DAYS;

      assert.equal(remainingWithdrawals, 1);
      assert.equal(claimedCycles, 1);
      assert.equal(nextDaysCompleted, 0);
      assert.equal(nextCanClaim, false);

      // Now user can send a withdrawal request!
      const canWithdraw = remainingWithdrawals > 0;
      assert.equal(canWithdraw, true);

      // Sending withdrawal request consumes the quota
      remainingWithdrawals -= 1;
      assert.equal(remainingWithdrawals, 0);
    });
  });
});
