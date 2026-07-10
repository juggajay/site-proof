import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSafeLocationPath } from './logger';

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
