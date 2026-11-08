/**
 * Payout and Payment System Types
 */

export type TransactionStatus = 'Pending' | 'Approved' | 'Processing' | 'Completed' | 'Rejected' | string;
export type DepositStatus = 'Pending' | 'Confirmed' | 'Rejected' | 'Completed' | 'Processing' | 'Waiting_for_payment' | 'Payment_detected' | 'Confirming' | string;

export type SupportedCurrency = 
  | 'GRAM'
  | 'USDT (BEP20)'
  | 'USDT (TRC20)'
  | 'BNB'
  | 'TRX'
  | 'SOL (Solana)'
  | 'Base (USDC / ETH)';

export interface WithdrawalRecord {
  id: string;
  timestamp: number;
  amountPoops: number;
  amountUsdt: number;
  walletAddress: string;
  network: string;
  status: TransactionStatus;
  txHash?: string;
  rejectionReason?: string;
}

export interface DepositRecord {
  id: string;
  timestamp: number;
  amountUsdt: number;
  amountPoops: number;
  network: string;
  status: DepositStatus;
  txHash?: string;
  notes?: string;
}

export interface TreasuryWalletInfo {
  currency: string;
  network: string;
  address: string;
  hint: string;
}

export interface WithdrawalValidationResult {
  isValid: boolean;
  errors: {
    address?: string;
    amount?: string;
    balance?: string;
  };
}
