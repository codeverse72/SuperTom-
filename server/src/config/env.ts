import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  HOST: z.string().default('0.0.0.0'),
  
  // Database (Supabase PostgreSQL)
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/supertom'),
  DIRECT_URL: z.string().optional(),
  
  // Telegram Bot Credentials
  TELEGRAM_BOT_TOKEN: z.string().default('TEST_BOT_TOKEN_PLACEHOLDER'),
  TELEGRAM_BOT_USERNAME: z.string().default('SuperTomBot'),
  
  // Security & JWT
  JWT_SECRET: z.string().default('supertom_jwt_super_secret_key_production_2026_xyz'),
  JWT_REFRESH_SECRET: z.string().default('supertom_refresh_secret_key_production_2026_abc'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // CORS & Client
  FRONTEND_URL: z.string().default('*'),
  
  // Game Economy Rules
  POOPS_PER_USDT: z.string().default('2000').transform((val) => parseInt(val, 10)),
  MIN_WITHDRAWAL_POOPS: z.string().default('2000').transform((val) => parseInt(val, 10)),
  MINING_BASE_RATE: z.string().default('10').transform((val) => parseInt(val, 10)),
  REFERRAL_SIGNUP_BONUS_POOPS: z.string().default('2000').transform((val) => parseInt(val, 10)),
  REFERRAL_COMMISSION_PERCENT: z.string().default('10').transform((val) => parseInt(val, 10)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration error');
}

export const env = parsed.data;
