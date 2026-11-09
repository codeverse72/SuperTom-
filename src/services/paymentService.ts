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

  verifyDeposit: async (depositId: string, txHash: string, amountUsdt?: number): Promise<ApiResponse<{ success: boolean; message: string; newBalance?: number }>> => {
    return apiClient.post<{ success: boolean; message: string; newBalance?: number }>(`/payouts/deposits/${depositId}/verify`, { txHash, amountUsdt });
  },

  getWithdrawalEntitlement: async (): Promise<ApiResponse<import('./types').WithdrawalEntitlementDto>> => {
    return apiClient.get<import('./types').WithdrawalEntitlementDto>('/payouts/entitlement');
  },
};
