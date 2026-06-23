import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROJECT_TIME_ZONE,
  projectTimeZoneFromState,
  zonedWallClockToUtc,
} from './projectTimeZone.js';

describe('projectTimeZoneFromState', () => {
  it('maps each Australian state/territory to its IANA timezone', () => {
    expect(projectTimeZoneFromState('WA')).toBe('Australia/Perth');
    expect(projectTimeZoneFromState('SA')).toBe('Australia/Adelaide');
    expect(projectTimeZoneFromState('NT')).toBe('Australia/Darwin');
    expect(projectTimeZoneFromState('QLD')).toBe('Australia/Brisbane');
    expect(projectTimeZoneFromState('NSW')).toBe('Australia/Sydney');
    expect(projectTimeZoneFromState('VIC')).toBe('Australia/Sydney');
    expect(projectTimeZoneFromState('ACT')).toBe('Australia/Sydney');
    expect(projectTimeZoneFromState('TAS')).toBe('Australia/Sydney');
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(projectTimeZoneFromState(' qld ')).toBe('Australia/Brisbane');
    expect(projectTimeZoneFromState('wa')).toBe('Australia/Perth');
  });

  it('falls back to the default zone for null/empty/unknown states', () => {
    expect(projectTimeZoneFromState(null)).toBe(DEFAULT_PROJECT_TIME_ZONE);
    expect(projectTimeZoneFromState(undefined)).toBe(DEFAULT_PROJECT_TIME_ZONE);
    expect(projectTimeZoneFromState('')).toBe(DEFAULT_PROJECT_TIME_ZONE);
    expect(projectTimeZoneFromState('Atlantis')).toBe(DEFAULT_PROJECT_TIME_ZONE);
    expect(DEFAULT_PROJECT_TIME_ZONE).toBe('Australia/Sydney');
  });
});

describe('zonedWallClockToUtc', () => {
  it('interprets the wall clock in a non-DST zone (Brisbane, UTC+10)', () => {
    // 14:30 in Brisbane (no DST) is 04:30 UTC, independent of the server clock.
    expect(zonedWallClockToUtc(2026, 3, 15, 14, 30, 'Australia/Brisbane').toISOString()).toBe(
      '2026-03-15T04:30:00.000Z',
    );
  });

  it('interprets the wall clock in Perth (UTC+8)', () => {
    expect(zonedWallClockToUtc(2026, 6, 15, 8, 0, 'Australia/Perth').toISOString()).toBe(
      '2026-06-15T00:00:00.000Z',
    );
  });

  it('applies AEDT summer-time offset (Sydney, UTC+11 in January)', () => {
    expect(zonedWallClockToUtc(2026, 1, 15, 12, 0, 'Australia/Sydney').toISOString()).toBe(
      '2026-01-15T01:00:00.000Z',
    );
  });

  it('applies AEST standard-time offset (Sydney, UTC+10 in June)', () => {
    expect(zonedWallClockToUtc(2026, 6, 15, 12, 0, 'Australia/Sydney').toISOString()).toBe(
      '2026-06-15T02:00:00.000Z',
    );
  });

  it('rolls midnight back across the UTC date boundary', () => {
    // Midnight in Brisbane (UTC+10) is 14:00 the previous day in UTC.
    expect(zonedWallClockToUtc(2026, 3, 15, 0, 0, 'Australia/Brisbane').toISOString()).toBe(
      '2026-03-14T14:00:00.000Z',
    );
  });
});
