import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// vitest runs with `globals: false`, so Testing Library's automatic afterEach
// cleanup is never registered. Register it once here so individual test files
// don't have to repeat `afterEach(cleanup)`. Existing per-file calls remain
// harmless — cleanup() is idempotent.
afterEach(() => {
  cleanup();
});
