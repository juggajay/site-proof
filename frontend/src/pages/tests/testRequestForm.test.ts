// The request-form download must go through the AUTHENTICATED fetch and land in
// a blob — a `window.open`/anchor navigation carries no bearer token and would
// 401 the user out of a document they can see.

import { afterEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.hoisted(() => vi.fn());
const downloadBlob = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, authFetch };
});
vi.mock('@/lib/downloads', () => ({ downloadBlob }));

import { downloadTestRequestForm, requestFormFilename } from './testRequestForm';

afterEach(() => {
  vi.clearAllMocks();
});

const TEST = { id: 'test-1', testType: 'compaction', testRequestNumber: 'TR-004' };

describe('downloadTestRequestForm', () => {
  it('fetches with the auth token and saves the blob — never navigates', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const blob = new Blob(['<html></html>'], { type: 'text/html' });
    authFetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });

    await downloadTestRequestForm(TEST);

    expect(authFetch).toHaveBeenCalledWith('/api/test-results/test-1/request-form');
    expect(downloadBlob).toHaveBeenCalledWith(
      blob,
      'test-request-TR-004-compaction.html',
      'test-request.html',
    );
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('surfaces a failed generation instead of saving an error page', async () => {
    authFetch.mockResolvedValue({ ok: false, blob: () => Promise.resolve(new Blob()) });

    await expect(downloadTestRequestForm(TEST)).rejects.toThrow(
      'Could not generate the lab request form.',
    );
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('falls back to a reference-free filename when the test has no request number', () => {
    expect(requestFormFilename('compaction', null)).toBe('test-request-compaction.html');
  });
});
