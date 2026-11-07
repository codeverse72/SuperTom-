/**
 * Authentication Service
 * 
 * Handles Telegram initData verification and session management
 * with the Render backend.
 */

import { apiClient } from './apiClient';
import { ApiResponse, UserSessionDto } from './types';

interface AuthResponseData {
  token?: string;
  refreshToken?: string;
  user?: UserSessionDto;
}

export const authService = {
  /**
   * Transmits raw Telegram initData to backend for cryptographic signature verification.
   */
  authenticateTelegram: async (initData: string): Promise<ApiResponse<UserSessionDto>> => {
    const res = await apiClient.post<AuthResponseData>('/auth/telegram', { initData });

    if (res.success && res.data) {
      if (res.data.token) {
        apiClient.setAuthToken(res.data.token);
      }
      return {
        success: true,
        data: res.data.user,
      };
    }

    return {
      success: false,
      error: res.error,
    };
  },

  /**
   * Logs out the current session and clears client auth tokens.
   */
  logout: async (): Promise<ApiResponse<{ loggedOut: boolean }>> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors during logout
    }
    apiClient.setAuthToken(null);
    return { success: true, data: { loggedOut: true } };
  },
};
