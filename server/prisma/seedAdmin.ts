import { PrismaClient, AdminRole } from '@prisma/client';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config();

const connectionUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionUrl,
    },
  },
});

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function seed() {
  console.log('--- Seeding SuperTom Initial Super Admin ---');

  const adminEmail = 'admin@supertom.io';
  const existing = await prisma.adminUser.findUnique({
    where: { email: adminEmail },
  });

  const passwordHash = hashPassword('shahid@Admin2026');

  if (!existing) {
    const admin = await prisma.adminUser.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'SuperTom Director',
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    console.log(`✔ Super Admin created: ${admin.email} (Role: ${admin.role})`);
  } else {
    await prisma.adminUser.update({
      where: { email: adminEmail },
      data: { passwordHash },
    });
    console.log(`✔ Super Admin password updated successfully for: ${existing.email}`);
  }

  // Also seed default biscuit products if empty
  const biscuitCount = await prisma.biscuitProduct.count();
  if (biscuitCount === 0) {
    console.log('Seeding biscuit catalog...');
    await prisma.biscuitProduct.createMany({
      data: [
        {
          id: 'common',
          name: 'Common Biscuit',
          costPoops: 200n,
          productionBoostPerHour: 1,
          badge: 'Bronze',
          color: '#CD7F32',
          borderColor: '#8B4513',
          glowColor: 'rgba(205, 127, 50, 0.4)',
          description: 'Basic crunchy feline nutrition that provides a steady +1 Poop/hr boost.',
          isActive: true,
        },
        {
          id: 'silver',
          name: 'Silver Biscuit',
          costPoops: 500n,
          productionBoostPerHour: 3,
          badge: 'Silver',
          color: '#C0C0C0',
          borderColor: '#A9A9A9',
          glowColor: 'rgba(192, 192, 192, 0.4)',
          description: 'Refined royal snack granting an immediate +3 Poops/hr boost.',
          isActive: true,
        },
        {
          id: 'gold',
          name: 'Gold Biscuit',
          costPoops: 1200n,
          productionBoostPerHour: 8,
          badge: 'Gold',
          color: '#FFD700',
          borderColor: '#DAA520',
          glowColor: 'rgba(255, 215, 0, 0.5)',
          description: 'Gilded gourmet confection boosting King Tom by +8 Poops/hr.',
          isActive: true,
        },
        {
          id: 'diamond',
          name: 'Diamond Biscuit',
          costPoops: 3000n,
          productionBoostPerHour: 25,
          badge: 'Diamond',
          color: '#B9F2FF',
          borderColor: '#00BFFF',
          glowColor: 'rgba(0, 191, 255, 0.6)',
          description: 'The pinnacle of feline delicacies! Accelerates production by a massive +25 Poops/hr.',
          isActive: true,
        },
      ],
    });
    console.log('✔ Biscuits seeded');
  }

  console.log('--- Seeding Complete ---');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
