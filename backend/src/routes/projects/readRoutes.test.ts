import { describe, expect, it } from 'vitest';

import { buildProjectBrandingResponse } from './readRoutes.js';

describe('buildProjectBrandingResponse', () => {
  const company = {
    id: 'company-1',
    name: 'Ryox Civil Pty Ltd',
    abn: '12 345 678 901',
    address: '1 Haul Rd, Sydney NSW',
    logoUrl: 'https://example.test/logo.png',
  };

  it('returns the full company block with the embedded logo when available', () => {
    expect(buildProjectBrandingResponse(company, 'data:image/png;base64,AAA')).toEqual({
      company: {
        name: 'Ryox Civil Pty Ltd',
        abn: '12 345 678 901',
        address: '1 Haul Rd, Sydney NSW',
        logoUrl: 'data:image/png;base64,AAA',
      },
    });
  });

  it('falls back to the display URL when no embedded logo could be built', () => {
    // Supabase is unconfigured in unit tests, so the display URL passes through.
    expect(buildProjectBrandingResponse(company, null)).toEqual({
      company: {
        name: 'Ryox Civil Pty Ltd',
        abn: '12 345 678 901',
        address: '1 Haul Rd, Sydney NSW',
        logoUrl: 'https://example.test/logo.png',
      },
    });
  });

  it('preserves null ABN/address/logo and a missing company', () => {
    expect(
      buildProjectBrandingResponse({ ...company, abn: null, address: null, logoUrl: null }, null),
    ).toEqual({
      company: {
        name: 'Ryox Civil Pty Ltd',
        abn: null,
        address: null,
        logoUrl: null,
      },
    });
    expect(buildProjectBrandingResponse(null, null)).toEqual({ company: null });
  });
});
