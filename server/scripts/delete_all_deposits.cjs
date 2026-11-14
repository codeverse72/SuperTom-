const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.deposit.deleteMany({});
  console.log(`Successfully deleted ${result.count} deposit requests from the database.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

