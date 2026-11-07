/**
 * Centralized Validation Utilities
 * 
 * Provides robust validation for cryptocurrency addresses,
 * numeric inputs, and financial amounts.
 */

import { WithdrawalValidationResult } from '../types/payment';
import { MIN_WITHDRAWAL_POOPS } from '../config/gameConfig';

/**
 * Validates a TRON (TRC20) address format.
 * - Starts with 'T'
 * - Exactly 34 characters
 * - Base58 characters only (no 0, O, I, l)
 * 
 * Note: Format validation does NOT guarantee wallet ownership or active status on the TRON ledger.
 */
export function validateTronAddress(address: string): { isValid: boolean; error?: string } {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'Wallet address is required.' };
  }

  const trimmed = address.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'Wallet address cannot be empty.' };
  }

  if (trimmed.length !== 34) {
    return { isValid: false, error: `Invalid TRON address length (${trimmed.length}/34 characters).` };
  }

  if (!trimmed.startsWith('T')) {
    return { isValid: false, error: "TRON addresses must start with the letter 'T'." };
  }

  // Base58 characters only: 1-9, A-H, J-N, P-Z, a-k, m-z
  const base58Regex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
  if (!base58Regex.test(trimmed)) {
    return { isValid: false, error: 'Address contains invalid Base58 characters.' };
  }

  return { isValid: true };
}

/**
 * Validates a withdrawal request amount.
 */
export function validateWithdrawalAmount(
  amountInput: string | number,
  currentBalance: number | null
): { isValid: boolean; amount: number; error?: string } {
  const num = typeof amountInput === 'string' ? Number(amountInput.trim()) : amountInput;

  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, amount: 0, error: 'Please enter a valid numeric amount.' };
  }

  if (num <= 0) {
    return { isValid: false, amount: num, error: 'Withdrawal amount must be greater than zero.' };
  }

  if (!Number.isInteger(num)) {
    return { isValid: false, amount: num, error: 'Poop amounts must be whole integers.' };
  }

  if (num < MIN_WITHDRAWAL_POOPS) {
    return { 
      isValid: false, 
      amount: num, 
      error: `Minimum withdrawal is ${MIN_WITHDRAWAL_POOPS.toLocaleString()} Poops (1.00 USDT).` 
    };
  }

  if (currentBalance === null) {
    return { isValid: false, amount: num, error: 'Account balance is unavailable.' };
  }

  if (num > currentBalance) {
    return { 
      isValid: false, 
      amount: num, 
      error: `Insufficient balance. Available: ${currentBalance.toLocaleString()} Poops.` 
    };
  }

  return { isValid: true, amount: num };
}

/**
 * Validates a TON (The Open Network) address format.
 * - Standard user-friendly addresses start with EQ or UQ, 48 characters
 * - Or raw hex address (-1:hex or 0:hex)
 */
export function validateTonAddress(address: string): { isValid: boolean; error?: string } {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'TON address is required.' };
  }
  const trimmed = address.trim();
  const tonRegex = /^(EQ|UQ)[a-zA-Z0-9_-]{46}$|^(-1|0):[0-9a-fA-F]{64}$/;
  if (!tonRegex.test(trimmed)) {
    return { isValid: false, error: 'Invalid TON address. Must be a valid 48-character address starting with EQ or UQ.' };
  }
  return { isValid: true };
}

/**
 * Validates a BEP20 (Binance Smart Chain / EVM) address format.
 * - Starts with 0x
 * - 42 hexadecimal characters
 */
export function validateBscAddress(address: string): { isValid: boolean; error?: string } {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'BEP20 address is required.' };
  }
  const trimmed = address.trim();
  const bscRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!bscRegex.test(trimmed)) {
    return { isValid: false, error: 'Invalid BEP20 address. Must be a valid 42-character address starting with 0x.' };
  }
  return { isValid: true };
}

/**
 * Validates address according to selected network
 */
export function validateNetworkAddress(
  network: 'TRC20' | 'TON' | 'BEP20' | string,
  address: string
): { isValid: boolean; error?: string } {
  if (network === 'TRC20') return validateTronAddress(address);
  if (network === 'TON') return validateTonAddress(address);
  if (network === 'BEP20') return validateBscAddress(address);
  return { isValid: false, error: `Unsupported network: ${network}` };
}

/**
 * Comprehensive withdrawal validation bundle
 */
export function validateWithdrawal(
  address: string,
  amountInput: string | number,
  currentBalance: number | null,
  network: 'TRC20' | 'TON' | 'BEP20' = 'TRC20'
): WithdrawalValidationResult {
  const addressCheck = validateNetworkAddress(network, address);
  const amountCheck = validateWithdrawalAmount(amountInput, currentBalance);

  return {
    isValid: addressCheck.isValid && amountCheck.isValid,
    errors: {
      address: addressCheck.error,
      amount: amountCheck.error,
      balance: currentBalance === null ? 'Balance is currently unavailable.' : undefined
    }
  };
}

/**
 * Basic string sanitizer to prevent injection
 */
export function sanitizeString(input: string): string {
  return input.replace(/[<>]/g, '').trim();
}
