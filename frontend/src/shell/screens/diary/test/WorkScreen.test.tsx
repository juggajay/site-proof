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
let _diaryStatus = 'draft';
vi.mock('../useDiaryShellData', () => ({
  useDiaryShellData: () => ({
    diary: { id: 'd1', status: _diaryStatus },
    timeline: _timeline,
    handlers: { handleDeleteEntry },
  }),
}));

// C5-a. The chip's local half comes from Dexie; the tests drive it directly
// rather than standing up IndexedDB.
let _queuedDocketPhotos = new Map<string, { syncStatus: string }>();
let _isOnline = true;
vi.mock('@/components/deliveries/useDeliveryDocketPhotos', () => ({
  useDeliveryDocketPhotos: () => ({ byDeliveryId: _queuedDocketPhotos, isOnline: _isOnline }),
}));

// The evidence sheet is exercised on its own; here we only need to see that the
// locked row opens it.
vi.mock('@/components/deliveries/DeliveryEvidenceSheet', () => ({
  DeliveryEvidenceSheet: ({ delivery }: { delivery: { id: string; description: string } }) => (
    <div data-testid="evidence-sheet">{delivery.description}</div>
  ),
}));

// ShellScreen is deliberately NOT mocked: it renders for real (its only
// external dependency, useOfflineStatus, is mocked above). A `vi.mock` used to
// sit here pointing at '../../components/ShellScreen', which resolves to
// src/shell/screens/components/ — a directory that does not exist — so it never
// applied. A mock that silently does nothing is worse than no mock.
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
        <Route path="/m/diary/review" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WorkScreen entry rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _timeline = [entry()];
    _diaryStatus = 'draft';
    _queuedDocketPhotos = new Map();
    _isOnline = true;
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

// ── Step 3 of 4 always has a way forward ─────────────────────────────────────

describe('WorkScreen forward control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _diaryStatus = 'draft';
    _queuedDocketPhotos = new Map();
    _isOnline = true;
  });

  // The dead end this closes: a legitimately empty work day (rained out, stood
  // down) left the back chevron as the only control, so the diary could never
  // be reviewed or submitted.
  it('offers Next on an empty work day and lands on review', () => {
    _timeline = [];
    renderScreen();

    const next = screen.getByRole('button', { name: /next: review and submit/i });
    fireEvent.click(next);

    expect(screen.getByTestId('loc').textContent).toContain('/m/diary/review');
  });

  it('keeps the "Done" wording once work has been logged', () => {
    _timeline = [entry()];
    renderScreen();

    expect(screen.getByRole('button', { name: /done — review and submit/i })).toBeInTheDocument();
  });

  it('offers no forward control once the diary is submitted', () => {
    _timeline = [entry()];
    _diaryStatus = 'submitted';
    renderScreen();

    expect(screen.queryByRole('button', { name: /review and submit/i })).not.toBeInTheDocument();
  });
});

// ── C5-a: the docket filing chip ────────────────────────────────────────────

function delivery(over: Partial<TimelineEntry> = {}): TimelineEntry {
  return entry({
    id: 'del-1',
    type: 'delivery',
    description: '32 MPa concrete',
    data: {},
    ...over,
  });
}

describe('WorkScreen delivery docket chip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _timeline = [delivery()];
    _diaryStatus = 'draft';
    _queuedDocketPhotos = new Map();
    _isOnline = true;
  });

  it('reads "Not filed in CIVOS" when no docket has reached the server', () => {
    renderScreen();
    expect(screen.getByText('Not filed in CIVOS')).toBeInTheDocument();
  });

  it('reads "Docket filed" only once the evidence link exists', () => {
    _timeline = [delivery({ data: { docketDocumentId: 'doc-1' } })];
    renderScreen();
    expect(screen.getByText('Docket filed')).toBeInTheDocument();
  });

  // The state that must never be mistaken for filed: the photo is on the phone.
  it('reads "Saved on device" for a queued docket with no signal, never "filed"', () => {
    _isOnline = false;
    _queuedDocketPhotos = new Map([['del-1', { syncStatus: 'pending' }]]);
    renderScreen();

    expect(screen.getByText('Saved on device')).toBeInTheDocument();
    expect(screen.queryByText('Docket filed')).not.toBeInTheDocument();
  });

  it('reads "Uploading" for a queued docket with signal', () => {
    _queuedDocketPhotos = new Map([['del-1', { syncStatus: 'pending' }]]);
    renderScreen();
    expect(screen.getByText('Uploading')).toBeInTheDocument();
  });

  it('reads "Filing failed" when the queued docket errored', () => {
    _queuedDocketPhotos = new Map([['del-1', { syncStatus: 'error' }]]);
    renderScreen();
    expect(screen.getByText('Filing failed')).toBeInTheDocument();
  });

  it('does not chip activity/delay/event rows — the feature is deliveries only', () => {
    _timeline = [entry({ id: 'a1', type: 'activity' })];
    renderScreen();
    expect(screen.queryByText('Not filed in CIVOS')).not.toBeInTheDocument();
  });
});

describe('WorkScreen after the diary is submitted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _diaryStatus = 'submitted';
    _queuedDocketPhotos = new Map();
    _isOnline = true;
  });

  // The point of the whole post-submission path: the supplier's paper docket
  // turns up the morning after submission, and it must still be fileable.
  it('a locked delivery row opens the evidence sheet instead of the edit form', () => {
    _timeline = [delivery()];
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /File docket for 32 MPa concrete/i }));

    expect(screen.getByTestId('evidence-sheet')).toHaveTextContent('32 MPa concrete');
    // It did NOT navigate to the edit form: diary CONTENT stays locked.
    expect(screen.queryByTestId('loc')).not.toBeInTheDocument();
  });

  it('says what is still possible instead of leaving a dead screen', () => {
    _timeline = [delivery()];
    renderScreen();
    expect(screen.getByText(/Dockets can still be filed against them/i)).toBeInTheDocument();
  });

  it('leaves every other locked row inert', () => {
    _timeline = [entry({ id: 'a1', type: 'activity' })];
    renderScreen();
    expect(screen.getByRole('button', { name: /Edit Activity/i })).toBeDisabled();
  });
});
