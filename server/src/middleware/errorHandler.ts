import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const formatted = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Request validation failed', 422, 'VALIDATION_ERROR', formatted);
    return;
  }

  // 2. Syntax / JSON Parsing Errors
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    sendError(res, 'Malformed JSON in request body', 400, 'BAD_REQUEST');
    return;
  }

  // 3. Generic Errors
  logger.error('Unhandled Server Exception:', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  sendError(res, message, 500, 'INTERNAL_SERVER_ERROR');
}
