/**
 * Centralized Error Handling Utilities
 * 
 * Translates low-level network errors and backend status codes
 * into user-friendly, professional, actionable messages.
 */

export type ErrorCode =
  | 'BACKEND_UNAVAILABLE'
  | 'NETWORK_TIMEOUT'
  | 'AUTH_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_REQUEST'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AppError {
  code: ErrorCode;
  message: string;
  technicalDetails?: string;
  statusCode?: number;
}

export function parseError(err: unknown): AppError {
  if (typeof err === 'string') {
    return {
      code: 'UNKNOWN',
      message: err
    };
  }

  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return {
        code: 'NETWORK_TIMEOUT',
        message: 'The connection timed out. Please check your internet connection.',
        technicalDetails: err.message
      };
    }

    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      return {
        code: 'BACKEND_UNAVAILABLE',
        message: 'Backend services are currently offline or unreachable.',
        technicalDetails: err.message
      };
    }

    return {
      code: 'SERVER_ERROR',
      message: err.message,
      technicalDetails: err.stack
    };
  }

  return {
    code: 'UNKNOWN',
    message: 'An unexpected issue occurred. Please try again later.'
  };
}
