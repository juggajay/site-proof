import { describe, expect, it } from 'vitest';
import { buildCompanyLogoStorageFilename, shouldRemovePreviousLogoOnPatch } from './logoStorage.js';

describe('company logo storage helpers', () => {
  it('builds owned logo filenames only for supported image mime types', () => {
    expect(buildCompanyLogoStorageFilename('company-1', 'image/png')).toMatch(
      /^company-logo-company-1-[0-9a-f-]+\.png$/,
    );
    expect(buildCompanyLogoStorageFilename('company-1', 'text/plain')).toBeNull();
  });

  it('does not remove a missing previous logo', () => {
    expect(shouldRemovePreviousLogoOnPatch(null, '/uploads/company-logos/logo.png')).toBe(false);
  });

  it('falls back to raw URL comparison for local and external logos', () => {
    expect(
      shouldRemovePreviousLogoOnPatch(
        '/uploads/company-logos/company-logo-company-1-old.png',
        '/uploads/company-logos/company-logo-company-1-new.png',
      ),
    ).toBe(true);
    expect(
      shouldRemovePreviousLogoOnPatch(
        'https://cdn.example/logo.png',
        'https://cdn.example/logo.png',
      ),
    ).toBe(false);
    expect(
      shouldRemovePreviousLogoOnPatch(
        'https://cdn.example/logo-old.png',
        'https://cdn.example/logo-new.png',
      ),
    ).toBe(true);
  });
});
