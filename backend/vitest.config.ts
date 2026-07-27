import { defineConfig } from 'vitest/config';

import { TEST_WORKER_COUNT } from './src/test/workerDatabase.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // One database per worker, so DB-backed suites stay parallel-safe
    // (`src/test/workerDatabase.ts`). Pinned rather than left to vitest's
    // cpus-1 default so the number of workers and the number of provisioned
    // databases cannot disagree.
    globalSetup: ['./vitest.globalSetup.ts'],
    maxWorkers: TEST_WORKER_COUNT,
    // Force local-filesystem storage in tests. Routes branch on
    // isSupabaseConfigured() at module load; unsetting SUPABASE_URL ensures
    // upload tests never accidentally hit production Supabase Storage.
    env: {
      NODE_ENV: 'test',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_ANON_KEY: '',
      // Pin the app timezone to UTC for deterministic notification-timing
      // fixtures (which build `now` from UTC instants). Production defaults to
      // Australia/Sydney; the AU conversion is covered by getZonedMinutesOfDay
      // unit tests that pass the zone explicitly.
      APP_TIMEZONE: 'UTC',
    },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/routes/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['node_modules/', 'dist/'],
      thresholds: {
        statements: 80,
        branches: 68,
        functions: 85,
        lines: 80,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
