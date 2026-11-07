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

/**
 * Validates TON (The Open Network) Wallet Address format.
 * Standard user-friendly addresses start with EQ or UQ and are 48 base64/base64url characters,
 * or raw format (-1:hex or 0:hex).
 */
export function isValidTonAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  const tonRegex = /^(EQ|UQ)[a-zA-Z0-9_-]{46}$|^(-1|0):[0-9a-fA-F]{64}$/;
  return tonRegex.test(trimmed);
}

/**
 * Validates BEP20 (Binance Smart Chain) / EVM Wallet Address format.
 * Starts with 0x followed by 40 hex characters.
 */
export function isValidBscAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  const bscRegex = /^0x[a-fA-F0-9]{40}$/;
  return bscRegex.test(trimmed);
}

/**
 * Validates wallet address according to the chosen blockchain network.
 */
export function validateNetworkAddress(network: string, address: string): { isValid: boolean; error?: string } {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'Wallet address is required' };
  }
  const trimmed = address.trim();
  if (network === 'TRC20') {
    if (!isValidTronAddress(trimmed)) {
      return { isValid: false, error: 'Invalid TRC20 address. TRON addresses start with "T" and contain 34 characters.' };
    }
  } else if (network === 'TON') {
    if (!isValidTonAddress(trimmed)) {
      return { isValid: false, error: 'Invalid TON address. Must be a valid 48-character user-friendly TON address starting with EQ or UQ.' };
    }
  } else if (network === 'BEP20') {
    if (!isValidBscAddress(trimmed)) {
      return { isValid: false, error: 'Invalid BEP20 (BSC) address. Must be a valid 42-character address starting with 0x.' };
    }
  } else {
    return { isValid: false, error: `Unsupported network: ${network}. Supported networks are TRC20, TON, BEP20.` };
  }
  return { isValid: true };
}

export interface AdminTokenPayload {
  adminId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT';
}

/**
 * Hashes a plain-text password using PBKDF2 with a random salt.
 * Returns salt:hash format.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a plain-text password against a stored salt:hash string.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Signs an Admin JWT token.
 */
export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '24h',
  });
}

/**
 * Verifies an Admin JWT token.
 */
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AdminTokenPayload;
    if (decoded && decoded.adminId && decoded.role) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}


