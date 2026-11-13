import type { Db } from '../db/connection.js';

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date | string;
};

export function createUserRepository(db: Db) {
  return {
    async findByEmail(email: string): Promise<UserRow | null> {
      const result = await db.query<UserRow>(
        `SELECT id, email, password_hash, created_at
         FROM users WHERE lower(email) = lower($1)`,
        [email],
      );
      return result.rows[0] ?? null;
    },

    async findById(id: number): Promise<UserRow | null> {
      const result = await db.query<UserRow>(
        `SELECT id, email, password_hash, created_at
         FROM users WHERE id = $1`,
        [id],
      );
      return result.rows[0] ?? null;
    },

    async create(email: string, passwordHash: string): Promise<UserRow> {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query<UserRow>(
          `INSERT INTO users (email, password_hash)
           VALUES ($1, $2)
           RETURNING id, email, password_hash, created_at`,
          [email, passwordHash],
        );
        const user = result.rows[0];
        await client.query(
          `INSERT INTO user_progress (user_id, xp, level, current_streak, best_streak)
           VALUES ($1, 0, 1, 0, 0)`,
          [user.id],
        );
        await client.query('COMMIT');
        return user;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
