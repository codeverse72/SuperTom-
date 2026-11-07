import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { LedgerService } from '../ledger/ledgerService.js';

// Server-authoritative biscuit catalog rules
export const BISCUIT_CATALOG = {
  common: { id: 'common', name: 'Common Biscuit', costPoops: 10n, boostPerHour: 10 },
  silver: { id: 'silver', name: 'Silver Biscuit', costPoops: 50n, boostPerHour: 50 },
  gold: { id: 'gold', name: 'Gold Biscuit', costPoops: 200n, boostPerHour: 200 },
  diamond: { id: 'diamond', name: 'Diamond Biscuit', costPoops: 1000n, boostPerHour: 1000 },
} as const;

type BiscuitType = keyof typeof BISCUIT_CATALOG;

const purchaseSchema = z.object({
  biscuitId: z.enum(['common', 'silver', 'gold', 'diamond']),
  quantity: z.number().int().positive().default(1),
});

const feedSchema = z.object({
  biscuitId: z.enum(['common', 'silver', 'gold', 'diamond']),
  count: z.number().int().positive().default(1),
});

export class StoreController {
  /**
   * Helper to fetch normalized user inventory DTO.
   */
  private static async getInventoryDto(userId: string) {
    const inventories = await prisma.userInventory.findMany({
      where: { userId },
    });

    const inventoryMap: Record<string, number> = {
      common: 0,
      silver: 0,
      gold: 0,
      diamond: 0,
    };

    for (const item of inventories) {
      if (item.biscuitId in inventoryMap) {
        inventoryMap[item.biscuitId] = item.quantity;
      }
    }

    return inventoryMap;
  }

  /**
   * GET /api/v1/store/inventory
   */
  public static async getInventory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    try {
      const dto = await StoreController.getInventoryDto(userId);
      sendSuccess(res, dto);
    } catch {
      sendError(res, 'Failed to fetch inventory', 500, 'INVENTORY_FETCH_ERROR');
    }
  }

  /**
   * POST /api/v1/store/purchase
   * Validates user has enough Poops balance, deducts cost atomically,
   * credits inventory, and writes immutable audit ledger entry.
   */
  public static async purchaseBiscuit(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parseResult = purchaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 'Invalid purchase request', 422, 'VALIDATION_ERROR', parseResult.error.format());
      return;
    }

    const { biscuitId, quantity } = parseResult.data;
    const biscuit = BISCUIT_CATALOG[biscuitId as BiscuitType];
    const totalCost = biscuit.costPoops * BigInt(quantity);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Deduct cost from Poops balance via LedgerService
        const { balanceAfter } = await LedgerService.executeBalanceTransaction(tx, {
          userId,
          type: 'BISCUIT_PURCHASE',
          amount: -totalCost,
          description: `Purchased ${quantity}x ${biscuit.name} for ${totalCost} Poops`,
          idempotencyKey: `purchase_${userId}_${biscuitId}_${Date.now()}`,
        });

        // 2. Increment user inventory
        await tx.userInventory.upsert({
          where: { userId_biscuitId: { userId, biscuitId } },
          create: { userId, biscuitId, quantity },
          update: { quantity: { increment: quantity } },
        });

        // 3. Get current production rate
        const settlement = await tx.miningSettlement.findUnique({
          where: { userId },
          select: { totalRatePerHour: true },
        });

        return {
          newBalance: Number(balanceAfter),
          rate: settlement?.totalRatePerHour ?? 10,
        };
      });

      const newInventory = await StoreController.getInventoryDto(userId);

      sendSuccess(res, {
        biscuitId,
        quantityPurchased: quantity,
        totalCostPoops: Number(totalCost),
        newBalancePoops: result.newBalance,
        newInventory,
        newProductionRate: result.rate,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Purchase failed';
      sendError(res, msg, 400, 'PURCHASE_FAILED');
    }
  }

  /**
   * POST /api/v1/store/feed
   * Deducts biscuits from inventory, permanently increases mining production boost,
   * and records feeding event for player rank progression.
   */
  public static async feedBiscuit(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      return;
    }

    const parseResult = feedSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 'Invalid feeding request', 422, 'VALIDATION_ERROR', parseResult.error.format());
      return;
    }

    const { biscuitId, count } = parseResult.data;
    const biscuit = BISCUIT_CATALOG[biscuitId as BiscuitType];
    const totalBoost = biscuit.boostPerHour * count;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Verify user has enough biscuits
        const inv = await tx.userInventory.findUnique({
          where: { userId_biscuitId: { userId, biscuitId } },
        });

        if (!inv || inv.quantity < count) {
          throw new Error(`Insufficient ${biscuit.name} in inventory (Required: ${count}, Available: ${inv?.quantity ?? 0})`);
        }

        // 2. Deduct biscuits from inventory
        await tx.userInventory.update({
          where: { userId_biscuitId: { userId, biscuitId } },
          data: { quantity: { decrement: count } },
        });

        // 3. Update mining settlement production boost permanently
        const updatedSettlement = await tx.miningSettlement.update({
          where: { userId },
          data: {
            boostRatePerHour: { increment: totalBoost },
            totalRatePerHour: { increment: totalBoost },
          },
        });

        // 4. Log feeding event
        await tx.feedingEvent.create({
          data: {
            userId,
            biscuitId,
            quantity: count,
            boostAdded: totalBoost,
          },
        });

        return { newProductionRate: updatedSettlement.totalRatePerHour };
      });

      const newInventory = await StoreController.getInventoryDto(userId);

      sendSuccess(res, {
        newProductionRate: result.newProductionRate,
        newInventory,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Feeding failed';
      sendError(res, msg, 400, 'FEEDING_FAILED');
    }
  }
}

