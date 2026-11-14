/**
 * Payment & Payout Service
 * 
 * Handles multi-currency Deposits, USDT withdrawals, and transaction history.
 */

import { apiClient } from './apiClient';
import { 
  ApiResponse, 
  WithdrawalRequestDto, 
  TransactionDto, 
  DepositDto, 
  DepositRequestDto,
  TreasuryWalletsResponseDto,
  CreateDepositIntentRequestDto,
  CreateDepositIntentResponseDto,
  DepositStatusResponseDto
} from './types';

export const paymentService = {
  getHistory: async (): Promise<ApiResponse<TransactionDto[]>> => {
    return apiClient.get<TransactionDto[]>('/payouts/history');
  },
  
  requestWithdrawal: async (req: WithdrawalRequestDto): Promise<ApiResponse<TransactionDto>> => {
    return apiClient.post<TransactionDto>('/payouts/request', req);
  },

  getTreasuryWallets: async (): Promise<ApiResponse<TreasuryWalletsResponseDto>> => {
    return apiClient.get<TreasuryWalletsResponseDto>('/payouts/treasury-wallets');
  },

  getDeposits: async (): Promise<ApiResponse<DepositDto[]>> => {
    return apiClient.get<DepositDto[]>('/payouts/deposits');
  },

  submitDeposit: async (data: DepositRequestDto): Promise<ApiResponse<DepositDto>> => {
    return apiClient.post<DepositDto>('/payouts/deposits', data);
  },

  createDepositIntent: async (data: CreateDepositIntentRequestDto): Promise<ApiResponse<CreateDepositIntentResponseDto>> => {
    return apiClient.post<CreateDepositIntentResponseDto>('/payouts/deposits/create', data);
  },

  getDepositStatus: async (depositId: string): Promise<ApiResponse<DepositStatusResponseDto>> => {
    return apiClient.get<DepositStatusResponseDto>(`/payouts/deposits/${depositId}/status`);
  },

  checkOnChainDeposit: async (depositId: string): Promise<ApiResponse<import('./types').CheckOnChainResponseDto>> => {
    return apiClient.post<import('./types').CheckOnChainResponseDto>(`/payouts/deposits/${depositId}/check-onchain`);
  },

  verifyDeposit: async (depositId: string, txHash: string): Promise<ApiResponse<{
    success: boolean;
    isCompleted?: boolean;
    status: string;
    txHash?: string;
    explorerUrl?: string;
    confirmations?: number;
    requiredConfirmations?: number;
    newBalance?: number;
    message: string;
  }>> => {
    return apiClient.post(`/payouts/deposits/${depositId}/verify`, { txHash });
  },

  saveWallet: async (data: { walletAddress: string; network: string }): Promise<ApiResponse<any>> => {
    return apiClient.post('/payouts/wallets', data);
  },

  getWithdrawalEntitlement: async (): Promise<ApiResponse<import('./types').WithdrawalEntitlementDto>> => {
    return apiClient.get<import('./types').WithdrawalEntitlementDto>('/payouts/entitlement');
  },

  claimAdWithdrawalUnlock: async (): Promise<ApiResponse<{
    success: boolean;
    remainingWithdrawals: number;
    message: string;
  }>> => {
    return apiClient.post('/payouts/claim-ad-unlock');
  },
};
