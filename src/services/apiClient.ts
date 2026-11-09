/**
 * Centralized API Client for SuperTom Backend Services
 * 
 * Supports JWT/Telegram InitData authentication, configurable base URL,
 * request timeouts, network failure handling, and structured error responses.
 * Ready to connect to the future Render backend.
 */

import { ApiResponse } from './types';

// Sanitize base URL by stripping trailing slashes, default to live Render backend
const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const PRODUCTION_BACKEND_URL = 'https://supertom-backend.onrender.com/api/v1';
const API_BASE_URL = (RAW_BASE_URL && RAW_BASE_URL.trim().length > 0)
  ? RAW_BASE_URL.replace(/\/+$/, '') 
  : PRODUCTION_BACKEND_URL;

class ApiClient {
  private authToken: string | null = (() => {
    try {
      return localStorage.getItem('supertom_auth_token');
    } catch {
      return null;
    }
  })();
  private rawInitData: string | null = null;

  /**
   * Sets the bearer session token returned from backend auth verification and persists to storage.
   */
  public setAuthToken(token: string | null) {
    this.authToken = token;
    try {
      if (token) {
        localStorage.setItem('supertom_auth_token', token);
      } else {
        localStorage.removeItem('supertom_auth_token');
      }
    } catch {}
  }

  public getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Sets the raw Telegram initData string for initial auth requests.
   */
  public setRawInitData(initData: string | null) {
    this.rawInitData = initData;
  }

  public getRawInitData(): string | null {
    return this.rawInitData;
  }

  /**
   * Checks whether the backend is configured (production default is active).
   */
  public isBackendConfigured(): boolean {
    return import.meta.env.VITE_BACKEND_DISABLED !== 'true';
  }

  /**
   * Central request pipeline with authentication headers, timeouts, and error handling.
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${formattedEndpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Attach JWT session token if authenticated
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // Attach raw Telegram InitData header if available
    if (this.rawInitData) {
      headers['X-Telegram-Init-Data'] = this.rawInitData;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s request timeout for cloud cold starts

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = `Server error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = await response.json();
          if (errorJson.error?.message) {
            errorMsg = errorJson.error.message;
          } else if (errorJson.message) {
            errorMsg = errorJson.message;
          }
        } catch {
          // Response body was not JSON
        }

        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: errorMsg,
          },
        };
      }

      const json = await response.json();

      // If backend returns enveloped ApiResponse: { success: true, data: T }
      if (json && typeof json === 'object' && ('success' in json || 'data' in json)) {
        return {
          success: json.success !== undefined ? Boolean(json.success) : true,
          data: json.data !== undefined ? (json.data as T) : (json as T),
          error: json.error,
        };
      }

      return {
        success: true,
        data: json as T,
      };
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        success: false,
        error: {
          code: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: isAbort
            ? 'Request timed out. Please check your network connection.'
            : 'Backend service unreachable. Running in offline preview mode.',
          details: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  public async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public async post<T, B = unknown>(endpoint: string, body?: B): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async put<T, B = unknown>(endpoint: string, body?: B): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
