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
  TreasuryWalletsResponseDto
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
};
