/**
 * Payment & Payout Service
 * 
 * Handles USDT TRC20 withdrawal requests and transaction history.
 */

import { apiClient } from './apiClient';
import { ApiResponse, WithdrawalRequestDto, TransactionDto } from './types';

export const paymentService = {
  getHistory: async (): Promise<ApiResponse<TransactionDto[]>> => {
    return apiClient.get<TransactionDto[]>('/payouts/history');
  },
  requestWithdrawal: async (req: WithdrawalRequestDto): Promise<ApiResponse<TransactionDto>> => {
    return apiClient.post<TransactionDto>('/payouts/request', req);
  }
};
