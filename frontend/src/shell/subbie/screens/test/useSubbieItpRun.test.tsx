/**
 * Tests for useSubbieItpRun — the subbie ITP run data + action hook.
 *
 * Pins the load-bearing wiring the run screen relies on but does NOT exercise:
 *   - the exact data URLs incl. portalModule=itps + subcontractorView=true
 *   - canComplete derived from subcontractorAssignments[].canCompleteITP
 *   - photo flow ordering on an item WITHOUT a completion: POST /api/itp/completions
 *     (status:'pending') FIRST, THEN uploadItpEvidencePhotoWithOfflineFallback
 *     with {projectId, lotId, completionId, ...}
 *   - photo flow on an item WITH a completion: NO create, upload only
 *
 * MOCKS the photo upload helper (network) and useItpCompletionActions (its own
 * suite covers the request shapes); apiFetch is mocked per-URL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ITPCompletion, ITPInstance } from '@/pages/lots/types';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const uploadMock = vi.fn();
vi.mock('@/pages/lots/hooks/useLotPhotoUpload', () => ({
  uploadItpEvidencePhotoWithOfflineFallback: (...args: unknown[]) => uploadMock(...args),
}));

const {
  handleToggleCompletionMock,
  handleMarkNotApplicableMock,
  handleMarkFailedMock,
  handleUpdateNotesMock,
} = vi.hoisted(() => ({
  handleToggleCompletionMock: vi.fn(),
  handleMarkNotApplicableMock: vi.fn(),
  handleMarkFailedMock: vi.fn(),
  handleUpdateNotesMock: vi.fn(),
}));

// The shared completion-action hook has its own suite; here we only need it to
// not throw and to expose the four handlers.
vi.mock('@/pages/lots/hooks/useItpCompletionActions', () => ({
  useItpCompletionActions: () => ({
    handleToggleCompletion: handleToggleCompletionMock,
    handleMarkNotApplicable: handleMarkNotApplicableMock,
    handleMarkFailed: handleMarkFailedMock,
    handleUpdateNotes: handleUpdateNotesMock,
  }),
}));

vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

import { useSubbieItpRun } from '../useSubbieItpRun';

const instance: ITPInstance = {
  id: 'inst-1',
  template: {
    id: 't1',
    name: 'Stormwater ITP',
    checklistItems: [
      {
        id: 'item-1',
        description: 'q',
        category: 'Bedding',
        responsibleParty: 'subcontractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'photo',
        order: 0,
      },
    ],
  },
  completions: [],
};

function setApi({
  canComplete = true,
  completions = [] as ITPCompletion[],
  createdCompletion = { id: 'comp-new' } as Partial<ITPCompletion>,
} = {}) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string, opts?: { method?: string }) => {
    if (url === '/api/lots/lot-1?portalModule=itps') {
      return Promise.resolve({
        lot: {
          id: 'lot-1',
          projectId: 'proj-1',
          lotNumber: 'LOT-014',
          status: 'in_progress',
          subcontractorAssignments: [
            { canCompleteITP: canComplete, itpRequiresVerification: false },
          ],
        },
      });
    }
    if (url === '/api/itp/instances/lot/lot-1?subcontractorView=true') {
      return Promise.resolve({ instance: { ...instance, completions } });
    }
    if (url === '/api/itp/completions' && opts?.method === 'POST') {
      return Promise.resolve({ completion: createdCompletion });
    }
    return Promise.resolve({});
  });
}

describe('useSubbieItpRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleToggleCompletionMock.mockResolvedValue(true);
    handleMarkNotApplicableMock.mockResolvedValue(true);
    handleMarkFailedMock.mockResolvedValue(true);
    handleUpdateNotesMock.mockResolvedValue(undefined);
    uploadMock.mockResolvedValue({ status: 'uploaded', attachment: { id: 'att-1' } });
  });

  it('fetches the lot + instance with the exact subbie URLs and derives canComplete', async () => {
    setApi({ canComplete: true });
    const { result } = renderHook(() => useSubbieItpRun('lot-1'));
    await waitFor(() => expect(result.current.instance).not.toBeNull());
    expect(apiFetchMock).toHaveBeenCalledWith('/api/lots/lot-1?portalModule=itps');
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/itp/instances/lot/lot-1?subcontractorView=true',
    );
    expect(result.current.canComplete).toBe(true);
  });

  it('canComplete is false when no assignment grants completion', async () => {
    setApi({ canComplete: false });
    const { result } = renderHook(() => useSubbieItpRun('lot-1'));
    await waitFor(() => expect(result.current.instance).not.toBeNull());
    expect(result.current.canComplete).toBe(false);
  });

  it('photo on an item WITHOUT a completion creates a pending completion FIRST, then uploads', async () => {
    setApi({ canComplete: true, completions: [] });
    const { result } = renderHook(() => useSubbieItpRun('lot-1'));
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      await result.current.addPhoto('item-1', file);
    });

    // Completion created first.
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/itp/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const createBody = JSON.parse(
      (
        apiFetchMock.mock.calls.find(
          (c) => c[0] === '/api/itp/completions' && c[1]?.method === 'POST',
        )?.[1] as { body: string }
      ).body,
    );
    expect(createBody).toMatchObject({
      itpInstanceId: 'inst-1',
      checklistItemId: 'item-1',
      status: 'pending',
      notes: '',
    });

    // Then upload with the freshly-created completion id.
    expect(uploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        lotId: 'lot-1',
        completionId: 'comp-new',
        file,
        capturedBy: 'u1',
      }),
    );
  });

  it('photo on an item WITH a completion uploads without creating one', async () => {
    const existing: ITPCompletion = {
      id: 'comp-existing',
      checklistItemId: 'item-1',
      isCompleted: false,
      notes: null,
      completedAt: null,
      completedBy: null,
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      attachments: [],
    };
    setApi({ canComplete: true, completions: [existing] });
    const { result } = renderHook(() => useSubbieItpRun('lot-1'));
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    await act(async () => {
      await result.current.addPhoto('item-1', file);
    });

    const postCreate = apiFetchMock.mock.calls.filter(
      (c) => c[0] === '/api/itp/completions' && c[1]?.method === 'POST',
    );
    expect(postCreate).toHaveLength(0);
    expect(uploadMock).toHaveBeenCalledWith(
      expect.objectContaining({ completionId: 'comp-existing' }),
    );
  });

  it('pass returns false when the shared completion action reports a failed save', async () => {
    handleToggleCompletionMock.mockResolvedValueOnce(false);
    setApi({ canComplete: true, completions: [] });
    const { result } = renderHook(() => useSubbieItpRun('lot-1'));
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.pass('item-1', 'ready');
    });

    expect(saved).toBe(false);
    expect(handleToggleCompletionMock).toHaveBeenCalledWith('item-1', true, 'ready');
  });

  it('pass resubmits a rejected completed item instead of treating it as done', async () => {
    const rejected: ITPCompletion = {
      id: 'comp-rejected',
      checklistItemId: 'item-1',
      isCompleted: true,
      isRejected: true,
      verificationStatus: 'rejected',
      verificationNotes: 'Redo this check',
      notes: 'old pass',
      completedAt: '2026-06-10',
      completedBy: null,
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      attachments: [],
    };
    setApi({ canComplete: true, completions: [rejected] });
    const { result } = renderHook(() => useSubbieItpRun('lot-1'));
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.pass('item-1', 'ready after rework');
    });

    expect(saved).toBe(true);
    expect(handleToggleCompletionMock).toHaveBeenCalledWith('item-1', true, 'ready after rework');
  });
});
