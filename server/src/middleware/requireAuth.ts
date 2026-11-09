import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../auth/jwt.js';
import { setRequestUser } from '../auth/requestUser.js';
import { AppError, unauthorized } from '../services/errors.js';

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim() || null;
}

/**
 * Requires `Authorization: Bearer <jwt>`. Sets request user on success.
 * Choice (Issue #31): Bearer header (not httpOnly cookie) — simpler for
 * Supertest/curl and a course SPA until a dedicated login UI lands.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req.header('authorization'));
    if (!token) {
      throw unauthorized('Missing or invalid Authorization Bearer token');
    }

    const claims = await verifyAuthToken(token);
    setRequestUser(req, { id: claims.userId, email: claims.email });
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(unauthorized('Invalid or expired token'));
  }
}
