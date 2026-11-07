import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClientInstance: PrismaClient | undefined;
}

/**
 * Singleton PrismaClient for Supabase PostgreSQL connection management.
 * In development, hot-reloading preserves the same instance to prevent exhausting pool connections.
 */
export const prisma: PrismaClient =
  global.__prismaClientInstance ||
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  global.__prismaClientInstance = prisma;
}

export async function connectDatabase(): Promise<boolean> {
  try {
    await prisma.$connect();
    console.log('✅ Connected to Supabase PostgreSQL database via Prisma.');
    return true;
  } catch (err: unknown) {
    console.warn('⚠️ Database connection deferred (offline/staging mode active):', err instanceof Error ? err.message : err);
    return false;
  }
}

