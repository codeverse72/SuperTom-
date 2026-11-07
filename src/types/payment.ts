/**
 * Payout and Payment System Types
 */

export type TransactionStatus = 'Pending' | 'Approved' | 'Processing' | 'Completed' | 'Rejected';

export interface WithdrawalRecord {
  id: string;
  timestamp: number;
  amountPoops: number;
  amountUsdt: number;
  walletAddress: string;
  network: 'TRC20' | 'TON' | 'BEP20';
  status: TransactionStatus;
  txHash?: string;
  rejectionReason?: string;
}

export interface WithdrawalValidationResult {
  isValid: boolean;
  errors: {
    address?: string;
    amount?: string;
    balance?: string;
  };
}
