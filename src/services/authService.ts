/**
 * Authentication Service
 * 
 * Handles Telegram initData verification and session management
 * with the future backend.
 */

import { apiClient } from './apiClient';
import { ApiResponse, UserSessionDto } from './types';

export const authService = {
  /**
   * Transmits raw Telegram initData to backend for cryptographic signature verification.
   */
  authenticateTelegram: async (initData: string): Promise<ApiResponse<UserSessionDto>> => {
    return apiClient.post<UserSessionDto>('/auth/telegram', { initData });
  },

  /**
   * Logs out the current session and clears client auth tokens.
   */
  logout: async (): Promise<ApiResponse<{ loggedOut: boolean }>> => {
    apiClient.setAuthToken(null);
    return { success: true, data: { loggedOut: true } };
  }
};
