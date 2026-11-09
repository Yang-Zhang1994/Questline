import type { UserProgress } from '@questline/shared';
import { progressSnapshotFromXp } from '../config/game.js';
import type { Db } from '../db/connection.js';

type ProgressRow = {
  user_id: number;
  xp: number;
  level: number;
};

function toSnapshot(row: ProgressRow): UserProgress {
  // Recompute bar fields from total XP so HUD stays consistent with thresholds.
  return progressSnapshotFromXp(row.xp);
}

export function createProgressRepository(db: Db) {
  return {
    /**
     * Load progress for a user. Creates a level-1 row when the user exists but
     * has no progress yet. Returns a zero snapshot (without insert) when the
     * user id is unknown — avoids FK violations for empty Today scopes.
     */
    async getOrCreate(userId: number): Promise<UserProgress> {
      const existing = await db.query<ProgressRow>(
        `SELECT user_id, xp, level FROM user_progress WHERE user_id = $1`,
        [userId],
      );
      if (existing.rows[0]) {
        return toSnapshot(existing.rows[0]);
      }

      const user = await db.query<{ id: number }>(`SELECT id FROM users WHERE id = $1`, [userId]);
      if (!user.rows[0]) {
        return progressSnapshotFromXp(0);
      }

      const inserted = await db.query<ProgressRow>(
        `INSERT INTO user_progress (user_id, xp, level, current_streak, best_streak)
         VALUES ($1, 0, 1, 0, 0)
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING user_id, xp, level`,
        [userId],
      );
      return toSnapshot(inserted.rows[0]);
    },
  };
}

export type ProgressRepository = ReturnType<typeof createProgressRepository>;
