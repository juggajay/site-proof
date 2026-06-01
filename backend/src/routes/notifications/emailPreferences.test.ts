import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMAIL_PREFERENCES,
  normalizeBoolean,
  normalizeEmailPreferences,
  toEmailPreferences,
  validateTiming,
} from './emailPreferences.js';

/**
 * Characterizes the pure notification email-preference helpers extracted verbatim
 * from backend/src/routes/notifications.ts. These freeze the exact default
 * preference values, the invalid-timing fallback, boolean normalization
 * (including that an explicit `false` is preserved, not replaced by a `true`
 * default), and the record/null mapping. The DB-backed getEmailPreferences /
 * saveEmailPreferences wrappers are intentionally left to the route/integration
 * tests — no real database is used here.
 */

// The exact default shape, asserted as a literal so the defaults are truly frozen
// (not tautologically compared against the imported constant).
const EXPECTED_DEFAULTS = {
  enabled: true,
  mentions: true,
  mentionsTiming: 'immediate',
  ncrAssigned: true,
  ncrAssignedTiming: 'immediate',
  ncrStatusChange: true,
  ncrStatusChangeTiming: 'immediate',
  holdPointReminder: true,
  holdPointReminderTiming: 'immediate',
  holdPointRelease: true,
  holdPointReleaseTiming: 'immediate',
  commentReply: true,
  commentReplyTiming: 'immediate',
  scheduledReports: true,
  scheduledReportsTiming: 'immediate',
  dailyDigest: false,
  diaryReminder: true,
  diaryReminderTiming: 'immediate',
};

describe('DEFAULT_EMAIL_PREFERENCES', () => {
  it('pins the exact default preference values', () => {
    expect(DEFAULT_EMAIL_PREFERENCES).toEqual(EXPECTED_DEFAULTS);
  });
});

describe('validateTiming', () => {
  it('accepts the two valid timing values', () => {
    expect(validateTiming('immediate', 'digest')).toBe('immediate');
    expect(validateTiming('digest', 'immediate')).toBe('digest');
  });

  it('falls back to the provided default for any invalid value', () => {
    expect(validateTiming('weekly', 'immediate')).toBe('immediate');
    expect(validateTiming('weekly', 'digest')).toBe('digest');
    expect(validateTiming(undefined, 'immediate')).toBe('immediate');
    expect(validateTiming(null, 'digest')).toBe('digest');
    expect(validateTiming(123, 'immediate')).toBe('immediate');
    expect(validateTiming('', 'digest')).toBe('digest');
  });
});

describe('normalizeBoolean', () => {
  it('returns the value when it is a real boolean', () => {
    expect(normalizeBoolean(true, false)).toBe(true);
    expect(normalizeBoolean(false, true)).toBe(false);
  });

  it('falls back to the default for non-boolean values (incl. falsy non-booleans)', () => {
    expect(normalizeBoolean(undefined, true)).toBe(true);
    expect(normalizeBoolean(null, false)).toBe(false);
    expect(normalizeBoolean('yes', false)).toBe(false);
    expect(normalizeBoolean(0, true)).toBe(true);
    expect(normalizeBoolean(1, false)).toBe(false);
    expect(normalizeBoolean('', true)).toBe(true);
  });
});

describe('normalizeEmailPreferences', () => {
  it('returns the full defaults for empty / non-object / nullish input', () => {
    expect(normalizeEmailPreferences({})).toEqual(EXPECTED_DEFAULTS);
    expect(normalizeEmailPreferences(null)).toEqual(EXPECTED_DEFAULTS);
    expect(normalizeEmailPreferences(undefined)).toEqual(EXPECTED_DEFAULTS);
    expect(normalizeEmailPreferences('not an object')).toEqual(EXPECTED_DEFAULTS);
    expect(normalizeEmailPreferences(42)).toEqual(EXPECTED_DEFAULTS);
  });

  it('falls back to the default timing when a timing field is invalid', () => {
    expect(normalizeEmailPreferences({ mentionsTiming: 'weekly' }).mentionsTiming).toBe(
      'immediate',
    );
    expect(normalizeEmailPreferences({ ncrAssignedTiming: 99 }).ncrAssignedTiming).toBe(
      'immediate',
    );
  });

  it('honours a valid non-default timing override', () => {
    expect(normalizeEmailPreferences({ mentionsTiming: 'digest' }).mentionsTiming).toBe('digest');
  });

  it('preserves explicit false boolean values instead of applying the true default', () => {
    const result = normalizeEmailPreferences({
      enabled: false,
      mentions: false,
      ncrAssigned: false,
      diaryReminder: false,
    });
    expect(result.enabled).toBe(false);
    expect(result.mentions).toBe(false);
    expect(result.ncrAssigned).toBe(false);
    expect(result.diaryReminder).toBe(false);
  });

  it('preserves explicit true for a field whose default is false (dailyDigest)', () => {
    expect(normalizeEmailPreferences({ dailyDigest: true }).dailyDigest).toBe(true);
  });

  it('merges a partial input over the defaults', () => {
    expect(
      normalizeEmailPreferences({ enabled: false, dailyDigest: true, mentionsTiming: 'digest' }),
    ).toEqual({
      ...EXPECTED_DEFAULTS,
      enabled: false,
      dailyDigest: true,
      mentionsTiming: 'digest',
    });
  });
});

describe('toEmailPreferences', () => {
  it('returns a fresh copy of the defaults for a null record', () => {
    const result = toEmailPreferences(null);
    expect(result).toEqual(EXPECTED_DEFAULTS);
    // Must be a copy, not the shared constant — mutating it cannot corrupt defaults.
    expect(result).not.toBe(DEFAULT_EMAIL_PREFERENCES);
    result.enabled = false;
    expect(DEFAULT_EMAIL_PREFERENCES.enabled).toBe(true);
  });

  it('normalizes a record-like object, keeping only the known preference keys', () => {
    const recordLike = {
      id: 'pref-1',
      userId: 'user-1',
      enabled: false,
      mentionsTiming: 'digest',
      extraneous: 'ignored',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const result = toEmailPreferences(
      recordLike as unknown as Parameters<typeof toEmailPreferences>[0],
    );

    expect(result.enabled).toBe(false);
    expect(result.mentionsTiming).toBe('digest');
    expect(result.mentions).toBe(true); // untouched default
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('extraneous');
    expect(result).not.toHaveProperty('createdAt');
    expect(Object.keys(result).sort()).toEqual(Object.keys(EXPECTED_DEFAULTS).sort());
  });
});
