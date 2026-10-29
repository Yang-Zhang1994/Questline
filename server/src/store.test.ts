import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createQuestStore } from './store.js';
import { todayDateString } from '@questline/shared';

const tempDirs: string[] = [];

afterEach(async () => {
  // Leave temp dirs for OS cleanup; nothing to close.
  tempDirs.length = 0;
});

async function tempStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'questline-'));
  tempDirs.push(dir);
  const filePath = path.join(dir, 'quests.json');
  return { store: createQuestStore(filePath), filePath };
}

describe('createQuestStore', () => {
  it('seeds today quests on first load', async () => {
    const { store } = await tempStore();
    const today = todayDateString();
    const quests = await store.listForDate(today);
    expect(quests.length).toBeGreaterThan(0);
    expect(quests.every((q) => q.date === today)).toBe(true);
    expect(quests.every((q) => q.completed === false)).toBe(true);
    expect(quests.every((q) => q.completedAt === null)).toBe(true);
  });

  it('persists completion status and time', async () => {
    const { store, filePath } = await tempStore();
    const today = todayDateString();
    const [quest] = await store.listForDate(today);
    const when = new Date('2026-10-28T15:30:00.000Z');

    const completed = await store.setCompleted(quest.id, true, when);
    expect(completed.completed).toBe(true);
    expect(completed.completedAt).toBe(when.toISOString());

    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as { quests: typeof completed[] };
    const saved = parsed.quests.find((q) => q.id === quest.id);
    expect(saved?.completed).toBe(true);
    expect(saved?.completedAt).toBe(when.toISOString());
  });

  it('allows undoing a check-off', async () => {
    const { store } = await tempStore();
    const today = todayDateString();
    const [quest] = await store.listForDate(today);

    await store.setCompleted(quest.id, true);
    const undone = await store.setCompleted(quest.id, false);
    expect(undone.completed).toBe(false);
    expect(undone.completedAt).toBeNull();
  });

  it('keeps completions after a fresh store reload', async () => {
    const { store, filePath } = await tempStore();
    const today = todayDateString();
    const [quest] = await store.listForDate(today);
    await store.setCompleted(quest.id, true, new Date('2026-10-28T12:00:00.000Z'));

    const reloaded = createQuestStore(filePath);
    const quests = await reloaded.listForDate(today);
    const found = quests.find((q) => q.id === quest.id);
    expect(found?.completed).toBe(true);
    expect(found?.completedAt).toBe('2026-10-28T12:00:00.000Z');
  });
});
