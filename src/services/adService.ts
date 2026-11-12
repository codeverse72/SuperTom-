import { apiClient } from './apiClient';
import { ApiResponse } from './types';

export interface CreateAdSessionResponse {
  sessionId: string;
  sessionToken: string;
  provider: string;
  placementId: string;
  expiresAt: string;
}

export interface CompleteAdSessionResponse {
  completed: boolean;
  sessionId: string;
  progress: number;
  total: number;
  isQuestCompleted: boolean;
  message?: string;
}

export interface AdSessionStatusResponse {
  id: string;
  userId: string;
  provider: string;
  placementId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  isCompleted: boolean;
  viewDurationMs?: number | null;
  createdAt: string;
  completedAt?: string | null;
  expiresAt: string;
}

export const adService = {
  /**
   * Cryptographically creates a backend-verified rewarded ad session.
   */
  async createSession(): Promise<ApiResponse<CreateAdSessionResponse>> {
    return apiClient.post<CreateAdSessionResponse>('/ads/session/create', {});
  },

  /**
   * Atomically verifies ad playback completion and records quest progress on backend.
   */
  async completeSession(
    sessionId: string,
    sessionToken: string,
    viewDurationMs: number
  ): Promise<ApiResponse<CompleteAdSessionResponse>> {
    return apiClient.post<CompleteAdSessionResponse>('/ads/session/complete', {
      sessionId,
      sessionToken,
      viewDurationMs,
    });
  },

  /**
   * Retrieves ad session status.
   */
  async getSessionStatus(sessionId: string): Promise<ApiResponse<AdSessionStatusResponse>> {
    return apiClient.get<AdSessionStatusResponse>(`/ads/session/${sessionId}`);
  },
};

