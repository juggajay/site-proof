import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { compressImage, compressImageForUpload, fileToDataUrl } from './offlinePhotoCompression';

describe('fileToDataUrl', () => {
  it('converts a file to a base64 data URL', async () => {
    const dataUrl = await fileToDataUrl(new File(['hello'], 'note.txt', { type: 'text/plain' }));

    expect(dataUrl).toBe('data:text/plain;base64,aGVsbG8=');
  });
});

describe('compressImage', () => {
  it('preserves small files without resizing', async () => {
    const file = new File(['small'], 'small.jpg', { type: 'image/jpeg' });

    const result = await compressImage(file);

    expect(result).toEqual({
      dataUrl: 'data:image/jpeg;base64,c21hbGw=',
      originalSize: file.size,
      compressedSize: file.size,
    });
  });

  it('preserves non-image files without resizing', async () => {
    const file = new File(['pdf-ish'], 'document.pdf', { type: 'application/pdf' });

    const result = await compressImage(file);

    expect(result).toEqual({
      dataUrl: 'data:application/pdf;base64,cGRmLWlzaA==',
      originalSize: file.size,
      compressedSize: file.size,
    });
  });
});

// jsdom has no real canvas, so mock the browser image/canvas boundary the way
// the online upload path uses it: an <img> that "loads" at a large resolution
// and a canvas that yields a small re-encoded blob.
describe('compressImageForUpload', () => {
  const oversizedImage = () =>
    new File([new Uint8Array(3 * 1024 * 1024)], 'phone-photo.jpg', { type: 'image/jpeg' });

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;

  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 4032; // larger than the 1920x1080 cap so the resize branch runs
      height = 3024;
      set src(_value: string) {
        Promise.resolve().then(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    // Re-encode to a small JPEG blob (~120KB) — well under the 500KB target.
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => {
      cb(new Blob([new Uint8Array(120 * 1024)], { type: 'image/jpeg' }));
    }) as typeof HTMLCanvasElement.prototype.toBlob;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    vi.unstubAllGlobals();
  });

  it('shrinks an oversized image below the 500KB target and keeps it an image', async () => {
    const original = oversizedImage();

    const result = await compressImageForUpload(original);

    expect(result).not.toBe(original);
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('phone-photo.jpg');
    expect(result.size).toBeLessThan(original.size);
    expect(result.size).toBeLessThanOrEqual(500 * 1024);
  });

  it('passes a non-image file through untouched (same reference)', async () => {
    const pdf = new File([new Uint8Array(2 * 1024 * 1024)], 'report.pdf', {
      type: 'application/pdf',
    });

    const result = await compressImageForUpload(pdf);

    expect(result).toBe(pdf);
  });

  it('falls back to the original file when compression throws', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      throw new Error('no canvas in this environment');
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const original = oversizedImage();

    const result = await compressImageForUpload(original);

    expect(result).toBe(original);
  });
});
