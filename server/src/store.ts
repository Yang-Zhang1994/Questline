import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Quest } from '@questline/shared';
import { todayDateString } from '@questline/shared';

export type QuestStore = {
  listForDate: (date: string) => Promise<Quest[]>;
  setCompleted: (id: string, completed: boolean, at?: Date) => Promise<Quest>;
  reset: () => Promise<void>;
};

type StoreData = {
  quests: Quest[];
};

function seedQuests(date: string): Quest[] {
  return [
    {
      id: randomUUID(),
      title: 'Drink a full glass of water',
      date,
      completed: false,
      completedAt: null,
    },
    {
      id: randomUUID(),
      title: 'Take a 10-minute walk',
      date,
      completed: false,
      completedAt: null,
    },
    {
      id: randomUUID(),
      title: 'Write three lines in your journal',
      date,
      completed: false,
      completedAt: null,
    },
    {
      id: randomUUID(),
      title: 'Stretch for five minutes',
      date,
      completed: false,
      completedAt: null,
    },
  ];
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export function createQuestStore(filePath: string): QuestStore {
  let cache: StoreData | null = null;

  async function load(): Promise<StoreData> {
    if (cache) return cache;
    try {
      const raw = await readFile(filePath, 'utf8');
      cache = JSON.parse(raw) as StoreData;
      return cache;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
      const today = todayDateString();
      cache = { quests: seedQuests(today) };
      await persist(cache);
      return cache;
    }
  }

  async function persist(data: StoreData): Promise<void> {
    await ensureDir(filePath);
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    cache = data;
  }

  return {
    async listForDate(date: string): Promise<Quest[]> {
      const data = await load();
      const existing = data.quests.filter((q) => q.date === date);
      if (existing.length > 0) return existing;

      // First visit for this calendar day: seed today's quests.
      const seeded = seedQuests(date);
      data.quests.push(...seeded);
      await persist(data);
      return seeded;
    },

    async setCompleted(id: string, completed: boolean, at = new Date()): Promise<Quest> {
      const data = await load();
      const quest = data.quests.find((q) => q.id === id);
      if (!quest) {
        throw Object.assign(new Error(`Quest not found: ${id}`), { status: 404 });
      }
      quest.completed = completed;
      quest.completedAt = completed ? at.toISOString() : null;
      await persist(data);
      return { ...quest };
    },

    async reset(): Promise<void> {
      const today = todayDateString();
      cache = { quests: seedQuests(today) };
      await persist(cache);
    },
  };
}
