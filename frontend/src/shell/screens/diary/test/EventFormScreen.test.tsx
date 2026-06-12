/**
 * Tests for EventFormScreen.
 *
 * The critical pin: the chips display capitalized labels ('Visitor') but the
 * backend enum is lowercase ('visitor'|'safety'|'instruction'|'variation'|
 * 'other') — the payload MUST be lowercased at save time. The original shell
 * port missed this, 400-ing every event save (owner-reported bug).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Prevent useOfflineStatus → Dexie → MissingAPIError in jsdom.
vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

const mockAddEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('../useDiaryShellData', () => ({
  useDiaryShellData: () => ({
    diary: null,
    loading: false,
    lots: [],
    handlers: { activeLotId: null, addEventFromSheet: mockAddEvent },
  }),
}));

vi.mock('../../components/ShellScreen', () => ({
  ShellScreen: ({ children, bottom }: { children: React.ReactNode; bottom?: React.ReactNode }) => (
    <div>
      <main>{children}</main>
      {bottom}
    </div>
  ),
}));

vi.mock('@/components/foreman/sheets/useSheetDraft', () => ({
  useSheetDraft: () => ({
    draftHintVisible: false,
    dismissDraftHint: vi.fn(),
    clearDraft: vi.fn(),
    discardDraft: vi.fn(),
  }),
  readSheetDraft: () => null,
  sheetDraftKey: () => 'test-key',
}));

vi.mock('@/lib/localDate', () => ({
  formatDateKey: () => '2026-06-12',
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import { EventFormScreen } from '../EventFormScreen';

// ── Tests ─────────────────────────────────────────────────────────────────────

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/m/diary/work/event']}>
        <Routes>
          <Route path="/m/diary/work/event" element={<EventFormScreen />} />
          <Route path="/m/diary/work" element={<div>work</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EventFormScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddEvent.mockResolvedValue(undefined);
  });

  it('save is disabled until a type is picked and a description typed', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: 'Save event' })).toBeDisabled();
  });

  it('sends the LOWERCASE backend enum value, not the display label', async () => {
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Visitor' }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\.|describe|what happened/i), {
      target: { value: 'Client rep walked the embankment' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

    await waitFor(() => expect(mockAddEvent).toHaveBeenCalledTimes(1));
    expect(mockAddEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'visitor',
        description: 'Client rep walked the embankment',
      }),
    );
  });
});
