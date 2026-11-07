/**
 * User Service
 * 
 * Fetches authenticated player profile, stats, and balance.
 */

import { apiClient } from './apiClient';
import { ApiResponse, UserSessionDto, BalanceDto } from './types';

export const userService = {
  getCurrentUser: async (): Promise<ApiResponse<UserSessionDto>> => {
    return apiClient.get<UserSessionDto>('/user/me');
  },
  getBalance: async (): Promise<ApiResponse<BalanceDto>> => {
    return apiClient.get<BalanceDto>('/user/balance');
  }
};
