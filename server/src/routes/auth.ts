import { LoginBodySchema, RegisterBodySchema } from '@questline/shared';
import { Router } from 'express';
import type { AuthService } from '../services/authService.js';

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    try {
      const body = RegisterBodySchema.parse(req.body);
      const result = await authService.register(body.email, body.password);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const body = LoginBodySchema.parse(req.body);
      const result = await authService.login(body.email, body.password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
