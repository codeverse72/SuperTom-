import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  telegramId: string;
  username?: string;
}

/**
 * Signs a JWT Access Token.
 */
export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Signs a JWT Refresh Token for session rotation.
 */
export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifies and decodes a JWT Access Token.
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Verifies and decodes a JWT Refresh Token.
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Generates a cryptographically secure random uniform float [0, 1).
 */
export function secureRandomFloat(): number {
  const randomBuffer = crypto.randomBytes(4);
  const randomUint32 = randomBuffer.readUInt32LE(0);
  return randomUint32 / 0x100000000;
}

/**
 * Hashes a string using SHA-256 for session token storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validates TRON TRC20 Wallet Address format.
 * Must start with 'T', contain valid Base58 characters, and be exactly 34 characters long.
 */
export function isValidTronAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  const tronRegex = /^T[1-9A-HJ-NP-za-km-z]{33}$/;
  return tronRegex.test(trimmed);
}

