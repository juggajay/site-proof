// The hook owns the whole copy-link workflow (URL construction, async
// clipboard write, legacy textarea/execCommand fallback, toast, 2-second
// linkCopied reset). It touches no router or TanStack Query, so renderHook
// needs no provider wrapper; we mock only the IO boundaries — the toast
// surface and the browser clipboard/execCommand APIs — and pin the exact URL
// format, toast wording, fallback DOM dance, and reset timing the page
// previously had inline.
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toast } from '@/components/ui/toaster';
import { useLotLinkCopy } from './useLotLinkCopy';

const toastMock = vi.mocked(toast);

function stubClipboardWriteText(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(document, 'execCommand');
});

describe('useLotLinkCopy', () => {
  it('copies the encoded lot URL via the clipboard API, toasts, and resets after 2 seconds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboardWriteText(writeText);

    const { result } = renderHook(() => useLotLinkCopy({ projectId: 'proj 1', lotId: 'lot/2' }));
    expect(result.current.linkCopied).toBe(false);

    await act(async () => {
      await result.current.copyLotLink();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/projects/proj%201/lots/lot%2F2`,
    );
    expect(result.current.linkCopied).toBe(true);
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Link copied!',
      description: 'The lot link has been copied to your clipboard.',
    });

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(result.current.linkCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.linkCopied).toBe(false);
  });

  it('builds the URL with empty segments when route params are missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboardWriteText(writeText);

    const { result } = renderHook(() => useLotLinkCopy({ projectId: undefined, lotId: undefined }));

    await act(async () => {
      await result.current.copyLotLink();
    });

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/projects//lots/`);
  });

  it('falls back to the textarea + execCommand copy when the clipboard API fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'));
    stubClipboardWriteText(writeText);
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;

    const { result } = renderHook(() => useLotLinkCopy({ projectId: 'p-1', lotId: 'l-1' }));

    // Spy after renderHook so the only body mutations we capture are the
    // fallback textarea being attached and removed.
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    await act(async () => {
      await result.current.copyLotLink();
    });

    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith('copy');

    const appended = appendSpy.mock.calls
      .map(([node]) => node)
      .find((node): node is HTMLTextAreaElement => node instanceof HTMLTextAreaElement);
    expect(appended).toBeDefined();
    expect(appended!.value).toBe(`${window.location.origin}/projects/p-1/lots/l-1`);
    expect(removeSpy).toHaveBeenCalledWith(appended);
    expect(document.body.querySelector('textarea')).toBeNull();

    expect(result.current.linkCopied).toBe(true);
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Link copied!',
      description: 'The lot link has been copied to your clipboard.',
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.linkCopied).toBe(false);
  });
});
