import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Under full-suite parallel load a worker can stall past Testing Library's
// default 1s waitFor/findBy budget while another worker hogs the CPU
// (dynamic imports awaited inside the assertion window are the usual
// victims). 4s changes nothing when tests are healthy — waitFor resolves as
// soon as the assertion passes — it only absorbs scheduler noise.
configure({ asyncUtilTimeout: 4000 });

// vitest runs with `globals: false`, so Testing Library's automatic afterEach
// cleanup is never registered. Register it once here so individual test files
// don't have to repeat `afterEach(cleanup)`. Existing per-file calls remain
// harmless — cleanup() is idempotent.
afterEach(() => {
  cleanup();
});
