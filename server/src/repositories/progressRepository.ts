import type { StampCard, UserProgress } from '@questline/shared';
import {
  applyMissedDayReset,
  buildStampCardSnapshot,
  progressSnapshotFromXp,
  type StampRowInput,
  type StreakState,
} from '../config/game.js';
import type { Db } from '../db/connection.js';

type ProgressRow = {
  user_id: number;
  xp: number;
  level: number;
  current_streak: number;
  best_streak: number;
  last_active_date: string | null;
};

function streakFromRow(
  row: Pick<ProgressRow, 'current_streak' | 'best_streak' | 'last_active_date'>,
): StreakState {
  return {
    current_streak: row.current_streak,
    best_streak: row.best_streak,
    last_active_date: row.last_active_date,
  };
}

function toSnapshot(row: ProgressRow): UserProgress {
  return progressSnapshotFromXp(row.xp, streakFromRow(row));
}

export function createProgressRepository(db: Db) {
  return {
    /**
     * Load progress for a user. Creates a level-1 row when the user exists but
     * has no progress yet. Returns a zero snapshot (without insert) when the
     * user id is unknown — avoids FK violations for empty Today scopes.
     *
     * When `localDate` is provided, persists a missed-day streak reset so the
     * HUD shows 0 after a full inactive day (Issue #12).
     */
    async getOrCreate(userId: number, localDate?: string): Promise<UserProgress> {
      const existing = await db.query<ProgressRow>(
        `SELECT user_id, xp, level, current_streak, best_streak, last_active_date
         FROM user_progress WHERE user_id = $1`,
        [userId],
      );
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (!localDate) {
          return toSnapshot(row);
        }
        const reset = applyMissedDayReset(streakFromRow(row), localDate);
        if (reset.current_streak !== row.current_streak) {
          await db.query(`UPDATE user_progress SET current_streak = $1 WHERE user_id = $2`, [
            reset.current_streak,
            userId,
          ]);
          return progressSnapshotFromXp(row.xp, reset);
        }
        return toSnapshot(row);
      }

      const user = await db.query<{ id: number }>(`SELECT id FROM users WHERE id = $1`, [userId]);
      if (!user.rows[0]) {
        return progressSnapshotFromXp(0);
      }

      const inserted = await db.query<ProgressRow>(
        `INSERT INTO user_progress (user_id, xp, level, current_streak, best_streak, last_active_date)
         VALUES ($1, 0, 1, 0, 0, NULL)
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING user_id, xp, level, current_streak, best_streak, last_active_date`,
        [userId],
      );
      return toSnapshot(inserted.rows[0]);
    },

    /**
     * Load the stamp card + past cards history for `userId` (Issue #13).
     * Always scoped strictly by `user_id = $1`.
     */
    async getStampCard(userId: number): Promise<StampCard> {
      const result = await db.query<StampRowInput>(
        `SELECT card_number, stamp_date
         FROM stamps
         WHERE user_id = $1
         ORDER BY card_number ASC, stamp_date ASC, id ASC`,
        [userId],
      );
      return buildStampCardSnapshot(result.rows);
    },
  };
}

export type ProgressRepository = ReturnType<typeof createProgressRepository>;
