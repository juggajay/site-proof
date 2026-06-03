import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Force local-filesystem storage in tests. Routes branch on
    // isSupabaseConfigured() at module load; unsetting SUPABASE_URL ensures
    // upload tests never accidentally hit production Supabase Storage.
    env: {
      NODE_ENV: 'test',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_ANON_KEY: '',
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
