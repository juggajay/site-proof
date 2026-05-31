import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';

/**
 * Builds a QueryClient tuned for tests: retries are disabled so a failing query
 * surfaces immediately instead of waiting out TanStack Query's default backoff.
 * (This repo is on @tanstack/react-query v4 — not v5.)
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial history stack for the MemoryRouter. Defaults to ['/']. */
  initialEntries?: string[];
  /**
   * Reuse a specific QueryClient (e.g. to prime the cache with setQueryData).
   * A fresh client is created per call when omitted, so tests never share cache.
   */
  queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  /** The QueryClient the UI rendered with (the supplied one, or the fresh per-call client). */
  queryClient: QueryClient;
}

/**
 * Renders `ui` wrapped in the providers most app components and hooks need:
 * a per-call TanStack Query client and a MemoryRouter. Pure presentational
 * components that need no context should use plain `render` instead.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const {
    initialEntries = ['/'],
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Re-export the most-used Testing Library utilities so test files can pull
// everything from one place alongside renderWithProviders.
export { fireEvent, screen, waitFor, within } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
