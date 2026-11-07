import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface TelegramUserPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

export interface ValidatedInitData {
  query_id?: string;
  user: TelegramUserPayload;
  auth_date: number;
  hash: string;
  start_param?: string;
}

/**
 * Cryptographically validates Telegram Mini App raw initData using HMAC-SHA256.
 * Complies with official Telegram WebApps specification:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * 
 * Replay protection: Rejects authentication attempts older than maxAgeSeconds (default: 86400s / 24h).
 */
export function verifyTelegramInitData(
  initDataRaw: string,
  botToken: string = env.TELEGRAM_BOT_TOKEN,
  maxAgeSeconds: number = 86400
): { isValid: boolean; data?: ValidatedInitData; error?: string } {
  if (!initDataRaw || typeof initDataRaw !== 'string') {
    return { isValid: false, error: 'Empty or missing initData string' };
  }

  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');

    if (!hash) {
      return { isValid: false, error: 'Missing signature hash parameter' };
    }

    // Extract auth_date and verify freshness (anti-replay check)
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      return { isValid: false, error: 'Missing auth_date timestamp parameter' };
    }

    const authDate = parseInt(authDateStr, 10);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (isNaN(authDate)) {
      return { isValid: false, error: 'Invalid auth_date format' };
    }

    // Reject if expired or from the future (> 60s clock skew)
    if (nowSeconds - authDate > maxAgeSeconds) {
      return { isValid: false, error: 'Telegram authentication expired (replay protection triggered)' };
    }

    if (authDate - nowSeconds > 60) {
      return { isValid: false, error: 'Telegram auth_date is too far in the future' };
    }

    // Extract and parse user JSON object
    const userJson = params.get('user');
    if (!userJson) {
      return { isValid: false, error: 'Missing user payload in initData' };
    }

    let user: TelegramUserPayload;
    try {
      user = JSON.parse(userJson);
      if (!user.id) {
        return { isValid: false, error: 'Invalid user payload: id is required' };
      }
    } catch {
      return { isValid: false, error: 'Malformed user JSON payload' };
    }

    // Allow mock pass in local development only if token is default test token
    if (env.NODE_ENV === 'development' && botToken === 'TEST_BOT_TOKEN_PLACEHOLDER') {
      return {
        isValid: true,
        data: {
          query_id: params.get('query_id') || undefined,
          user,
          auth_date: authDate,
          hash,
          start_param: params.get('start_param') || undefined,
        },
      };
    }

    // 1. Construct data-check-string (all params sorted alphabetically, excluding 'hash')
    const pairs: string[] = [];
    params.forEach((value, key) => {
      if (key !== 'hash') {
        pairs.push(`${key}=${value}`);
      }
    });
    pairs.sort();
    const dataCheckString = pairs.join('\n');

    // 2. Compute secret_key: HMAC-SHA256 of botToken with constant key 'WebAppData'
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

    // 3. Compute expected hash: HMAC-SHA256 of dataCheckString using secretKey
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // 4. Timing-safe comparison to prevent timing side-channel attacks
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
    const receivedBuffer = Buffer.from(hash, 'hex');

    if (calculatedBuffer.length !== receivedBuffer.length) {
      return { isValid: false, error: 'Invalid HMAC signature length' };
    }

    const isMatch = crypto.timingSafeEqual(calculatedBuffer, receivedBuffer);
    if (!isMatch) {
      return { isValid: false, error: 'Cryptographic signature mismatch (unauthorized initData)' };
    }

    return {
      isValid: true,
      data: {
        query_id: params.get('query_id') || undefined,
        user,
        auth_date: authDate,
        hash,
        start_param: params.get('start_param') || undefined,
      },
    };
  } catch (err: unknown) {
    return {
      isValid: false,
      error: `Validation error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
