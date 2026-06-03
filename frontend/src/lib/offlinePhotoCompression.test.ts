import { describe, expect, it } from 'vitest';

import { compressImage, fileToDataUrl } from './offlinePhotoCompression';

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
