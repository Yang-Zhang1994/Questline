import { SendChatMessageBodySchema } from '@questline/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getRequestUser } from '../auth/requestUser.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { ChatService } from '../services/chatService.js';
import { unauthorized } from '../services/errors.js';

const chatWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Too many messages — take a soft breath and try again in a minute.',
    },
  },
});

export function createChatRouter(chatService: ChatService): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/messages', async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const payload = await chatService.listMessages(user.id);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.post('/messages', chatWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const body = SendChatMessageBodySchema.parse(req.body);
      const payload = await chatService.sendMessage(user.id, body.content);
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  });

  /** Restart the goal interview from the beginning (Issue #3). */
  router.post('/interview/restart', chatWriteLimiter, async (req, res, next) => {
    try {
      const user = getRequestUser(req);
      if (!user) {
        throw unauthorized();
      }
      const payload = await chatService.restartInterview(user.id);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
