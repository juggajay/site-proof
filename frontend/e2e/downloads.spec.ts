import { test, expect } from '@playwright/test';
import { sanitizeDownloadFilename } from '../src/lib/downloads';

test.describe('download filename utilities', () => {
  test('removes path traversal and invalid filename characters', () => {
    expect(sanitizeDownloadFilename('..\\unsafe:document?.pdf', 'document.pdf')).toBe(
      'unsafe-document-.pdf',
    );
    expect(sanitizeDownloadFilename('report<>:"/\\|?*.pdf', 'document.pdf')).toBe(
      'report---------.pdf',
    );
  });

  test('uses safe fallbacks and avoids reserved Windows device names', () => {
    expect(sanitizeDownloadFilename('', 'document.pdf')).toBe('document.pdf');
    expect(sanitizeDownloadFilename('CON', 'document.pdf')).toBe('_CON');
    expect(sanitizeDownloadFilename('LPT1.txt', 'document.pdf')).toBe('_LPT1.txt');
  });

  test('keeps very long names bounded while preserving a short extension', () => {
    const filename = sanitizeDownloadFilename(`${'a'.repeat(220)}.pdf`, 'document.pdf');

    expect(filename).toHaveLength(180);
    expect(filename.endsWith('.pdf')).toBe(true);
  });
});
