/**
 * Unit tests for useTimeGreeting.
 *
 * Tests the pure functions getGreetingPeriod and buildGreeting so the boundary
 * conditions are pinned without needing a React harness.
 *
 * Boundary spec (foreman profile §Design consequences):
 *   hour < 12  → morning
 *   12 ≤ hour < 17 → arvo
 *   hour ≥ 17  → evening
 */

import { describe, it, expect } from 'vitest';
import { getGreetingPeriod, buildGreeting, type GreetingPeriod } from '../hooks/useTimeGreeting';

describe('getGreetingPeriod — boundary conditions', () => {
  const cases: Array<[number, GreetingPeriod]> = [
    [0, 'morning'], // midnight
    [1, 'morning'],
    [6, 'morning'],
    [11, 'morning'], // 11:xx is still morning
    [12, 'arvo'], // noon boundary
    [13, 'arvo'],
    [16, 'arvo'], // 16:xx still arvo
    [17, 'evening'], // 17:00 boundary
    [18, 'evening'],
    [23, 'evening'], // 11pm
  ];

  it.each(cases)('hour %i → %s', (hour, expected) => {
    expect(getGreetingPeriod(hour)).toBe(expected);
  });
});

describe('buildGreeting', () => {
  it('uses "Morning" for hours < 12', () => {
    expect(buildGreeting('Jay Ryan', 9)).toBe('Morning, Jay');
  });

  it('uses "Arvo" for 12 ≤ hour < 17', () => {
    expect(buildGreeting('Jay Ryan', 14)).toBe('Arvo, Jay');
  });

  it('uses "Evening" for hour ≥ 17', () => {
    expect(buildGreeting('Jay Ryan', 20)).toBe('Evening, Jay');
  });

  it('uses only the first name from a multi-word full name', () => {
    expect(buildGreeting('John Michael Smith', 9)).toBe('Morning, John');
  });

  it('handles single-word names', () => {
    expect(buildGreeting('Jay', 9)).toBe('Morning, Jay');
  });

  it('omits the name part when fullName is undefined', () => {
    expect(buildGreeting(undefined, 9)).toBe('Morning');
  });

  it('omits the name part when fullName is null', () => {
    expect(buildGreeting(null, 14)).toBe('Arvo');
  });

  it('omits the name part when fullName is empty string', () => {
    expect(buildGreeting('', 17)).toBe('Evening');
  });

  it('trims leading/trailing whitespace from name', () => {
    expect(buildGreeting('  Jay ', 9)).toBe('Morning, Jay');
  });

  // Exact boundary: hour 11 is morning, hour 12 is arvo
  it('11:59 is morning', () => {
    expect(buildGreeting('Jay', 11)).toBe('Morning, Jay');
  });
  it('12:00 is arvo', () => {
    expect(buildGreeting('Jay', 12)).toBe('Arvo, Jay');
  });
  // Exact boundary: hour 16 is arvo, hour 17 is evening
  it('16:59 is arvo', () => {
    expect(buildGreeting('Jay', 16)).toBe('Arvo, Jay');
  });
  it('17:00 is evening', () => {
    expect(buildGreeting('Jay', 17)).toBe('Evening, Jay');
  });
});
