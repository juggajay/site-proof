import { describe, expect, it } from 'vitest';

import {
  MAP_DATA_URL,
  MAP_TILE_URL,
  PLAN_SHEET_IMAGE_URL,
  AUTHED_MAP_CACHES,
  MAP_TILES_CACHE,
  mapRuntimeCaching,
} from './pwaRuntimeCaching';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

describe('map tile pattern', () => {
  it('matches MapTiler satellite tiles (with API key query)', () => {
    expect(
      MAP_TILE_URL.test('https://api.maptiler.com/maps/satellite/15/29372/19468.jpg?key=abc123'),
    ).toBe(true);
  });

  it('matches all OSM tile subdomains', () => {
    for (const s of ['a', 'b', 'c']) {
      expect(MAP_TILE_URL.test(`https://${s}.tile.openstreetmap.org/15/29372/19468.png`)).toBe(
        true,
      );
    }
  });

  it('does not match other MapTiler services (geocoding etc.)', () => {
    expect(MAP_TILE_URL.test('https://api.maptiler.com/geocoding/query.json?key=abc')).toBe(false);
  });
});

describe('plan-sheet image pattern', () => {
  it('matches the sheet raster endpoint on any API origin', () => {
    for (const origin of ['https://api.civos.com.au', 'http://localhost:3001']) {
      expect(PLAN_SHEET_IMAGE_URL.test(`${origin}/api/projects/p-1/plan-sheets/s-1/image`)).toBe(
        true,
      );
    }
  });

  it('does not match general document downloads', () => {
    expect(PLAN_SHEET_IMAGE_URL.test('https://api.civos.com.au/api/documents/file/d-1')).toBe(
      false,
    );
  });
});

describe('map data pattern', () => {
  const origin = 'https://api.civos.com.au';

  it.each([
    '/api/projects/p-1/lot-geometries',
    '/api/projects/p-1/control-lines',
    '/api/projects/p-1/plan-sheets',
    '/api/projects/p-1/lots/status-timeline',
    '/api/lots/l-1/geometries',
  ])('matches %s', (path) => {
    expect(MAP_DATA_URL.test(`${origin}${path}`)).toBe(true);
  });

  it.each([
    '/api/auth/login',
    '/api/lots/l-1',
    '/api/documents/file/d-1',
    '/api/projects/p-1/spatial-search',
    '/api/projects/p-1/plan-sheets/s-1/image',
    '/api/projects/p-1/plan-sheets/s-1',
  ])('does not match %s', (path) => {
    expect(MAP_DATA_URL.test(`${origin}${path}`)).toBe(false);
  });
});

describe('licence and safety caps', () => {
  // MapTiler Cloud terms §5.7 allow only a TEMPORARY personal cache and §6.3
  // prohibit bulk download. Every rule must keep hard entry + age caps; this
  // test is the guard against someone "improving" offline support by removing
  // them or by adding a prefetch-style unlimited cache.
  it('every rule has bounded entries and age (30 days max)', () => {
    for (const rule of mapRuntimeCaching) {
      expect(rule.options.expiration.maxEntries).toBeGreaterThan(0);
      expect(rule.options.expiration.maxAgeSeconds).toBeGreaterThan(0);
      expect(rule.options.expiration.maxAgeSeconds).toBeLessThanOrEqual(THIRTY_DAYS_SECONDS);
      expect(rule.options.expiration.purgeOnQuotaError).toBe(true);
    }
  });

  it('only handles GET requests (draw-lot POST etc. must never be cached)', () => {
    for (const rule of mapRuntimeCaching) {
      expect((rule as { method?: string }).method ?? 'GET').toBe('GET');
    }
  });

  it('authed caches cover everything except public tiles', () => {
    const names = mapRuntimeCaching.map((rule) => rule.options.cacheName);
    for (const name of names) {
      if (name === MAP_TILES_CACHE) continue;
      expect(AUTHED_MAP_CACHES).toContain(name);
    }
  });
});
