/**
 * Tests for the extracted ITP completion write primitive (itpCompletionWrite.ts).
 * Proves the online success + write-through, the retriable-failure offline queue,
 * and the 4xx re-throw — the exact resilience the page hook had inline before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/offlineDb', () => ({
  recordSyncedChecklistItem: vi.fn(),
  updateChecklistItemOffline: vi.fn(),
}));

import { apiFetch, ApiError } from '@/lib/api';
import { recordSyncedChecklistItem, updateChecklistItemOffline } from '@/lib/offlineDb';
import { writeItpCompletionToggle } from './itpCompletionWrite';
import type { ITPCompletion } from '../types';

const mockApiFetch = vi.mocked(apiFetch);
const mockRecordSynced = vi.mocked(recordSyncedChecklistItem);
const mockUpdateOffline = vi.mocked(updateChecklistItemOffline);

const serverCompletion: ITPCompletion = {
  id: 'c-1',
  checklistItemId: 'item-1',
  isCompleted: true,
  notes: null,
  completedAt: '2026-06-11',
  completedBy: { id: 'u1', fullName: 'Jay', email: 'j@x.com' },
  isVerified: false,
  verifiedAt: null,
  verifiedBy: null,
  attachments: [],
};

afterEach(() => vi.clearAllMocks());

describe('writeItpCompletionToggle — online', () => {
  it('POSTs, returns saved, and write-through caches', async () => {
    mockApiFetch.mockResolvedValueOnce({ completion: serverCompletion });

    const result = await writeItpCompletionToggle({
      itpInstanceId: 'inst-1',
      lotId: 'lot-1',
      checklistItemId: 'item-1',
      currentlyCompleted: false,
      existingNotes: null,
    });

    expect(result).toEqual({ status: 'saved', completion: serverCompletion });
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/itp/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    // toggled to completed → cached as 'completed'
    expect(mockRecordSynced).toHaveBeenCalledWith(
      'lot-1',
      'item-1',
      'completed',
      undefined,
      'Current User',
      serverCompletion,
    );
    expect(mockUpdateOffline).not.toHaveBeenCalled();
  });

  it('forwards witness attribution when present', async () => {
    mockApiFetch.mockResolvedValueOnce({ completion: serverCompletion });
    await writeItpCompletionToggle({
      itpInstanceId: 'inst-1',
      lotId: 'lot-1',
      checklistItemId: 'item-1',
      currentlyCompleted: false,
      existingNotes: 'note',
      witnessData: { witnessPresent: true, witnessName: 'Sam', witnessCompany: 'Co' },
    });
    const body = JSON.parse((mockApiFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.witnessPresent).toBe(true);
    expect(body.witnessName).toBe('Sam');
    expect(body.isCompleted).toBe(true);
  });
});

describe('writeItpCompletionToggle — offline fallback', () => {
  it('queues + returns optimistic completion on a network failure', async () => {
    mockApiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await writeItpCompletionToggle({
      itpInstanceId: 'inst-1',
      lotId: 'lot-1',
      checklistItemId: 'item-1',
      currentlyCompleted: false,
      existingNotes: 'keep me',
    });

    expect(result.status).toBe('queued');
    expect(result.completion.isCompleted).toBe(true);
    expect(result.completion.notes).toBe('keep me');
    expect(result.completion.completedBy?.fullName).toBe('You (Offline)');
    expect(mockUpdateOffline).toHaveBeenCalledWith(
      'lot-1',
      'item-1',
      'completed',
      'keep me',
      'Current User (Offline)',
      undefined, // ncrDetails
      undefined, // witnessDetails — none supplied for a plain toggle
    );
  });

  it('forwards witness attribution into the offline queue write (F-08)', async () => {
    mockApiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await writeItpCompletionToggle({
      itpInstanceId: 'inst-1',
      lotId: 'lot-1',
      checklistItemId: 'item-1',
      currentlyCompleted: false,
      existingNotes: null,
      witnessData: { witnessPresent: true, witnessName: 'Sam', witnessCompany: 'Co' },
    });

    expect(result.status).toBe('queued');
    expect(mockUpdateOffline).toHaveBeenCalledWith(
      'lot-1',
      'item-1',
      'completed',
      undefined,
      'Current User (Offline)',
      undefined, // ncrDetails
      { witnessPresent: true, witnessName: 'Sam', witnessCompany: 'Co' },
    );
  });

  it('queues an un-tick as pending', async () => {
    mockApiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await writeItpCompletionToggle({
      itpInstanceId: 'inst-1',
      lotId: 'lot-1',
      checklistItemId: 'item-1',
      currentlyCompleted: true, // toggling OFF
      existingNotes: null,
    });
    expect(result.status).toBe('queued');
    expect(result.completion.isCompleted).toBe(false);
    expect(mockUpdateOffline).toHaveBeenCalledWith(
      'lot-1',
      'item-1',
      'pending',
      undefined,
      'Current User (Offline)',
      undefined, // ncrDetails
      undefined, // witnessDetails
    );
  });
});

describe('writeItpCompletionToggle — definitive rejection', () => {
  it('re-throws a 4xx (e.g. hold-point guard) without queueing', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(400, 'This is a hold point.'));

    await expect(
      writeItpCompletionToggle({
        itpInstanceId: 'inst-1',
        lotId: 'lot-1',
        checklistItemId: 'item-1',
        currentlyCompleted: false,
        existingNotes: null,
      }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(mockUpdateOffline).not.toHaveBeenCalled();
  });

  it('re-throws when there is no lotId (cannot queue)', async () => {
    mockApiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(
      writeItpCompletionToggle({
        itpInstanceId: 'inst-1',
        lotId: undefined,
        checklistItemId: 'item-1',
        currentlyCompleted: false,
        existingNotes: null,
      }),
    ).rejects.toBeTruthy();
    expect(mockUpdateOffline).not.toHaveBeenCalled();
  });
});
