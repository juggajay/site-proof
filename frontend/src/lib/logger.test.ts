import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSafeLocationPath, redactUrl } from './logger';

function stubLocation(url: string) {
  vi.stubGlobal('window', { location: new URL(url) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSafeLocationPath', () => {
  it('redacts hold-point release tokens from the path segment', () => {
    const token = 'a'.repeat(64);

    stubLocation(`https://app.civos.com.au/hp-release/${token}`);
    expect(getSafeLocationPath()).toBe('/hp-release/[redacted]');

    stubLocation(`https://app.civos.com.au/hp-release/batch/${token}`);
    expect(getSafeLocationPath()).toBe('/hp-release/batch/[redacted]');
  });

  it('redacts query and hash wholesale while keeping non-token paths intact', () => {
    stubLocation('https://app.civos.com.au/lots/123?token=secret#frag');
    expect(getSafeLocationPath()).toBe('/lots/123?[redacted]#[redacted]');
  });
});

describe('redactUrl', () => {
  it('keeps the origin and path of an ordinary absolute url', () => {
    expect(redactUrl('https://api.civos.com.au/api/lots/42')).toBe(
      'https://api.civos.com.au/api/lots/42',
    );
  });

  it('drops the origin for a relative url', () => {
    expect(redactUrl('/api/lots/42')).toBe('/api/lots/42');
  });

  it('redacts capability tokens and every query value', () => {
    expect(redactUrl('/api/holdpoints/public/sha256:abc?next=/lots&sig=xyz')).toBe(
      '/api/holdpoints/public/[redacted]?next=[redacted]&sig=[redacted]',
    );
    expect(redactUrl('/invite/sub_invite_abc123')).toBe('/invite/[redacted]');
    expect(redactUrl('/auth/reset_abc123')).toBe('/auth/[redacted]');
  });

  it('redacts the hash and rejects non-http schemes', () => {
    expect(redactUrl('/lots/42#anchor')).toBe('/lots/42#[redacted]');
    expect(redactUrl('javascript:void(0)')).toBe('[redacted]');
    expect(redactUrl('data:text/html,<p>x</p>')).toBe('[redacted]');
  });
});
