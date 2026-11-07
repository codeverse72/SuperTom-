/**
 * Mining & Poop Production Service
 */

import { apiClient } from './apiClient';
import { ApiResponse, MiningRateDto } from './types';

export const miningService = {
  getMiningStatus: async (): Promise<ApiResponse<MiningRateDto>> => {
    return apiClient.get<MiningRateDto>('/mining/status');
  },
  claimMiningEarnings: async (): Promise<ApiResponse<{ claimedAmount: number; newBalance: number }>> => {
    return apiClient.post<{ claimedAmount: number; newBalance: number }>('/mining/claim');
  }
};
