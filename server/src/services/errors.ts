export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'AI_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export function notFound(message: string): AppError {
  return new AppError('NOT_FOUND', message, 404);
}

export function validationError(message: string): AppError {
  return new AppError('VALIDATION_ERROR', message, 400);
}

export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError('UNAUTHORIZED', message, 401);
}

export function conflict(message: string): AppError {
  return new AppError('CONFLICT', message, 409);
}

/** Friendly Mochi copy when Claude fails (never leak raw provider errors). */
export function aiUnavailable(
  message = "Mochi got a little tangled. Try sending that again in a moment.",
): AppError {
  return new AppError('AI_UNAVAILABLE', message, 503);
}
