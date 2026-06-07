/**
 * Regression test for "Copy from Previous Day" silently dropping personnel that
 * had recorded hours.
 *
 * The previous-personnel API serializes Prisma Decimal hours as a JSON string
 * (e.g. "8.5"), but POST /:diaryId/personnel validates hours with z.number(),
 * so forwarding the raw string 400s and the inner catch swallows it — only
 * hour-less people copy. This pins that copied personnel with string hours
 * produce a numeric hours value in the POST payload.
 */

import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('@/components/ui/toaster', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/toaster')>();
  return { ...actual, toast: vi.fn() };
});

// Force desktop view so jsdom doesn't need a matchMedia polyfill.
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => false };
});

import { apiFetch } from '@/lib/api';
import { PersonnelTab } from './PersonnelTab';
import type { DailyDiary, Personnel } from '../types';

const apiFetchMock = vi.mocked(apiFetch) as unknown as MockInstance<
  (path: string, options?: RequestInit) => Promise<unknown>
>;

function makeDiary(): DailyDiary {
  return {
    id: 'diary-today',
    projectId: 'project-1',
    date: '2026-06-07',
    status: 'draft',
    personnel: [],
    plant: [],
    activities: [],
    delays: [],
    deliveries: [],
    events: [],
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
  };
}

function renderTab() {
  return renderWithProviders(
    <PersonnelTab
      diary={makeDiary()}
      projectId="project-1"
      selectedDate="2026-06-07"
      saving={false}
      setSaving={() => {}}
      onDiaryUpdate={() => {}}
    />,
  );
}

/** Parses the JSON body of an apiFetch POST call. */
function parsePostBody(call: [string, RequestInit?]): Record<string, unknown> {
  return JSON.parse(String(call[1]?.body));
}

describe('PersonnelTab copy from previous day', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('coerces Prisma-Decimal string hours to a number in the POST payload', async () => {
    let createdId = 0;
    apiFetchMock.mockImplementation(async (_path: string, options?: RequestInit) => {
      if (!options) {
        // GET previous-personnel: hours arrive as JSON strings (Prisma Decimal).
        return {
          personnel: [
            { name: 'Alice', company: 'Acme', role: 'Carpenter', hours: '8.5' },
            { name: 'Bob', company: 'Acme', role: 'Labourer', hours: null },
          ],
        };
      }
      // POST personnel: echo back a created record.
      createdId += 1;
      const body = JSON.parse(String(options.body)) as Partial<Personnel>;
      return {
        id: `person-${createdId}`,
        name: body.name ?? '',
        createdAt: '2026-06-07T00:00:00.000Z',
      } as Personnel;
    });

    renderTab();

    fireEvent.click(screen.getByRole('button', { name: /copy from previous day/i }));

    // Both people should be posted (not just the hour-less one).
    await waitFor(() => {
      const posts = apiFetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');
      expect(posts).toHaveLength(2);
    });

    const posts = apiFetchMock.mock.calls.filter(([, options]) => options?.method === 'POST') as [
      string,
      RequestInit,
    ][];

    const alice = posts.map(parsePostBody).find((b) => b.name === 'Alice');
    expect(alice).toBeDefined();
    // The bug: "8.5" forwarded verbatim 400s the request. Hours must be numeric.
    expect(alice?.hours).toBe(8.5);
    expect(typeof alice?.hours).toBe('number');

    const bob = posts.map(parsePostBody).find((b) => b.name === 'Bob');
    expect(bob).toBeDefined();
    // Null hours stay omitted (optional field), not sent as null/0.
    expect('hours' in (bob ?? {})).toBe(false);
  });
});
