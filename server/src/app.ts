import cors from 'cors';
import express from 'express';
import type { QuestStore } from './store.js';
import { todayDateString } from '@questline/shared';

export function createApp(store: QuestStore) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/quests/today', async (_req, res, next) => {
    try {
      const date = todayDateString();
      const quests = await store.listForDate(date);
      res.json({ date, quests });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/quests/:id/complete', async (req, res, next) => {
    try {
      const quest = await store.setCompleted(req.params.id, true);
      res.json({ quest });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/quests/:id/uncomplete', async (req, res, next) => {
    try {
      const quest = await store.setCompleted(req.params.id, false);
      res.json({ quest });
    } catch (err) {
      next(err);
    }
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        typeof err === 'object' && err && 'status' in err
          ? Number((err as { status: number }).status)
          : 500;
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(status || 500).json({ error: message });
    },
  );

  return app;
}
