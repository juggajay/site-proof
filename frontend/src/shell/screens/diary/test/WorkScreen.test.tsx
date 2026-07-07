/**
 * Tests for the diary WorkScreen entry rows: tapping a row navigates to the
 * matching form pre-filled for editing (?edit=<id>) rather than the old silent
 * no-op, and each row has a two-tap delete wired to handleDeleteEntry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { TimelineEntry } from '@/components/foreman/DiaryTimelineEntry';

vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

// ShellScreen mounts SyncChip → useOfflineStatus (Dexie); mock so tests run
// without IndexedDB.
vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({
    isOnline: true,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    isSyncing: false,
    retryFailedSyncs: vi.fn(),
  }),
}));

const handleDeleteEntry = vi.fn().mockResolvedValue(undefined);
let _timeline: TimelineEntry[] = [];
vi.mock('../useDiaryShellData', () => ({
  useDiaryShellData: () => ({
    diary: { id: 'd1', status: 'draft' },
    timeline: _timeline,
    handlers: { handleDeleteEntry },
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

import { WorkScreen } from '../WorkScreen';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="loc">{`${location.pathname}${location.search}`}</div>;
}

function entry(over: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 'e1',
    type: 'activity',
    createdAt: '2026-06-11T08:00:00Z',
    description: 'Placed select fill',
    lot: null,
    data: {},
    ...over,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/m/diary/work']}>
      <Routes>
        <Route path="/m/diary/work" element={<WorkScreen />} />
        <Route path="/m/diary/work/:type" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WorkScreen entry rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _timeline = [entry()];
  });

  it('navigates to the matching form pre-filled for editing on row tap', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Edit Activity: Placed select fill/i }));
    const loc = screen.getByTestId('loc').textContent ?? '';
    expect(loc).toContain('/m/diary/work/activity');
    expect(loc).toContain('edit=e1');
  });

  it('deletes an entry only on the second (confirming) tap', () => {
    renderScreen();
    const del = screen.getByRole('button', { name: 'Delete Activity' });

    fireEvent.click(del);
    expect(handleDeleteEntry).not.toHaveBeenCalled();
    // Armed state re-labels the button.
    expect(screen.getByRole('button', { name: 'Confirm delete Activity' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Activity' }));
    expect(handleDeleteEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });
});
