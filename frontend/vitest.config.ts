import path from 'node:path';
import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    clearMocks: true,
    css: true,
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      // Keep Vitest's defaults (test files, *.d.ts, configs) and also exclude
      // the shared test harness under src/test/.
      exclude: [...coverageConfigDefaults.exclude, 'src/test/**'],
      // Ratchet floor: these are the measured whole-src baselines at the time
      // this gate was added (see PR), floored to whole numbers. Raise them as
      // coverage grows; never lower them to make a PR pass.
      thresholds: {
        statements: 14,
        branches: 8,
        functions: 9,
        lines: 15,
      },
    },
  },
});
