/**
 * Tests for CrewScreen — copy-from-yesterday affordance gating.
 *
 * Covers:
 *   - Copy buttons hidden when diary is null (canCopyFromYesterday=false)
 *   - Copy buttons shown when diary exists (canCopyFromYesterday=true)
 *   - Clicking copy buttons fires the correct handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Prevent useOfflineStatus → Dexie → MissingAPIError in jsdom.
vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));

vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../components/ShellScreen', () => ({
  ShellScreen: ({ children, bottom }: { children: React.ReactNode; bottom?: React.ReactNode }) => (
    <div>
      <main>{children}</main>
      {bottom}
    </div>
  ),
}));

vi.mock('@/components/foreman/sheets/AddManualLabourPlantSheet', () => ({
  AddManualLabourPlantSheet: () => null,
}));

vi.mock('@/components/foreman/sheets/useSheetDraft', () => ({
  sheetDraftKey: () => 'test-key',
}));

vi.mock('@/lib/localDate', () => ({
  formatDateKey: () => '2026-06-11',
}));

const mockCopyPersonnel = vi.fn().mockResolvedValue(undefined);
const mockCopyPlant = vi.fn().mockResolvedValue(undefined);

let _canCopy = false;

vi.mock('../useDiaryShellData', () => ({
  useDiaryShellData: () => ({
    diary: _canCopy ? { id: 'diary-1', status: 'draft', personnel: [], plant: [] } : null,
    loading: false,
    timeline: [],
    lots: [],
    handlers: {
      activeLotId: null,
      canCopyFromYesterday: _canCopy,
      copyPersonnelFromYesterday: mockCopyPersonnel,
      copyPlantFromYesterday: mockCopyPlant,
      copyingPersonnel: false,
      copyingPlant: false,
      handleSavePersonnel: vi.fn(),
      handleSavePlant: vi.fn(),
      handleEditEntry: vi.fn(),
    },
  }),
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import { CrewScreen } from '../CrewScreen';

// ── Tests ─────────────────────────────────────────────────────────────────────

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/m/diary/crew']}>
        <Routes>
          <Route path="/m/diary/crew" element={<CrewScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CrewScreen — copy from yesterday affordance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCopyPersonnel.mockResolvedValue(undefined);
    mockCopyPlant.mockResolvedValue(undefined);
  });

  it('copy buttons are NOT shown when canCopyFromYesterday=false', () => {
    _canCopy = false;
    renderScreen();
    expect(
      screen.queryByRole('button', { name: /copy yesterday's crew/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /copy yesterday's plant/i }),
    ).not.toBeInTheDocument();
  });

  it('copy buttons ARE shown when canCopyFromYesterday=true', () => {
    _canCopy = true;
    renderScreen();
    expect(screen.getByRole('button', { name: /copy yesterday's crew/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy yesterday's plant/i })).toBeInTheDocument();
  });

  it('clicking crew copy fires copyPersonnelFromYesterday', () => {
    _canCopy = true;
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /copy yesterday's crew/i }));
    expect(mockCopyPersonnel).toHaveBeenCalledTimes(1);
  });

  it('clicking plant copy fires copyPlantFromYesterday', () => {
    _canCopy = true;
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /copy yesterday's plant/i }));
    expect(mockCopyPlant).toHaveBeenCalledTimes(1);
  });
});
