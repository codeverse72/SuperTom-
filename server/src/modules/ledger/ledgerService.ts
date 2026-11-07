import { Prisma, LedgerType } from '@prisma/client';
import { prisma } from '../../config/database.js';

export interface RecordTransactionParams {
  userId: string;
  type: LedgerType;
  amount: bigint; // positive = credit, negative = debit
  description: string;
  referenceId?: string;
  idempotencyKey?: string;
}

export class LedgerService {
  /**
   * Executes an atomic balance update with an immutable double-entry ledger record.
   * Runs inside an isolated Prisma transaction to prevent race conditions.
   */
  public static async executeBalanceTransaction(
    tx: Prisma.TransactionClient,
    params: RecordTransactionParams
  ): Promise<{ balanceBefore: bigint; balanceAfter: bigint }> {
    // 1. Fetch and lock user record for update
    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: { poopsBalance: true },
    });

    if (!user) {
      throw new Error(`User ${params.userId} not found for balance update`);
    }

    const balanceBefore = user.poopsBalance;
    const balanceAfter = balanceBefore + params.amount;

    // Guard against negative balance
    if (balanceAfter < 0n) {
      throw new Error(`Insufficient Poops balance: Required ${-params.amount}, available ${balanceBefore}`);
    }

    // 2. Update user balance
    await tx.user.update({
      where: { id: params.userId },
      data: { poopsBalance: balanceAfter },
    });

    // 3. Create immutable ledger record
    await tx.ledgerEntry.create({
      data: {
        userId: params.userId,
        type: params.type,
        amount: params.amount,
        balanceBefore,
        balanceAfter,
        referenceId: params.referenceId,
        idempotencyKey: params.idempotencyKey,
        description: params.description,
      },
    });

    return { balanceBefore, balanceAfter };
  }

  /**
   * Safe wrapper that automatically creates transaction if not passed.
   */
  public static async record(params: RecordTransactionParams) {
    return prisma.$transaction(async (tx) => {
      return this.executeBalanceTransaction(tx, params);
    });
  }
}
