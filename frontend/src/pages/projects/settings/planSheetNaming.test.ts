import { describe, expect, it } from 'vitest';

import { fileStem, pageSheetName } from './planSheetNaming';

describe('fileStem', () => {
  it('drops the extension', () => {
    expect(fileStem('C-101 Rev D.pdf')).toBe('C-101 Rev D');
    expect(fileStem('drawing.PNG')).toBe('drawing');
  });

  it('keeps names without an extension and dotfiles intact', () => {
    expect(fileStem('sitemap')).toBe('sitemap');
    expect(fileStem('.gitignore')).toBe('.gitignore');
  });
});

describe('pageSheetName', () => {
  it('keeps the base name for a single page', () => {
    expect(pageSheetName('C-101', 1, true)).toBe('C-101');
  });

  it('suffixes the page number when multiple pages are chosen', () => {
    expect(pageSheetName('C-101', 3, false)).toBe('C-101 — p3');
  });

  it('falls back to a placeholder base name', () => {
    expect(pageSheetName('   ', 2, false)).toBe('Plan sheet — p2');
  });
});
