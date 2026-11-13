import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const newStatuses = [
    'INITIATED',
    'PENDING_PAYMENT',
    'HASH_SUBMITTED',
    'VERIFYING',
    'AWAITING_CONFIRMATIONS',
    'VERIFIED',
    'CREDITED',
    'UNDER_REVIEW'
  ];

  for (const st of newStatuses) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "DepositStatus" ADD VALUE IF NOT EXISTS '${st}'`);
      console.log('Successfully added or verified enum value:', st);
    } catch (err) {
      console.error(`Error adding ${st}:`, err.message);
    }
  }

  // Also verify columns in Deposit table
  const newColumns = [
    `ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "tokenContract" TEXT;`,
    `ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);`,
    `ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "creditedAt" TIMESTAMP(3);`,
    `ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;`,
    `ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "rewardAmount" DECIMAL(18,4);`,
    `ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "explorerUrl" TEXT;`,
  ];

  for (const colSql of newColumns) {
    try {
      await prisma.$executeRawUnsafe(colSql);
      console.log('Executed column DDL:', colSql);
    } catch (cErr) {
      console.error('Column DDL error:', cErr.message);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);

