import type { ProposedMilestone } from '@questline/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatAiClient } from '../ai/client.js';
import { createApp } from '../app.js';
import type { Clock } from '../clock.js';
import { openDatabase, resetDatabase, type Db } from '../db/connection.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoDataIfEmpty } from '../db/seed.js';

function fixedClock(iso: string): Clock {
  return { now: () => new Date(iso) };
}

async function loginAsDemo(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    .expect(200);
  return res.body.token as string;
}

const sampleDraft: ProposedMilestone[] = [
  {
    title: 'Master katakana & basic grammar',
    description: 'Spend 30 minutes daily learning katakana and core sentence particles.',
    target_date: '2026-12-20',
  },
  {
    title: 'Finish Level 1 graded stories',
    description: 'Read 5 short beginner stories without translating word-by-word.',
    target_date: '2027-03-15',
  },
  {
    title: 'Read first short manga volume',
    description: 'Follow everyday dialogue in a cozy slice-of-life manga.',
    target_date: '2027-06-20',
  },
  {
    title: 'Read a complete short Japanese novel',
    description: 'Read chapter by chapter at a steady pace before the October deadline.',
    target_date: '2027-09-30',
  },
];

describe('GET/POST /api/milestones (Issue #5)', () => {
  let db: Db;
  const clock = fixedClock('2026-11-10T15:00:00.000Z');
  let proposeMilestones: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await openDatabase();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedDemoDataIfEmpty(db, clock);
    // Start with an active goal that has no milestones yet so we can test propose -> confirm cleanly.
    await db.query(`DELETE FROM milestones`);

    proposeMilestones = vi.fn(async () => ({
      mochi_message: 'Here are 4 stages tailored to your 30-minute daily budget ♡',
      milestones: sampleDraft,
    }));
  });

  afterAll(async () => {
    await db?.end();
  });

  function buildApp(ai?: ChatAiClient) {
    return createApp({
      db,
      clock,
      ai: ai ?? {
        completeChat: vi.fn(async () => 'Chat reply ♡'),
        evaluateInterviewAnswer: vi.fn(),
        proposeMilestones,
      },
    });
  }

  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    const app = buildApp();
    await request(app).get('/api/milestones').expect(401);
    await request(app).post('/api/milestones/propose').send({}).expect(401);
    await request(app)
      .post('/api/milestones/confirm')
      .send({ milestones: sampleDraft })
      .expect(401);
  });

  // AC: Mochi proposes 3–7 ordered milestones based on confirmed goal, deadline, and time budget;
  // Milestones are saved only after the user confirms the plan.
  it('POST /api/milestones/propose returns 3–7 milestones without saving to the database', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const res = await request(app)
      .post('/api/milestones/propose')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    expect(res.body.goal.title).toBe('Read a Japanese novel on my own');
    expect(res.body.goal.deadline).toBe('2027-10-28');
    expect(res.body.goal.time_budget_minutes_per_day).toBe(30);
    expect(res.body.milestones).toEqual(sampleDraft);
    expect(res.body.mochi_message.role).toBe('mochi');
    expect(res.body.user_message).toBeNull();

    expect(proposeMilestones).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: expect.objectContaining({
          title: 'Read a Japanese novel on my own',
          deadline: '2027-10-28',
          time_budget_minutes_per_day: 30,
        }),
      }),
    );

    const dbCount = await db.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM milestones`);
    expect(dbCount.rows[0].c).toBe(0);
  });

  // AC: User can ask Mochi to add, remove, rename, or reorder milestones before agreeing
  it('POST /api/milestones/propose with feedback adjusts the draft and logs the chat turn without saving milestones', async () => {
    const adjusted: ProposedMilestone[] = [
      sampleDraft[0],
      {
        title: 'Renamed stage: Build vocabulary deck',
        description: 'Collect 300 common words from graded stories.',
        target_date: '2027-02-15',
      },
      sampleDraft[1],
      sampleDraft[2],
      sampleDraft[3],
    ];
    proposeMilestones.mockResolvedValueOnce({
      mochi_message: 'I added the vocabulary stage and updated the dates ♡',
      milestones: adjusted,
    });

    const app = buildApp();
    const token = await loginAsDemo(app);

    const res = await request(app)
      .post('/api/milestones/propose')
      .set('Authorization', `Bearer ${token}`)
      .send({
        feedback: 'Add a vocabulary stage before the graded stories',
        current_draft: sampleDraft,
      })
      .expect(200);

    expect(res.body.milestones).toHaveLength(5);
    expect(res.body.milestones[1].title).toBe('Renamed stage: Build vocabulary deck');
    expect(res.body.user_message.content).toBe(
      'Add a vocabulary stage before the graded stories',
    );
    expect(res.body.mochi_message.content).toContain('added the vocabulary stage');

    const dbCount = await db.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM milestones`);
    expect(dbCount.rows[0].c).toBe(0);
  });

  // AC: Validate the AI's proposed milestones with Zod; handle invalid AI output gracefully
  it('returns 503 AI_UNAVAILABLE when the AI returns milestones past the goal deadline or outside 3–7', async () => {
    proposeMilestones.mockResolvedValueOnce({
      mochi_message: 'Bad dates',
      milestones: [
        sampleDraft[0],
        sampleDraft[1],
        {
          title: 'Late milestone',
          description: 'Target date is after 2027-10-28',
          target_date: '2028-01-15',
        },
      ],
    });

    const app = buildApp();
    const token = await loginAsDemo(app);

    const res = await request(app)
      .post('/api/milestones/propose')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(503);

    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
  });

  // AC: When the user confirms, save all milestones in one transaction, with position in order,
  // the first milestone current, and the rest upcoming.
  it('POST /api/milestones/confirm saves all milestones in order with first current and rest upcoming', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    const res = await request(app)
      .post('/api/milestones/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestones: sampleDraft })
      .expect(201);

    expect(res.body.milestones).toHaveLength(4);
    expect(res.body.milestones.map((m: { position: number }) => m.position)).toEqual([1, 2, 3, 4]);
    expect(res.body.milestones.map((m: { status: string }) => m.status)).toEqual([
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);

    const stored = await db.query<{ position: number; title: string; status: string }>(
      `SELECT position, title, status FROM milestones ORDER BY position ASC`,
    );
    expect(stored.rows).toEqual([
      { position: 1, title: sampleDraft[0].title, status: 'current' },
      { position: 2, title: sampleDraft[1].title, status: 'upcoming' },
      { position: 3, title: sampleDraft[2].title, status: 'upcoming' },
      { position: 4, title: sampleDraft[3].title, status: 'upcoming' },
    ]);
  });

  it('POST /api/milestones/confirm rejects a second call with 409 CONFLICT if the goal already has milestones', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    await request(app)
      .post('/api/milestones/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestones: sampleDraft })
      .expect(201);

    const secondRes = await request(app)
      .post('/api/milestones/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestones: sampleDraft.slice(0, 3) })
      .expect(409);

    expect(secondRes.body.error).toEqual({
      code: 'CONFLICT',
      message: expect.stringMatching(/already been confirmed/i),
    });

    const stored = await db.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM milestones`);
    expect(stored.rows[0].c).toBe(4);
  });

  it('POST /api/milestones/confirm rejects invalid drafts with 400 VALIDATION_ERROR and saves nothing', async () => {
    const app = buildApp();
    const token = await loginAsDemo(app);

    // Too few milestones (< 3)
    const tooFewRes = await request(app)
      .post('/api/milestones/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ milestones: sampleDraft.slice(0, 2) })
      .expect(400);
    expect(tooFewRes.body.error.code).toBe('VALIDATION_ERROR');

    // Target date after the goal's deadline (2027-10-28)
    const pastDeadlineRes = await request(app)
      .post('/api/milestones/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestones: [
          sampleDraft[0],
          sampleDraft[1],
          {
            title: 'Stage past deadline',
            description: 'Target date is after 2027-10-28',
            target_date: '2028-02-01',
          },
        ],
      })
      .expect(400);
    expect(pastDeadlineRes.body.error.code).toBe('VALIDATION_ERROR');

    const stored = await db.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM milestones`);
    expect(stored.rows[0].c).toBe(0);
  });

  // AC: Milestones must belong to the logged-in user's goal (filter by user_id)
  it('filters active goal by user_id so another user without an active goal receives 404 NOT_FOUND', async () => {
    const app = buildApp();
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@questline.local', password: 'other-password-123' })
      .expect(201);
    const otherToken = registerRes.body.token as string;

    await request(app)
      .post('/api/milestones/propose')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({})
      .expect(404);

    await request(app)
      .post('/api/milestones/confirm')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ milestones: sampleDraft })
      .expect(404);

    const stored = await db.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM milestones`);
    expect(stored.rows[0].c).toBe(0);
  });
});
