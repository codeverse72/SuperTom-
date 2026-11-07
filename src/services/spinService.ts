/**
 * Spin Reward Wheel Service
 */

import { apiClient } from './apiClient';
import { ApiResponse, SpinStatusDto, SpinClaimResultDto } from './types';

export const spinService = {
  getSpinStatus: async (): Promise<ApiResponse<SpinStatusDto>> => {
    return apiClient.get<SpinStatusDto>('/spin/status');
  },
  claimSpin: async (): Promise<ApiResponse<SpinClaimResultDto>> => {
    return apiClient.post<SpinClaimResultDto>('/spin/claim');
  }
};
