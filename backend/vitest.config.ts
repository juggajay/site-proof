import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Force local-filesystem storage in tests. Routes branch on
    // isSupabaseConfigured() at module load; unsetting SUPABASE_URL ensures
    // upload tests never accidentally hit production Supabase Storage.
    env: {
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
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
