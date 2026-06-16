import { type ReactNode, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentUpload } from './useDocumentUpload';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeImageFile(name: string) {
  return new File(['image-bytes'], name, { type: 'image/png' });
}

function makeChangeEvent(files: File[]) {
  return {
    target: {
      files,
    },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const OriginalImage = window.Image;

let previewCount = 0;
let createObjectURLMock: ReturnType<typeof vi.fn<(blob: Blob | MediaSource) => string>>;
let revokeObjectURLMock: ReturnType<typeof vi.fn<(url: string) => void>>;

class NonLoadingImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
}

describe('useDocumentUpload preview URL cleanup', () => {
  beforeEach(() => {
    previewCount = 0;
    createObjectURLMock = vi.fn(() => `blob:document-preview-${++previewCount}`);
    revokeObjectURLMock = vi.fn();
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;
    window.Image = NonLoadingImage as unknown as typeof Image;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    window.Image = OriginalImage;
    vi.restoreAllMocks();
  });

  it('revokes the pending image dimension URL when the selected image is replaced', () => {
    const { result } = renderHook(() => useDocumentUpload('project-1'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleFileSelect(makeChangeEvent([makeImageFile('first.png')]));
    });
    act(() => {
      result.current.handleFileSelect(makeChangeEvent([makeImageFile('second.png')]));
    });

    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:document-preview-1');
  });

  it('revokes the pending image dimension URL when the upload modal closes', () => {
    const { result } = renderHook(() => useDocumentUpload('project-1'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleFileSelect(makeChangeEvent([makeImageFile('plan.png')]));
    });
    act(() => {
      result.current.closeUploadModal();
    });

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:document-preview-1');
  });

  it('revokes the pending image dimension URL on unmount', () => {
    const { result, unmount } = renderHook(() => useDocumentUpload('project-1'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleFileSelect(makeChangeEvent([makeImageFile('photo.png')]));
    });

    unmount();

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:document-preview-1');
  });
});
