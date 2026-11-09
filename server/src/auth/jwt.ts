import { SignJWT, jwtVerify } from 'jose';

export type AuthTokenClaims = {
  userId: number;
  email: string;
};

const DEFAULT_TTL = '7d';

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 8) {
    throw new Error('JWT_SECRET must be set to a non-trivial value (≥8 characters)');
  }
  return new TextEncoder().encode(secret);
}

export async function signAuthToken(
  claims: AuthTokenClaims,
  expiresIn: string = DEFAULT_TTL,
): Promise<string> {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(claims.userId))
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

export async function verifyAuthToken(token: string): Promise<AuthTokenClaims> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    algorithms: ['HS256'],
  });

  const userId = Number(payload.sub);
  const email = typeof payload.email === 'string' ? payload.email : '';

  if (!Number.isInteger(userId) || userId < 1 || !email) {
    throw new Error('Invalid token payload');
  }

  return { userId, email };
}
