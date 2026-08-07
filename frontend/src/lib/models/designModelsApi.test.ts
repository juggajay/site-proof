import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, authFetch } from '@/lib/api';
import {
  expectedPartSize,
  isConversionPending,
  isQuarantined,
  missingPartIndexes,
  sendDesignModelVersionParts,
  sha256HexOf,
  VERSION_STATUS_LABELS,
  type DesignModelVersionStatus,
  type UploadHandle,
} from './designModelsApi';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);
const authFetchMock = vi.mocked(authFetch);

describe('expectedPartSize', () => {
  it('is the full part size for every part except the last', () => {
    // 10 bytes in 4-byte parts -> 4, 4, 2
    expect(expectedPartSize(10, 4, 3, 0)).toBe(4);
    expect(expectedPartSize(10, 4, 3, 1)).toBe(4);
    expect(expectedPartSize(10, 4, 3, 2)).toBe(2);
  });

  it('handles an exact multiple (last part is full-size)', () => {
    expect(expectedPartSize(8, 4, 2, 1)).toBe(4);
  });

  it('handles a single-part upload', () => {
    expect(expectedPartSize(3, 4, 1, 0)).toBe(3);
  });
});

describe('missingPartIndexes', () => {
  it('returns every index for a fresh upload', () => {
    expect(missingPartIndexes(3, [])).toEqual([0, 1, 2]);
  });

  it('returns only the gaps after an interrupted upload', () => {
    expect(missingPartIndexes(4, [0, 2])).toEqual([1, 3]);
  });

  it('returns nothing when the server has every part', () => {
    expect(missingPartIndexes(2, [0, 1])).toEqual([]);
  });
});

describe('sha256HexOf', () => {
  it('matches the SHA-256 test vector for "abc"', async () => {
    const bytes = new TextEncoder().encode('abc');
    await expect(sha256HexOf(bytes.buffer as ArrayBuffer)).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('version status helpers', () => {
  it('treats uploading/queued/converting as pending, ready/failed as settled', () => {
    const pending: DesignModelVersionStatus[] = ['uploading', 'queued', 'converting'];
    const settled: DesignModelVersionStatus[] = ['ready', 'failed'];
    for (const status of pending) expect(isConversionPending(status)).toBe(true);
    for (const status of settled) expect(isConversionPending(status)).toBe(false);
  });

  it('quarantines only a version that failed twice', () => {
    expect(isQuarantined({ status: 'failed', failureCount: 2 })).toBe(true);
    expect(isQuarantined({ status: 'failed', failureCount: 1 })).toBe(false);
    expect(isQuarantined({ status: 'ready', failureCount: 2 })).toBe(false);
  });

  it('has a label for every status', () => {
    const statuses: DesignModelVersionStatus[] = [
      'uploading',
      'queued',
      'converting',
      'ready',
      'failed',
    ];
    for (const status of statuses) {
      expect(VERSION_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe('sendDesignModelVersionParts', () => {
  const handle: UploadHandle = {
    versionId: 'version-1',
    partSizeBytes: 4,
    partCount: 3,
    sizeBytes: 10,
  };
  const file = new File([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])], 'bridge.ifc');
  const completedVersion = { id: 'version-1', status: 'queued' };

  beforeEach(() => {
    apiFetchMock.mockReset();
    authFetchMock.mockReset();
  });

  function mockReceived(received: number[]) {
    apiFetchMock.mockResolvedValueOnce({ received });
  }

  it('sends every part for a fresh upload, then completes', async () => {
    mockReceived([]);
    authFetchMock.mockResolvedValue(
      new Response(JSON.stringify(completedVersion), { status: 200 }),
    );

    const progress: [number, number][] = [];
    const version = await sendDesignModelVersionParts(
      'project-1',
      'model-1',
      handle,
      file,
      (done, total) => progress.push([done, total]),
    );

    expect(version).toEqual(completedVersion);
    // 3 part PUTs + 1 complete POST
    expect(authFetchMock).toHaveBeenCalledTimes(4);
    const partCalls = authFetchMock.mock.calls.slice(0, 3);
    partCalls.forEach(([path, options], index) => {
      expect(path).toBe(`/api/projects/project-1/models/model-1/versions/version-1/parts/${index}`);
      expect(options?.method).toBe('PUT');
      const sent = (options?.body as FormData).get('file') as File;
      expect(sent.size).toBe(index === 2 ? 2 : 4);
    });
    const [completePath, completeOptions] = authFetchMock.mock.calls[3];
    expect(completePath).toBe('/api/projects/project-1/models/model-1/versions/version-1/complete');
    expect(completeOptions?.method).toBe('POST');
    expect(progress).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('resumes from the server-reported received list', async () => {
    mockReceived([0, 2]);
    authFetchMock.mockResolvedValue(
      new Response(JSON.stringify(completedVersion), { status: 200 }),
    );

    const progress: [number, number][] = [];
    await sendDesignModelVersionParts('project-1', 'model-1', handle, file, (done, total) =>
      progress.push([done, total]),
    );

    // Only the missing part 1 is re-sent before completing.
    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(authFetchMock.mock.calls[0][0]).toBe(
      '/api/projects/project-1/models/model-1/versions/version-1/parts/1',
    );
    expect(progress).toEqual([
      [2, 3],
      [3, 3],
    ]);
  });

  it('throws an ApiError carrying the server message when a part is rejected', async () => {
    mockReceived([]);
    authFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'wrong size' } }), { status: 400 }),
    );

    await expect(
      sendDesignModelVersionParts('project-1', 'model-1', handle, file),
    ).rejects.toMatchObject({ name: 'ApiError', status: 400 });
    // Failed on the first part — complete is never attempted.
    expect(authFetchMock).toHaveBeenCalledTimes(1);
  });
});
