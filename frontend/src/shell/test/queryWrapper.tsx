import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/renderWithProviders';

export function createShellQueryWrapper() {
  const queryClient = createTestQueryClient();

  return function ShellQueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
