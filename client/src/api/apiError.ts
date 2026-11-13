/** Typed API failure so Talk can detect AI_UNAVAILABLE and offer the manual form (#21). */
export class ApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, code: string | null, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function isAiUnavailableError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.code === 'AI_UNAVAILABLE' || err.status === 503;
  }
  if (err instanceof Error) {
    return /tangled|AI_UNAVAILABLE|try sending that again/i.test(err.message);
  }
  return false;
}

export function errorCode(body: unknown): string | null {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error?: { code?: string } }).error?.code === 'string'
  ) {
    return (body as { error: { code: string } }).error.code;
  }
  return null;
}

export function errorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error?: { message?: string } }).error?.message === 'string'
  ) {
    return (body as { error: { message: string } }).error.message;
  }
  return fallback;
}

export function throwApiError(res: Response, body: unknown, fallback: string): never {
  throw new ApiError(errorMessage(body, fallback), errorCode(body), res.status);
}
