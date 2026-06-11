/**
 * Tests for ActivityFormScreen.
 *
 * Covers:
 *   - Mounts without error
 *   - Save button disabled when description empty
 *   - Save button fires addActivityFromSheet with typed description
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

const mockAddActivity = vi.fn().mockResolvedValue(undefined);

vi.mock('../useDiaryShellData', () => ({
  useDiaryShellData: () => ({
    diary: null,
    loading: false,
    lots: [],
    handlers: { activeLotId: null, addActivityFromSheet: mockAddActivity },
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
  formatDateKey: () => '2026-06-11',
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import { ActivityFormScreen } from '../ActivityFormScreen';

// ── Tests ─────────────────────────────────────────────────────────────────────

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/m/diary/work/activity']}>
        <Routes>
          <Route path="/m/diary/work/activity" element={<ActivityFormScreen />} />
          <Route path="/m/diary/work" element={<div>work</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ActivityFormScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddActivity.mockResolvedValue(undefined);
  });

  it('mounts without error', () => {
    renderScreen();
    expect(screen.getByPlaceholderText(/Placed and compacted/i)).toBeInTheDocument();
  });

  it('save button is disabled when description empty', () => {
    renderScreen();
    const saveBtn = screen.getByRole('button', { name: /Save activity/i });
    expect(saveBtn).toBeDisabled();
  });

  it('save button fires addActivityFromSheet with typed description', async () => {
    renderScreen();
    const textarea = screen.getByPlaceholderText(/Placed and compacted/i);
    fireEvent.change(textarea, { target: { value: 'Compact fill layer 3' } });

    const saveBtn = screen.getByRole('button', { name: /Save activity/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockAddActivity).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Compact fill layer 3' }),
      );
    });
  });
});
