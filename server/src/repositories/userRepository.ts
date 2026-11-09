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
      const result = await db.query<UserRow>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, email, password_hash, created_at`,
        [email, passwordHash],
      );
      return result.rows[0];
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
