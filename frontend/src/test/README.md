# Frontend unit & component tests

Fast Vitest + React Testing Library tests that run in `jsdom` — no dev server, no
backend. They are a CI gate (`.github/workflows/ci.yml` runs `npm run test:unit`),
not a pre-commit gate. Authoring loop: `npm run test:unit:watch`.

## Conventions

- **Explicit imports — globals are off.** `vitest.config.ts` sets `globals: false`,
  so import everything you use: `import { describe, it, expect, vi } from 'vitest'`.
- **Co-locate tests.** Put `Foo.test.tsx` next to `Foo.tsx` (the runner includes
  `src/**/*.{test,spec}.{ts,tsx}`).
- **Pure first.** Prefer testing pure helpers (`pages/lots/lib/*`, `lib/*`) and
  prop-driven presentational components. Render those with plain RTL `render` —
  they need no providers. Assert via accessible roles/names
  (`getByRole('button', { name })`), not implementation details, and never on
  decorative `aria-hidden` icons.
- **Reach for `renderWithProviders` only when needed.** If the component or hook
  reads TanStack Query or React Router context, use the shared helper instead of
  hand-rolling providers (see below).
- **Stub auth, don't mount it.** For components/hooks that only *read* `user`,
  prefer `vi.mock('@/lib/auth')` to stub `useAuth`. The real `AuthProvider` does
  token/bootstrap work unsuitable for unit tests; mount it only when testing auth
  itself.
- **No snapshots** unless there's a specific, justified reason. Snapshots rot and
  mask intent — assert the behaviour you care about.
- **Cleanup is global.** `src/test/setup.ts` registers `afterEach(cleanup)`, so new
  tests don't need their own. (Existing per-file `afterEach(cleanup)` calls are
  harmless — `cleanup()` is idempotent.)

## `renderWithProviders`

`src/test/renderWithProviders.tsx` wraps RTL `render` with the providers most app
surfaces need:

- a **fresh `QueryClient` per call** (TanStack Query **v4**, `retry: false`) so tests
  never share cache — pass your own via `queryClient` to prime the cache;
- a **`MemoryRouter`** seeded from `initialEntries` (defaults to `['/']`).

It returns the usual RTL result plus the `queryClient` it used, and re-exports
`screen`, `within`, `fireEvent`, `waitFor`, and `userEvent` for one-stop imports.

```tsx
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/renderWithProviders';
import { MyLotPanel } from './MyLotPanel';

describe('MyLotPanel', () => {
  it('renders for a lot route', async () => {
    renderWithProviders(<MyLotPanel />, { initialEntries: ['/lots/42'] });
    expect(await screen.findByRole('heading', { name: /lot 42/i })).toBeInTheDocument();
  });
});
```

## Radix / shadcn components (deferred)

Radix-based UI (Dialog, Select, Tooltip, Popover) renders through portals and calls
`ResizeObserver`, `matchMedia`, `Element.prototype.hasPointerCapture`, and
`scrollIntoView`, which `jsdom` does not implement. When the first such component
test lands, add those polyfills to `src/test/setup.ts` then — they are intentionally
left out until something needs them (YAGNI).
