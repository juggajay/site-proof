import { describe, expect, it } from 'vitest';
import { formatDocketDate, formatDocketNumber, formatDocketUserName } from './formatting.js';

describe('dockets formatting helpers (pure)', () => {
  describe('formatDocketNumber', () => {
    it('prefixes DKT- and uppercases the first six id characters', () => {
      expect(formatDocketNumber('a1b2c3d4e5')).toBe('DKT-A1B2C3');
      expect(formatDocketNumber('abcdefghij')).toBe('DKT-ABCDEF');
    });

    it('leaves already-uppercase ids unchanged beyond slicing', () => {
      expect(formatDocketNumber('ABCDEF123456')).toBe('DKT-ABCDEF');
    });

    it('handles ids shorter than six characters (slice returns the whole string)', () => {
      expect(formatDocketNumber('ab')).toBe('DKT-AB');
      expect(formatDocketNumber('')).toBe('DKT-');
    });

    it('matches the original inline expression for a realistic uuid', () => {
      const id = '7f3a9c1e-1234-4abc-9def-0123456789ab';
      expect(formatDocketNumber(id)).toBe(`DKT-${id.slice(0, 6).toUpperCase()}`);
    });
  });

  describe('formatDocketDate', () => {
    it('returns the UTC YYYY-MM-DD date key (time component dropped)', () => {
      expect(formatDocketDate(new Date('2026-01-15T10:30:00.000Z'))).toBe('2026-01-15');
      expect(formatDocketDate(new Date('2026-12-31T23:59:59.999Z'))).toBe('2026-12-31');
    });

    it('uses UTC, so the key is stable regardless of local timezone', () => {
      const date = new Date('2026-03-09T23:59:59.999Z');
      expect(formatDocketDate(date)).toBe(date.toISOString().split('T')[0]);
      expect(formatDocketDate(date)).toBe('2026-03-09');
    });
  });

  describe('formatDocketUserName', () => {
    it('returns the full name when present', () => {
      expect(formatDocketUserName({ fullName: 'Jane Doe', email: 'jane@example.com' })).toBe(
        'Jane Doe',
      );
    });

    it('falls back to email when full name is null or empty (matching || semantics)', () => {
      expect(formatDocketUserName({ fullName: null, email: 'jane@example.com' })).toBe(
        'jane@example.com',
      );
      expect(formatDocketUserName({ fullName: '', email: 'jane@example.com' })).toBe(
        'jane@example.com',
      );
    });

    it('treats a whitespace-only name as truthy and returns it unchanged (no trimming)', () => {
      expect(formatDocketUserName({ fullName: '   ', email: 'jane@example.com' })).toBe('   ');
    });
  });
});
