/** Default value shipped in `.env.example` — never allowed in production. */
export const DEFAULT_DEV_JWT_SECRET = 'change-me-in-local-dev';

/** Minimum `JWT_SECRET` length required in production. */
export const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;

export type AssertProductionEnvOptions = {
  /** Skip Anthropic env checks when a test explicitly injects a fake `ChatAiClient`. */
  hasInjectedAi?: boolean;
};

/**
 * Validates `JWT_SECRET` against the current environment.
 * - Non-production: requires at least 8 non-whitespace characters.
 * - Production: requires at least 32 characters and rejects the `.env.example` default.
 */
export function assertJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.JWT_SECRET;
  const trimmed = raw?.trim() ?? '';

  if (!trimmed || trimmed.length < 8) {
    throw new Error('JWT_SECRET must be set to a non-trivial value (≥8 characters)');
  }

  if (env.NODE_ENV === 'production') {
    if (trimmed === DEFAULT_DEV_JWT_SECRET) {
      throw new Error('JWT_SECRET in production must not use the .env.example default');
    }
    if (trimmed.length < MIN_PRODUCTION_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_PRODUCTION_JWT_SECRET_LENGTH} characters in production`,
      );
    }
  }

  return raw!;
}

/**
 * Fail-fast startup check for production:
 * - Requires `JWT_SECRET` (≥32 chars, not the `.env.example` default).
 * - Requires `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` unless `ALLOW_ECHO_AI=true` is set explicitly.
 */
export function assertProductionEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: AssertProductionEnvOptions = {},
): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  assertJwtSecret(env);

  if (options.hasInjectedAi || env.ALLOW_ECHO_AI === 'true') {
    return;
  }

  const apiKey = env.ANTHROPIC_API_KEY?.trim() ?? '';
  const model = env.ANTHROPIC_MODEL?.trim() ?? '';
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is required in production unless ALLOW_ECHO_AI=true is set explicitly',
    );
  }
  if (!model) {
    throw new Error(
      'ANTHROPIC_MODEL is required in production unless ALLOW_ECHO_AI=true is set explicitly',
    );
  }
}

/**
 * Resolves the `cors({ origin })` option:
 * - When `CORS_ORIGIN` is set, allows only the configured origin(s) (comma-separated).
 * - Otherwise, disables cross-origin reflection in production (`false`) and reflects in dev/test (`true`).
 */
export function resolveCorsOrigin(
  env: NodeJS.ProcessEnv = process.env,
): boolean | string | string[] {
  const raw = env.CORS_ORIGIN?.trim();
  if (raw) {
    const origins = raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (origins.length === 1) {
      return origins[0]!;
    }
    if (origins.length > 1) {
      return origins;
    }
  }
  return env.NODE_ENV === 'production' ? false : true;
}
