// Stub for virtual:pwa-register/react used in the vitest environment.
// Tests that need specific behaviour should vi.mock('virtual:pwa-register/react').
import { useState } from 'react';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

export function useRegisterSW(_options?: RegisterSWOptions) {
  return {
    needRefresh: useState(false),
    offlineReady: useState(false),
    updateServiceWorker: async (_reloadPage?: boolean) => {},
  };
}
