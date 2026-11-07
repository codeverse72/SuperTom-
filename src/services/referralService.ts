/**
 * Referral Program Service
 */

import { apiClient } from './apiClient';
import { ApiResponse, ReferralStatsDto } from './types';

export const referralService = {
  getStats: async (): Promise<ApiResponse<ReferralStatsDto>> => {
    return apiClient.get<ReferralStatsDto>('/referrals/stats');
  }
};
