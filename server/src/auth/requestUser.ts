import type { Request } from 'express';
import type { AuthenticatedUser } from './types.js';

const users = new WeakMap<Request, AuthenticatedUser>();

export function setRequestUser(req: Request, user: AuthenticatedUser): void {
  users.set(req, user);
}

export function getRequestUser(req: Request): AuthenticatedUser | undefined {
  return users.get(req);
}
