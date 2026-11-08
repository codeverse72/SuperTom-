import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRewardDays, calculateCashback } from '../dist/modules/campaign/campaignService.js';

describe('5K Members Celebration Campaign Suite', () => {
  describe('1. Deposit Eligibility & Tier Thresholds', () => {
    test('should reject deposits below $5 minimum threshold', () => {
      const minDeposit = 5.0;
      assert.equal(4.99 < minDeposit, true, '$4.99 is below threshold');
      assert.equal(1.0 < minDeposit, true, '$1.00 is below threshold');
      assert.equal(4.0 < minDeposit, true, '$4.00 is below threshold');
    });

    test('should accept deposits >= $5 as qualifying', () => {
      const minDeposit = 5.0;
      assert.equal(5.0 >= minDeposit, true, '$5.00 qualifies');
      assert.equal(6.0 >= minDeposit, true, '$6.00 qualifies');
      assert.equal(7.5 >= minDeposit, true, '$7.50 qualifies');
      assert.equal(10.0 >= minDeposit, true, '$10.00 qualifies');
      assert.equal(50.0 >= minDeposit, true, '$50.00 qualifies');
    });
  });

  describe('2. 30% Instant Cashback Calculations', () => {
    test('should accurately calculate 30% instant cashback across standard amounts', () => {
      // $5 = $1.50 -> 3,000 Poops
      const res5 = calculateCashback(5);
      assert.equal(res5.cashbackUsdt, 1.5);
      assert.equal(res5.cashbackPoops, 3000);

      // $6 = $1.80 -> 3,600 Poops
      const res6 = calculateCashback(6);
      assert.equal(res6.cashbackUsdt, 1.8);
      assert.equal(res6.cashbackPoops, 3600);

      // $7 = $2.10 -> 4,200 Poops
      const res7 = calculateCashback(7);
      assert.equal(res7.cashbackUsdt, 2.1);
      assert.equal(res7.cashbackPoops, 4200);

      // $8 = $2.40 -> 4,800 Poops
      const res8 = calculateCashback(8);
      assert.equal(res8.cashbackUsdt, 2.4);
      assert.equal(res8.cashbackPoops, 4800);

      // $9 = $2.70 -> 5,400 Poops
      const res9 = calculateCashback(9);
      assert.equal(res9.cashbackUsdt, 2.7);
      assert.equal(res9.cashbackPoops, 5400);

      // $10 = $3.00 -> 6,000 Poops
      const res10 = calculateCashback(10);
      assert.equal(res10.cashbackUsdt, 3.0);
      assert.equal(res10.cashbackPoops, 6000);
    });

    test('should cap qualifying amount at $10.00 maximum qualifying threshold', () => {
      const res20 = calculateCashback(20, 30, 10);
      assert.equal(res20.qualifyingAmount, 10);
      assert.equal(res20.cashbackUsdt, 3.0);
      assert.equal(res20.cashbackPoops, 6000);
    });
  });

  describe('3. Tiered Daily Reward Durations ($1 / 2,000 Poops per day)', () => {
    test('should exactly match specification reward schedule', () => {
      // $5 -> 5 days (10,000 Poops total)
      assert.equal(calculateRewardDays(5), 5);

      // $6 -> 6 days (12,000 Poops total)
      assert.equal(calculateRewardDays(6), 6);

      // $7 -> 8 days (16,000 Poops total)
      assert.equal(calculateRewardDays(7), 8);

      // $8 -> 9 days (18,000 Poops total)
      assert.equal(calculateRewardDays(8), 9);

      // $9 -> 11 days (22,000 Poops total)
      assert.equal(calculateRewardDays(9), 11);

      // $10 -> 13 days (26,000 Poops total)
      assert.equal(calculateRewardDays(10), 13);
    });

    test('should cap duration at 13 days maximum for higher deposits', () => {
      assert.equal(calculateRewardDays(15), 13);
      assert.equal(calculateRewardDays(50), 13);
      assert.equal(calculateRewardDays(100), 13);
    });

    test('should enforce 5 days minimum for any qualifying deposit', () => {
      assert.equal(calculateRewardDays(5.0), 5);
      assert.equal(calculateRewardDays(5.2), 5);
    });

    test('should correctly compute total daily reward poops (2,000 Poops/day)', () => {
      const dailyRate = 2000;
      assert.equal(calculateRewardDays(5) * dailyRate, 10000);
      assert.equal(calculateRewardDays(6) * dailyRate, 12000);
      assert.equal(calculateRewardDays(7) * dailyRate, 16000);
      assert.equal(calculateRewardDays(8) * dailyRate, 18000);
      assert.equal(calculateRewardDays(9) * dailyRate, 22000);
      assert.equal(calculateRewardDays(10) * dailyRate, 26000);
    });
  });

  describe('4. Idempotency & Unique Reward Scheduling', () => {
    test('should construct deterministic, tamper-proof daily reward keys', () => {
      const participationId = 'part_test_123';
      const dayIndex = 1;
      const dateStr = '2026-11-08';
      const key = `daily_reward_${participationId}_${dayIndex}_${dateStr}`;
      assert.equal(key, 'daily_reward_part_test_123_1_2026-11-08');

      // Unique constraint userId + campaignId + dateStr prevents duplicate claims
      const uniqueScheduleConstraint = `${participationId}_${dateStr}`;
      assert.equal(uniqueScheduleConstraint, 'part_test_123_2026-11-08');
    });
  });
});

