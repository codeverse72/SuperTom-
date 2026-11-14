const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.deposit.count();
  const byStatus = await prisma.deposit.groupBy({
    by: ['status'],
    _count: { id: true }
  });
  console.log('Total deposits:', count);
  console.log('By status:', JSON.stringify(byStatus, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

