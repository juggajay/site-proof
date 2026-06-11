/**
 * Tests for useShellItpRun — proves the shell run hook REUSES the shared
 * completion machinery rather than duplicating it: PASS calls the extracted
 * `writeItpCompletionToggle` primitive (which owns the online+offline path), and
 * N/A / FAIL delegate to the existing `useItpMobileActions`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ITPInstance } from '@/pages/lots/types';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn(), devWarn: vi.fn() }));
vi.mock('@/lib/offlineDb', () => ({
  cacheITPChecklist: vi.fn(),
  getCachedITPChecklist: vi.fn().mockResolvedValue(undefined),
  getPendingSyncCount: vi.fn().mockResolvedValue(0),
}));

// Spies created in hoisted scope so the vi.mock factories can reference them.
const { writeItpCompletionToggle, mobileMarkNA, mobileMarkFailed } = vi.hoisted(() => ({
  writeItpCompletionToggle: vi.fn(),
  mobileMarkNA: vi.fn().mockResolvedValue(true),
  mobileMarkFailed: vi.fn().mockResolvedValue(true),
}));

// The shared completion-write primitive — assert the shell drives it.
vi.mock('@/pages/lots/lib/itpCompletionWrite', () => ({ writeItpCompletionToggle }));

// The existing mobile actions — assert N/A + FAIL delegate to them.
vi.mock('@/pages/lots/hooks/useItpMobileActions', () => ({
  useItpMobileActions: () => ({ mobileMarkNA, mobileMarkFailed }),
}));

import { apiFetch } from '@/lib/api';
import { useShellItpRun } from '../useShellItpRun';

const mockApiFetch = vi.mocked(apiFetch);

const instance: ITPInstance = {
  id: 'inst-1',
  template: {
    id: 't1',
    name: 'ITP',
    checklistItems: [
      {
        id: 'item-1',
        description: 'Check',
        category: 'General',
        responsibleParty: 'contractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'none',
        order: 0,
      },
    ],
  },
  completions: [],
};

afterEach(() => vi.clearAllMocks());

describe('useShellItpRun', () => {
  it('loads the ITP instance from the API', async () => {
    mockApiFetch.mockResolvedValueOnce({ instance });
    const { result } = renderHook(() => useShellItpRun('proj-1', 'lot-1'));
    await waitFor(() => expect(result.current.instance?.id).toBe('inst-1'));
  });

  it('PASS drives the shared write primitive and merges the result', async () => {
    mockApiFetch.mockResolvedValueOnce({ instance });
    writeItpCompletionToggle.mockResolvedValueOnce({
      status: 'saved',
      completion: {
        id: 'c-1',
        checklistItemId: 'item-1',
        isCompleted: true,
        notes: null,
        completedAt: '2026-06-11',
        completedBy: null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        attachments: [],
      },
    });

    const { result } = renderHook(() => useShellItpRun('proj-1', 'lot-1'));
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    let ok = false;
    await act(async () => {
      ok = await result.current.pass('item-1', null);
    });

    expect(ok).toBe(true);
    expect(writeItpCompletionToggle).toHaveBeenCalledWith(
      expect.objectContaining({
        itpInstanceId: 'inst-1',
        lotId: 'lot-1',
        checklistItemId: 'item-1',
        currentlyCompleted: false,
      }),
    );
    await waitFor(() => expect(result.current.completionFor('item-1')?.isCompleted).toBe(true));
  });

  it('markNA / markFailed delegate to the existing mobile actions', async () => {
    mockApiFetch.mockResolvedValueOnce({ instance });
    const { result } = renderHook(() => useShellItpRun('proj-1', 'lot-1'));
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    await act(async () => {
      await result.current.markNA('item-1', 'reason');
      await result.current.markFailed('item-1', 'defect');
    });

    expect(mobileMarkNA).toHaveBeenCalledWith('item-1', 'reason');
    expect(mobileMarkFailed).toHaveBeenCalledWith('item-1', 'defect');
  });
});
