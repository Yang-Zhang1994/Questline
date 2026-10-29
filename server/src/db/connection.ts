import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type Db = Database.Database;

export type OpenDbOptions = {
  /** Use `:memory:` for tests; otherwise a file path. */
  filename?: string;
};

export function openDatabase(options: OpenDbOptions = {}): Db {
  const filename =
    options.filename ??
    process.env.QUESTLINE_DB_PATH ??
    path.join(process.cwd(), 'data', 'questline.sqlite');

  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

export function runMigrations(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const alreadyApplied = new Set(
    (db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>).map(
      (row) => row.id,
    ),
  );

  const insert = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)');

  for (const file of files) {
    if (alreadyApplied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const apply = db.transaction(() => {
      db.exec(sql);
      insert.run(file, new Date().toISOString());
    });
    apply();
  }
}
