import { apiClient } from './apiClient';
import { ApiResponse, CampaignStatusResponseDto } from './types';

export const campaignService = {
  /**
   * Fetches the active 5K Members Celebration campaign config & user's live participation status
   */
  getStatus: async (): Promise<ApiResponse<CampaignStatusResponseDto>> => {
    return apiClient.get<CampaignStatusResponseDto>('/campaign/status');
  },

  /**
   * Fetches general public campaign details and tier breakdown
   */
  getInfo: async (): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/campaign/info');
  },
};
