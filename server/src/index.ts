import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, prisma } from './config/database.js';
import { logger } from './utils/logger.js';
import { CampaignService } from './modules/campaign/campaignService.js';
import { PayoutAutomationService } from './modules/payoutAutomation/payoutAutomationService.js';
import { TelegramBotController } from './modules/telegramBot/telegramBotController.js';
import { MiningService } from './modules/mining/miningService.js';
import { AutoDepositMonitor } from './modules/payouts/autoDepositMonitor.js';

async function bootstrap() {
  const app = createApp();

  // Attempt database connection
  await connectDatabase();

  // Verify and register Telegram Bot Webhook
  await TelegramBotController.ensureWebhookRegistered();

  // Start Autonomous Blockchain Deposit Detection & Verification System
  AutoDepositMonitor.start();

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`👑 SuperTom Backend Server running on http://${env.HOST}:${env.PORT}`);
    logger.info(`📚 Swagger Documentation live on http://${env.HOST}:${env.PORT}/api/docs`);
    logger.info(`🩺 Health check live on http://${env.HOST}:${env.PORT}/health`);
  });

  // 5K Celebration Campaign: Automated Daily Reward Scheduler
  // Runs every 5 minutes on Render, checking for eligible daily rewards across all participants
  const campaignSchedulerInterval = setInterval(async () => {
    try {
      const res = await CampaignService.processScheduledDailyRewards();
      if (res.processedCount > 0) {
        logger.info(`[CampaignScheduler] Auto-credited ${res.processedCount} daily rewards (+${res.totalPoopsAwarded.toLocaleString()} Poops).`);
      }
    } catch (schedErr) {
      logger.error('[CampaignScheduler] Error in daily reward job:', schedErr);
    }
  }, 5 * 60 * 1000);

  // Payout Channel Automation: Real-time background watcher for reference channel payouts
  // Runs every 30 seconds to check for the latest payout message and auto-reflect to SuperTom channel
  const payoutAutomationInterval = setInterval(async () => {
    try {
      const res = await PayoutAutomationService.checkAndPublishLatestReferencePayout();
      if (res.processed) {
        logger.info(`[PayoutAutomationScheduler] Auto-broadcasted latest reference payout (${res.postId}): ${res.message}`);
      }
    } catch (autoErr) {
      logger.error('[PayoutAutomationScheduler] Error checking reference channel:', autoErr);
    }
  }, 30 * 1000);

  // Hourly Mining Settlement Scheduler: Auto-adds poops to main balances 24 times/day
  // Runs every 2 minutes to settle any completed hours for active miners
  const miningSchedulerInterval = setInterval(async () => {
    try {
      const res = await MiningService.processScheduledHourlySettlements();
      if (res.processedCount > 0) {
        logger.info(`[MiningScheduler] Auto-credited ${res.processedCount} players (+${res.totalPoopsAwarded.toLocaleString()} Poops hourly additions).`);
      }
    } catch (miningErr) {
      logger.error('[MiningScheduler] Error in hourly mining job:', miningErr);
    }
  }, 2 * 60 * 1000);

  // Render Anti-Sleep Keepalive: Pings public health endpoint every 10 minutes to prevent free-tier spin-down
  const keepAliveInterval = setInterval(async () => {
    try {
      const publicBackendUrl = process.env.BACKEND_PUBLIC_URL || 'https://supertom-backend.onrender.com';
      await fetch(`${publicBackendUrl}/health`, {
        headers: { 'User-Agent': 'SuperTom-AntiSleep/1.0' },
      });
    } catch {
      // Ignore background keepalive errors
    }
  }, 10 * 60 * 1000);

  // Graceful shutdown handling for Render deployments
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    AutoDepositMonitor.stop();
    clearInterval(campaignSchedulerInterval);
    clearInterval(payoutAutomationInterval);
    clearInterval(miningSchedulerInterval);
    clearInterval(keepAliveInterval);
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await prisma.$disconnect();
        logger.info('Database connection pool disconnected.');
      } catch (err) {
        logger.error('Error disconnecting database:', err);
      }
      process.exit(0);
    });

    // Force exit after 10s timeout
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal bootstrap failure:', err);
  process.exit(1);
});

