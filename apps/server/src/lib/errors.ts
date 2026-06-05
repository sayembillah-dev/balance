import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Small, stable set of error codes. Clients branch on `code`, not on message or
 * HTTP status. Every error response uses the same envelope:
 *   { error: { code, message, details? } }
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SIGNUPS_DISABLED'
  | 'SETUP_ALREADY_DONE'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SIGNUPS_DISABLED: 403,
  SETUP_ALREADY_DONE: 410,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

// Convenience constructors for the common cases.
export const unauthorized = (m = 'Authentication required') =>
  new AppError('UNAUTHORIZED', m);
export const forbidden = (m = 'Not allowed') => new AppError('FORBIDDEN', m);
export const notFound = (m = 'Not found') => new AppError('NOT_FOUND', m);
export const conflict = (m: string) => new AppError('CONFLICT', m);

/** 404 fallback for unmatched routes. */
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
}

/** Central error handler — must be the last middleware mounted. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // multer (upload) errors — e.g. file too large.
  if (err instanceof Error && err.name === 'MulterError') {
    const tooBig = (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: tooBig ? 'File is too large (max 10MB)' : err.message },
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Internal server error' },
  });
}
