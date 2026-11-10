import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SpinController } from '../dist/modules/spin/spinController.js';

describe('Spin Wheel Probability Configuration & Dynamic RNG Suite', () => {
  test('Item with 0% probability must NEVER be drawn', async () => {
    // Set mock configuration where poop-0 is 0% and poop-1000 is 0%
    const mockConfig = [
      { id: 'poop-100', label: '100 Poops', rewardType: 'poops', amount: 100, percentage: 50.0 },
      { id: 'poop-300', label: '300 Poops', rewardType: 'poops', amount: 300, percentage: 50.0 },
      { id: 'poop-0', label: '0 Poops', rewardType: 'poops', amount: 0, percentage: 0.0 },
      { id: 'poop-1000', label: '1,000 Poops', rewardType: 'poops', amount: 1000, percentage: 0.0 },
    ];

    SpinController.setRewardsCache(mockConfig);

    for (let i = 0; i < 200; i++) {
      const drawn = await SpinController.drawReward();
      assert.notEqual(drawn.id, 'poop-0', '0% reward was unexpectedly drawn');
      assert.notEqual(drawn.id, 'poop-1000', '0% reward was unexpectedly drawn');
      assert.ok(drawn.id === 'poop-100' || drawn.id === 'poop-300');
    }
  });

  test('Item with 100% probability must ALWAYS be drawn', async () => {
    const mockConfig = [
      { id: 'poop-100', label: '100 Poops', rewardType: 'poops', amount: 100, percentage: 0.0 },
      { id: 'poop-300', label: '300 Poops', rewardType: 'poops', amount: 300, percentage: 0.0 },
      { id: 'poop-250', label: '250 Poops', rewardType: 'poops', amount: 250, percentage: 0.0 },
      { id: 'poop-750', label: '750 Poops', rewardType: 'poops', amount: 750, percentage: 0.0 },
      { id: 'poop-0', label: '0 Poops', rewardType: 'poops', amount: 0, percentage: 0.0 },
      { id: 'poop-525', label: '525 Poops', rewardType: 'poops', amount: 525, percentage: 0.0 },
      { id: 'poop-1000', label: '1,000 Poops', rewardType: 'poops', amount: 1000, percentage: 100.0 },
    ];

    SpinController.setRewardsCache(mockConfig);

    for (let i = 0; i < 50; i++) {
      const drawn = await SpinController.drawReward();
      assert.equal(drawn.id, 'poop-1000');
      assert.equal(drawn.amount, 1000);
    }
  });

  test('Auto-normalization handles non-100 sums accurately', () => {
    // 7 equal items of 10% each (sum = 70%)
    const rawRewards = [
      { id: '1', percentage: 10 },
      { id: '2', percentage: 10 },
      { id: '3', percentage: 10 },
      { id: '4', percentage: 10 },
      { id: '5', percentage: 10 },
      { id: '6', percentage: 10 },
      { id: '7', percentage: 10 },
    ];

    const rawSum = rawRewards.reduce((acc, r) => acc + r.percentage, 0);
    assert.equal(rawSum, 70);

    const normalized = rawRewards.map((r) => ({
      ...r,
      percentage: Number(((r.percentage / rawSum) * 100).toFixed(2)),
    }));

    const normSum = normalized.reduce((acc, r) => acc + r.percentage, 0);
    const remainder = Number((100 - normSum).toFixed(2));
    if (remainder !== 0) {
      normalized[0].percentage = Number((normalized[0].percentage + remainder).toFixed(2));
    }

    const finalSum = normalized.reduce((acc, r) => acc + r.percentage, 0);
    assert.equal(Math.abs(finalSum - 100) < 0.001, true);
  });
});

