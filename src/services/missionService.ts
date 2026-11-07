/**
 * Mission System Service
 */

import { apiClient } from './apiClient';
import { ApiResponse, MissionDto } from './types';

export const missionService = {
  getMissions: async (): Promise<ApiResponse<MissionDto[]>> => {
    return apiClient.get<MissionDto[]>('/missions');
  },
  verifyMission: async (missionId: string): Promise<ApiResponse<{ verified: boolean; mission: MissionDto }>> => {
    return apiClient.post<{ verified: boolean; mission: MissionDto }>(`/missions/${missionId}/verify`);
  },
  claimMissionReward: async (missionId: string): Promise<ApiResponse<{ rewardPoops: number; newBalance: number }>> => {
    return apiClient.post<{ rewardPoops: number; newBalance: number }>(`/missions/${missionId}/claim`);
  }
};
