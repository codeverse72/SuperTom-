import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, prisma } from './config/database.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  const app = createApp();

  // Attempt database connection
  await connectDatabase();

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`👑 SuperTom Backend Server running on http://${env.HOST}:${env.PORT}`);
    logger.info(`📚 Swagger Documentation live on http://${env.HOST}:${env.PORT}/api/docs`);
    logger.info(`🩺 Health check live on http://${env.HOST}:${env.PORT}/health`);
  });

  // Graceful shutdown handling for Render deployments
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
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
