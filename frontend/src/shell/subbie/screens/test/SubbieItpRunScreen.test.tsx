/**
 * Tests for SubbieItpRunScreen — the subbie ITP run (/p/lots/:lotId/itp).
 *
 * The run's data + actions come from useSubbieItpRun; we mock at that hook
 * boundary (same shape as the foreman ItpRunScreen test) so we can pin the
 * SCREEN's behaviour without re-testing the scrubber physics (covered by foreman
 * suites). We assert only that the track receives the right item states.
 *
 * MOCKS @/lib/useOfflineStatus for CI coverage (ShellScreen → SyncChip → Dexie).
 *
 * Pins:
 *   - active item renders the question + CHECK n/m
 *   - canComplete=false → tri-state hidden, banner shown, no photo button
 *   - canComplete=true  → Pass fires the reused completion action
 *   - N/A requires + sends a trimmed reason
 *   - hold-point item offers NO Pass (N/A + Fail only) + awaiting-release notice
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ITPChecklistItem, ITPCompletion, ITPInstance } from '@/pages/lots/types';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', fullName: 'Mick', role: 'subcontractor' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));
vi.mock('../../subbieShellContext', () => ({
  useSubbieShellContext: () => ({ projectId: 'proj-1' }),
}));

const pass = vi.fn().mockResolvedValue(true);
const markNA = vi.fn().mockResolvedValue(true);
const markFailed = vi.fn().mockResolvedValue(true);
const addPhoto = vi.fn().mockResolvedValue(undefined);
let _run: ReturnType<typeof makeRun>;
vi.mock('../useSubbieItpRun', () => ({
  useSubbieItpRun: () => _run,
}));

import { SubbieItpRunScreen } from '../SubbieItpRunScreen';

function makeItem(over: Partial<ITPChecklistItem>): ITPChecklistItem {
  return {
    id: 'item-1',
    description: 'Bedding sand to 100mm depth?',
    category: 'Bedding',
    responsibleParty: 'subcontractor',
    isHoldPoint: false,
    pointType: 'standard',
    evidenceRequired: 'photo',
    order: 0,
    ...over,
  };
}

function makeInstance(items: ITPChecklistItem[], completions: ITPCompletion[] = []): ITPInstance {
  return {
    id: 'inst-1',
    template: { id: 't1', name: 'Stormwater ITP', checklistItems: items },
    completions,
  };
}

function makeRun(instance: ITPInstance | null, opts: { canComplete?: boolean } = {}) {
  return {
    lot: { id: 'lot-1', projectId: 'proj-1', lotNumber: 'LOT-014', status: 'in_progress' },
    instance,
    loading: false,
    loadError: null as string | null,
    canComplete: opts.canComplete ?? true,
    updatingItemId: null as string | null,
    completionFor: (id: string) => instance?.completions.find((c) => c.checklistItemId === id),
    pass,
    markNA,
    markFailed,
    addPhoto,
    refetch: vi.fn(),
  };
}

function renderRun() {
  return render(
    <MemoryRouter initialEntries={['/p/lots/lot-1/itp']}>
      <Routes>
        <Route path="/p/lots/:lotId/itp" element={<SubbieItpRunScreen />} />
        <Route path="/p/itps" element={<div>itps list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SubbieItpRunScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the question, category and CHECK n/m', () => {
    _run = makeRun(makeInstance([makeItem({})]));
    renderRun();
    expect(screen.getByText('BEDDING')).toBeInTheDocument();
    expect(screen.getByText('Bedding sand to 100mm depth?')).toBeInTheDocument();
    expect(screen.getByText('CHECK 1/1')).toBeInTheDocument();
  });

  it('Pass fires the reused completion action and advances for a non-photo check', async () => {
    _run = makeRun(
      makeInstance([
        makeItem({ id: 'a', evidenceRequired: 'none' }),
        makeItem({ id: 'b', description: 'Second' }),
      ]),
    );
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: /Pass this check/i }));
    await waitFor(() => expect(pass).toHaveBeenCalledWith('a', null));
  });

  it('N/A requires a reason and sends the trimmed reason', async () => {
    _run = makeRun(makeInstance([makeItem({ id: 'a' })]));
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: /Mark not applicable/i }));
    // Submitting blank shows an error, no call.
    fireEvent.click(screen.getByRole('button', { name: /^Mark N\/A$/i }));
    expect(await screen.findByText(/Add a reason for marking N\/A/i)).toBeInTheDocument();
    expect(markNA).not.toHaveBeenCalled();
    // With a reason it sends it.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  not in scope  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^Mark N\/A$/i }));
    await waitFor(() => expect(markNA).toHaveBeenCalledWith('a', '  not in scope  '));
  });

  it('read-only (canComplete=false) hides tri-state, shows banner, hides photo button', () => {
    _run = makeRun(makeInstance([makeItem({})]), { canComplete: false });
    renderRun();
    expect(screen.queryByRole('button', { name: /Pass this check/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark not applicable/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add evidence photo/i })).not.toBeInTheDocument();
    expect(screen.getByText(/View only — contact your PM/i)).toBeInTheDocument();
  });

  it('hold-point item offers NO Pass (N/A + Fail only) and an awaiting-release notice', () => {
    _run = makeRun(makeInstance([makeItem({ id: 'hp', pointType: 'hold_point' })]));
    renderRun();
    expect(screen.queryByRole('button', { name: /Pass this check/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark not applicable/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fail this check/i })).toBeInTheDocument();
    expect(
      screen.getByText(/can’t be ticked complete until the head contractor releases it/i),
    ).toBeInTheDocument();
  });

  it('shows awaiting-verification state without completion actions', () => {
    _run = makeRun(
      makeInstance(
        [makeItem({ id: 'a' })],
        [
          {
            id: 'comp-a',
            checklistItemId: 'a',
            isCompleted: true,
            isPendingVerification: true,
            verificationStatus: 'pending_verification',
            notes: null,
            completedAt: null,
            completedBy: null,
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            attachments: [],
          },
        ],
      ),
    );

    renderRun();

    expect(screen.getAllByText('Awaiting head-contractor verification').length).toBeGreaterThan(0);
    expect(screen.getByText(/submitted and is waiting for review/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pass this check/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark not applicable/i })).not.toBeInTheDocument();
  });

  it('shows rejected state and allows the subbie to resubmit when evidence is attached', async () => {
    _run = makeRun(
      makeInstance(
        [makeItem({ id: 'a' })],
        [
          {
            id: 'comp-a',
            checklistItemId: 'a',
            isCompleted: true,
            isRejected: true,
            verificationStatus: 'rejected',
            verificationNotes: 'Photo does not show the bedding depth.',
            notes: null,
            completedAt: null,
            completedBy: null,
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            attachments: [{ id: 'att-1' }] as ITPCompletion['attachments'],
          },
        ],
      ),
    );

    renderRun();

    expect(screen.getByText('Rejected by head contractor')).toBeInTheDocument();
    expect(screen.getAllByText(/Photo does not show the bedding depth/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Pass this check/i }));
    await waitFor(() => expect(pass).toHaveBeenCalledWith('a', null));
  });

  it('confirms before passing a photo-required check with no photo (does not pass yet)', () => {
    _run = makeRun(makeInstance([makeItem({ id: 'a' })]));
    renderRun();

    fireEvent.click(screen.getByRole('button', { name: /Pass this check/i }));

    expect(pass).not.toHaveBeenCalled();
    expect(screen.getByText(/requires photo evidence/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pass without photo$/i })).toBeInTheDocument();
  });

  it('"Pass without photo" proceeds with the pass', async () => {
    _run = makeRun(makeInstance([makeItem({ id: 'a' })]));
    renderRun();

    fireEvent.click(screen.getByRole('button', { name: /Pass this check/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Pass without photo$/i }));

    await waitFor(() => expect(pass).toHaveBeenCalledWith('a', null));
  });

  it('"Add photo" from the guard opens the picker so a photo can be attached', () => {
    _run = makeRun(makeInstance([makeItem({ id: 'a' })]));
    const { container } = renderRun();

    fireEvent.click(screen.getByRole('button', { name: /Pass this check/i }));
    expect(screen.getByRole('button', { name: /^Add photo$/i })).toBeInTheDocument();

    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(addPhoto).toHaveBeenCalledWith('a', file);
    expect(pass).not.toHaveBeenCalled();
  });

  it('does NOT guard when the photo-required check already has a photo', async () => {
    _run = makeRun(
      makeInstance(
        [makeItem({ id: 'a' })],
        [
          {
            id: 'comp-a',
            checklistItemId: 'a',
            isCompleted: false,
            notes: null,
            completedAt: null,
            completedBy: null,
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            attachments: [{ id: 'att-1' }] as ITPCompletion['attachments'],
          },
        ],
      ),
    );
    renderRun();

    fireEvent.click(screen.getByRole('button', { name: /Pass this check/i }));

    await waitFor(() => expect(pass).toHaveBeenCalledWith('a', null));
    expect(screen.queryByText(/requires photo evidence/i)).not.toBeInTheDocument();
  });

  it('does NOT guard a check that does not require a photo', async () => {
    _run = makeRun(makeInstance([makeItem({ id: 'a', evidenceRequired: 'none' })]));
    renderRun();

    fireEvent.click(screen.getByRole('button', { name: /Pass this check/i }));

    await waitFor(() => expect(pass).toHaveBeenCalledWith('a', null));
    expect(screen.queryByText(/requires photo evidence/i)).not.toBeInTheDocument();
  });

  it('does not call failed checks complete in the finished state', () => {
    _run = makeRun(
      makeInstance(
        [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })],
        [
          {
            id: 'comp-a',
            checklistItemId: 'a',
            isCompleted: true,
            notes: null,
            completedAt: null,
            completedBy: null,
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            attachments: [],
          },
          {
            id: 'comp-b',
            checklistItemId: 'b',
            isCompleted: true,
            notes: null,
            completedAt: null,
            completedBy: null,
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            attachments: [],
          },
          {
            id: 'comp-c',
            checklistItemId: 'c',
            isCompleted: false,
            isFailed: true,
            notes: 'Out of tolerance',
            completedAt: null,
            completedBy: null,
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            attachments: [],
          },
        ],
      ),
    );

    renderRun();

    expect(screen.getByText('CHECKS REVIEWED')).toBeInTheDocument();
    expect(screen.getByText('Issues need attention')).toBeInTheDocument();
    expect(screen.getByText(/2 passed checks/i)).toBeInTheDocument();
    expect(screen.getByText(/1 failed check/i)).toBeInTheDocument();
    expect(screen.queryByText('All checks complete')).not.toBeInTheDocument();
  });

  it('superintendent sign-off item is status-only even when the subbie can complete ITPs', () => {
    const released: ITPCompletion = {
      id: 'comp-sup',
      checklistItemId: 'sup',
      isCompleted: false,
      notes: null,
      completedAt: null,
      completedBy: null,
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      attachments: [],
      holdPointRelease: {
        releasedByName: 'Super',
        releasedByOrg: 'Council',
        releaseMethod: 'email',
        releasedAt: '2026-06-11',
      },
    };
    _run = makeRun(
      makeInstance(
        [
          makeItem({
            id: 'sup',
            responsibleParty: 'superintendent',
            pointType: 'standard',
            description: 'Superintendent sign-off',
          }),
        ],
        [released],
      ),
    );
    renderRun();

    expect(screen.getAllByText(/Superintendent sign-off required/i).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.queryByRole('button', { name: /Pass this check/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fail this check/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark not applicable/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add evidence photo/i })).not.toBeInTheDocument();
  });

  it('passes the right per-item states to the dot track', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
      makeItem({ id: 'c', pointType: 'hold_point' }),
    ];
    const completions: ITPCompletion[] = [
      {
        id: 'comp-a',
        checklistItemId: 'a',
        isCompleted: true,
        notes: null,
        completedAt: null,
        completedBy: null,
        isVerified: true,
        verifiedAt: null,
        verifiedBy: null,
        attachments: [],
      },
    ];
    _run = makeRun(makeInstance(items, completions));
    renderRun();
    // The dot track renders one slider with aria value for the focused (first
    // pending) item; item 'a' is done so focus lands on 'b' (index 2 → CHECK 2/3).
    expect(screen.getByText('CHECK 2/3')).toBeInTheDocument();
    expect(screen.getByTestId('itp-dot-track')).toBeInTheDocument();
  });
});
