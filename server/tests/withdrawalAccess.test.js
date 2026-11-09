import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Withdrawal Access Pass Gate Suite ($3 for 3, $5 for Unlimited)', () => {
  function computeAccess(deposits, withdrawalsUsed) {
    const totalDepositedUsd = deposits.reduce((sum, d) => sum + Number(d.amountUsdt || 0), 0);
    const hasUnlimited = totalDepositedUsd >= 5.0 || deposits.some((d) => Number(d.amountUsdt || 0) >= 5.0);

    if (hasUnlimited) {
      return {
        canWithdraw: true,
        isUnlimited: true,
        remainingWithdrawals: 999999,
        totalDepositedUsd,
        tier: 'UNLIMITED',
      };
    }

    let totalQuota = deposits.reduce((acc, d) => {
      const amt = Number(d.amountUsdt || 0);
      if (amt >= 3.0) {
        return acc + Math.floor(amt / 3.0) * 3;
      }
      return acc;
    }, 0);

    if (totalQuota === 0 && totalDepositedUsd >= 3.0) {
      totalQuota = 3;
    }

    const remaining = Math.max(0, totalQuota - withdrawalsUsed);

    if (remaining > 0) {
      return {
        canWithdraw: true,
        isUnlimited: false,
        remainingWithdrawals: remaining,
        totalDepositedUsd,
        tier: 'THREE_PACK',
      };
    }

    return {
      canWithdraw: false,
      isUnlimited: false,
      remainingWithdrawals: 0,
      totalDepositedUsd,
      tier: 'LOCKED',
    };
  }

  test('User with $0 deposits cannot withdraw directly', () => {
    const access = computeAccess([], 0);
    assert.equal(access.canWithdraw, false);
    assert.equal(access.tier, 'LOCKED');
    assert.equal(access.remainingWithdrawals, 0);
  });

  test('User with deposit below $3 ($1.00) cannot withdraw', () => {
    const access = computeAccess([{ amountUsdt: 1.0 }], 0);
    assert.equal(access.canWithdraw, false);
    assert.equal(access.tier, 'LOCKED');
  });

  test('User with $3 deposit unlocks exactly 3 free withdrawals', () => {
    const access = computeAccess([{ amountUsdt: 3.0 }], 0);
    assert.equal(access.canWithdraw, true);
    assert.equal(access.tier, 'THREE_PACK');
    assert.equal(access.remainingWithdrawals, 3);
    assert.equal(access.isUnlimited, false);
  });

  test('User with $3 deposit decrements remaining quota on each withdrawal', () => {
    const access1 = computeAccess([{ amountUsdt: 3.0 }], 1);
    assert.equal(access1.canWithdraw, true);
    assert.equal(access1.remainingWithdrawals, 2);

    const access2 = computeAccess([{ amountUsdt: 3.0 }], 2);
    assert.equal(access2.canWithdraw, true);
    assert.equal(access2.remainingWithdrawals, 1);

    const access3 = computeAccess([{ amountUsdt: 3.0 }], 3);
    assert.equal(access3.canWithdraw, false);
    assert.equal(access3.remainingWithdrawals, 0);
    assert.equal(access3.tier, 'LOCKED');
  });

  test('User with $5 deposit unlocks unlimited lifetime withdrawals', () => {
    const access = computeAccess([{ amountUsdt: 5.0 }], 10);
    assert.equal(access.canWithdraw, true);
    assert.equal(access.isUnlimited, true);
    assert.equal(access.tier, 'UNLIMITED');
  });

  test('User with cumulative deposits reaching $5 unlocks unlimited withdrawals', () => {
    const access = computeAccess([{ amountUsdt: 3.0 }, { amountUsdt: 2.0 }], 5);
    assert.equal(access.canWithdraw, true);
    assert.equal(access.isUnlimited, true);
    assert.equal(access.tier, 'UNLIMITED');
  });
});
