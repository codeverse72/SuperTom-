import { Response } from 'express';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { secureRandomFloat } from '../../utils/crypto.js';
import { LedgerService } from '../ledger/ledgerService.js';

interface SpinRewardDefinition {
  id: string;
  label: string;
  rewardType: 'poops' | 'biscuit';
  amount?: number;
  biscuitId?: string;
  cumulativeWeight: number; // in range [0, 1000]
}

/**
 * EXACT probability distribution from specifications:
 * 100 Poops: 99.0% (990/1000)
 * 250 Poops: 0.2% (2/1000)
 * 500 Poops: 0.2% (2/1000)
 * 1000 Poops: 0.2% (2/1000)
 * 2000 Poops: 0.2% (2/1000)
 * Gold Biscuit: 0.1% (1/1000)
 * Diamond Biscuit: 0.1% (1/1000)
 */
const SPIN_REWARDS_CUMULATIVE: SpinRewardDefinition[] = [
  { id: 'poop-100', label: '100 Poops', rewardType: 'poops', amount: 100, cumulativeWeight: 990 },
  { id: 'poop-250', label: '250 Poops', rewardType: 'poops', amount: 250, cumulativeWeight: 992 },
  { id: 'poop-500', label: '500 Poops', rewardType: 'poops', amount: 500, cumulativeWeight: 994 },
  { id: 'poop-1000', label: '1,000 Poops', rewardType: 'poops', amount: 1000, cumulativeWeight: 996 },
  { id: 'poop-2000', label: '2,000 Poops', rewardType: 'poops', amount: 2000, cumulativeWeight: 998 },
  { id: 'biscuit-gold', label: 'Gold Biscuit', rewardType: 'biscuit', biscuitId: 'gold', cumulativeWeight: 999 },
  { id: 'biscuit-diamond', label: 'Diamond Biscuit', rewardType: 'biscuit', biscuitId: 'diamond', cumulativeWeight: 1000 },
];

const MILESTONE_COOLDOWNS: Record<number, number> = {
  1: 2 * 3600 * 1000, // 2 hours in ms
  2: 4 * 3600 * 1000, // 4 hours in ms
  3: 8 * 3600 * 1000, // 8 hours in ms
};

export class SpinController {
  /**
   * Cryptographically secure weighted reward selection.
   */
  private static drawReward(): SpinRewardDefinition {
    const roll = secureRandomFloat() * 1000;
    for (const reward of SPIN_REWARDS_CUMULATIVE) {
      if (roll < reward.cumulativeWeight) {
        return reward;
      }
    }
    return SPIN_REWARDS_CUMULATIVE[0];
  }

  /**
   * GET /api/v1/spin/status
   */
  public static async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      let state = await prisma.spinState.findUnique({
        where: { userId },
      });

      if (!state) {
        state = await prisma.spinState.create({
          data: {
            userId,
            currentMilestone: 1,
            cycleCount: 1,
            nextUnlockAt: new Date(Date.now() + MILESTONE_COOLDOWNS[1]),
            claimedMilestones: '[]',
          },
        });
      }

      const now = Date.now();
      const nextUnlockTs = state.nextUnlockAt.getTime();
      const canSpin = now >= nextUnlockTs;

      let claimedArr: number[] = [];
      try {
        claimedArr = JSON.parse(state.claimedMilestones);
      } catch {
        claimedArr = [];
      }

      sendSuccess(res, {
        currentMilestone: state.currentMilestone as 1 | 2 | 3,
        nextUnlockTimestamp: nextUnlockTs,
        canSpin,
        cycleCount: state.cycleCount,
        claimedMilestones: claimedArr,
      });
    } catch {
      sendError(res, 'Failed to fetch spin status', 500, 'SPIN_STATUS_ERROR');
    }
  }

  /**
   * POST /api/v1/spin/claim
   * Executes atomic server-side wheel spin, distributes reward, and advances milestone timer.
   */
  public static async claimSpin(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const drawnReward = SpinController.drawReward();

      const result = await prisma.$transaction(async (tx) => {
        const state = await tx.spinState.findUnique({
          where: { userId },
        });

        if (!state) {
          throw new Error('Spin state not found');
        }

        const now = Date.now();
        if (now < state.nextUnlockAt.getTime()) {
          const remainingSec = Math.ceil((state.nextUnlockAt.getTime() - now) / 1000);
          throw new Error(`Free spin locked. Please wait ${remainingSec} seconds.`);
        }

        const currentM = state.currentMilestone;
        let claimedList: number[] = [];
        try {
          claimedList = JSON.parse(state.claimedMilestones);
        } catch {
          claimedList = [];
        }

        if (!claimedList.includes(currentM)) {
          claimedList.push(currentM);
        }

        // Calculate next milestone progression
        let nextM = currentM + 1;
        let nextCycle = state.cycleCount;

        if (nextM > 3) {
          nextM = 1;
          nextCycle += 1;
          claimedList = []; // reset for new cycle
        }

        const nextUnlockAt = new Date(now + (MILESTONE_COOLDOWNS[nextM] || MILESTONE_COOLDOWNS[1]));

        // 1. Update spin state
        await tx.spinState.update({
          where: { userId },
          data: {
            currentMilestone: nextM,
            cycleCount: nextCycle,
            nextUnlockAt,
            claimedMilestones: JSON.stringify(claimedList),
          },
        });

        // 2. Distribute reward
        let newBalance = 0;

        if (drawnReward.rewardType === 'poops' && drawnReward.amount) {
          const { balanceAfter } = await LedgerService.executeBalanceTransaction(tx, {
            userId,
            type: 'SPIN_REWARD',
            amount: BigInt(drawnReward.amount),
            description: `Lucky wheel milestone ${currentM} win: ${drawnReward.label}`,
            idempotencyKey: `spin_${userId}_${currentM}_${now}`,
          });
          newBalance = Number(balanceAfter);
        } else if (drawnReward.rewardType === 'biscuit' && drawnReward.biscuitId) {
          await tx.userInventory.upsert({
            where: { userId_biscuitId: { userId, biscuitId: drawnReward.biscuitId } },
            create: { userId, biscuitId: drawnReward.biscuitId, quantity: 1 },
            update: { quantity: { increment: 1 } },
          });

          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { poopsBalance: true },
          });
          newBalance = Number(user?.poopsBalance ?? 0);
        }

        // 3. Log spin history
        await tx.spinHistory.create({
          data: {
            userId,
            milestone: currentM,
            rewardType: drawnReward.rewardType === 'poops' ? 'POOPS' : 'BISCUIT',
            rewardAmount: drawnReward.amount ? BigInt(drawnReward.amount) : undefined,
            rewardBiscuitId: drawnReward.biscuitId,
          },
        });

        return {
          newBalance,
          nextM,
          nextUnlockTimestamp: nextUnlockAt.getTime(),
        };
      });

      sendSuccess(res, {
        rewardId: drawnReward.id,
        label: drawnReward.label,
        rewardType: drawnReward.rewardType,
        amount: drawnReward.amount,
        biscuitId: drawnReward.biscuitId,
        newBalancePoops: result.newBalance,
        nextMilestone: result.nextM as 1 | 2 | 3,
        nextUnlockTimestamp: result.nextUnlockTimestamp,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Claiming spin failed';
      sendError(res, msg, 400, 'SPIN_CLAIM_FAILED');
    }
  }
}
