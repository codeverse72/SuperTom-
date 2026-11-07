import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 300000);

export function createRateLimiter(windowMs: number = 60000, maxRequests: number = 60) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    const record = rateLimitStore.get(key as string);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key as string, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      sendError(res, 'Too many requests. Please slow down.', 429, 'RATE_LIMIT_EXCEEDED');
      return;
    }

    record.count++;
    next();
  };
}

