export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR';

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
