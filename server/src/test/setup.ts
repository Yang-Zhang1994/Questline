/**
 * Default test DATABASE_URL when unset. CI and local `.env` may override.
 * Issue #17: tests must use Postgres, not SQLite `:memory:`.
 */
process.env.DATABASE_URL ??= 'postgres://questline:questline@localhost:5432/questline_test';
