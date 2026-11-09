import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    // Shared Postgres test DB — avoid parallel writers.
    fileParallelism: false,
  },
});
