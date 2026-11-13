import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('=== SUPERTOM LIVE DATABASE AUDIT ===');
  
  // 1. Users
  const totalUsers = await prisma.user.count();
  const bannedUsers = await prisma.user.count({ where: { accountStatus: 'BANNED' } });
  
  const now = new Date();
  const d1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const dau = await prisma.user.count({ where: { updatedAt: { gte: d1 } } });
  const wau = await prisma.user.count({ where: { updatedAt: { gte: d7 } } });
  const mau = await prisma.user.count({ where: { updatedAt: { gte: d30 } } });

  // 2. Deposits
  const totalDeposits = await prisma.deposit.count();
  const deposits = await prisma.deposit.findMany({
    include: {
      user: {
        select: {
          telegramId: true,
          username: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Deposit Status breakdown
  const statusCounts = {};
  let totalConfirmedUsdt = 0;
  let uniqueDepositors = new Set();
  let uniqueInitiators = new Set();
  const currencyCounts = {};
  const networkCounts = {};

  for (const d of deposits) {
    statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
    if (d.userId) uniqueInitiators.add(d.userId);
    
    const curr = d.currency || 'UNKNOWN';
    currencyCounts[curr] = (currencyCounts[curr] || 0) + 1;
    networkCounts[d.network] = (networkCounts[d.network] || 0) + 1;

    if (['COMPLETED', 'CONFIRMED', 'SUCCESS'].includes(d.status)) {
      totalConfirmedUsdt += Number(d.amountUsdt || 0);
      if (d.userId) uniqueDepositors.add(d.userId);
    }
  }

  // 3. Withdrawals
  const totalWithdrawals = await prisma.withdrawal.count();
  const withdrawals = await prisma.withdrawal.findMany({
    orderBy: { createdAt: 'desc' }
  });
  const withdrawalStatusCounts = {};
  let totalWithdrawnUsdt = 0;
  for (const w of withdrawals) {
    withdrawalStatusCounts[w.status] = (withdrawalStatusCounts[w.status] || 0) + 1;
    if (['COMPLETED', 'CONFIRMED', 'SUCCESS'].includes(w.status)) {
      totalWithdrawnUsdt += Number(w.amountUsdt || 0);
    }
  }

  // 4. Mining & Balances
  const usersWithBalance = await prisma.user.findMany({
    select: {
      id: true,
      telegramId: true,
      poopsBalance: true,
      miningSettlement: {
        select: {
          totalRatePerHour: true,
          boostRatePerHour: true,
          unclaimedPoops: true
        }
      }
    },
    orderBy: { poopsBalance: 'desc' },
    take: 10
  });

  // 5. Missions & Quests
  const totalUserMissions = await prisma.userMission.count();
  const completedMissions = await prisma.userMission.count({ where: { status: 'CLAIMED' } });

  // 6. Referrals
  const referralsCount = await prisma.user.count({ where: { referredById: { not: null } } });

  // 7. Entitlements
  const usersWithUnlimited = await prisma.user.count({ where: { hasUnlimitedWithdrawals: true } });
  const usersWithRemaining = await prisma.user.count({ where: { remainingWithdrawals: { gt: 0 } } });

  console.log(JSON.stringify({
    users: {
      total: totalUsers,
      banned: bannedUsers,
      dauApprox: dau,
      wauApprox: wau,
      mauApprox: mau,
      withReferrer: referralsCount,
      usersWithUnlimitedWithdrawals: usersWithUnlimited,
      usersWithRemainingWithdrawals: usersWithRemaining
    },
    deposits: {
      totalCount: totalDeposits,
      uniqueInitiatorsCount: uniqueInitiators.size,
      uniqueConfirmedDepositorsCount: uniqueDepositors.size,
      statusBreakdown: statusCounts,
      currencyBreakdown: currencyCounts,
      networkBreakdown: networkCounts,
      totalConfirmedVolumeUsdt: totalConfirmedUsdt,
      allDepositsDetail: deposits.map(d => ({
        id: d.id,
        user: d.user ? `${d.user.telegramId} (@${d.user.username})` : 'UNIDENTIFIED',
        amountUsdt: Number(d.amountUsdt),
        amountPoops: d.amountPoops.toString(),
        currency: d.currency,
        network: d.network,
        status: d.status,
        txHash: d.txHash ? (d.txHash.slice(0, 10) + '...' + d.txHash.slice(-8)) : null,
        confirmations: d.confirmations,
        notes: d.notes,
        createdAt: d.createdAt
      }))
    },
    withdrawals: {
      totalCount: totalWithdrawals,
      statusBreakdown: withdrawalStatusCounts,
      totalWithdrawnUsdt,
      recent: withdrawals.slice(0, 5).map(w => ({
        id: w.id,
        amountUsdt: Number(w.amountUsdt),
        status: w.status,
        network: w.network,
        createdAt: w.createdAt
      }))
    },
    topUsers: usersWithBalance.map(u => ({
      telegramId: u.telegramId.toString(),
      balance: u.poopsBalance.toString(),
      ratePerHour: u.miningSettlement?.totalRatePerHour,
      unclaimed: u.miningSettlement?.unclaimedPoops?.toString()
    })),
    missions: {
      totalRows: totalUserMissions,
      claimedCount: completedMissions
    }
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
