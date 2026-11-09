import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type Db = pg.Pool;

export type OpenDbOptions = {
  /** Override process.env.DATABASE_URL (tests). */
  connectionString?: string;
};

export async function openDatabase(options: OpenDbOptions = {}): Promise<Db> {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required (PostgreSQL connection string)');
  }

  const pool = new pg.Pool({ connectionString });
  await runMigrations(pool);
  return pool;
}

export async function runMigrations(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const applied = await db.query<{ id: string }>('SELECT id FROM schema_migrations');
  const alreadyApplied = new Set(applied.rows.map((row) => row.id));

  for (const file of files) {
    if (alreadyApplied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id, applied_at) VALUES ($1, NOW())', [
        file,
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

/** Truncate domain tables between tests (keeps schema_migrations). */
export async function resetDatabase(db: Db): Promise<void> {
  await db.query(`
    TRUNCATE TABLE
      diary_notes,
      chat_messages,
      stamps,
      user_progress,
      quests,
      milestones,
      goals,
      users
    RESTART IDENTITY CASCADE
  `);
}
