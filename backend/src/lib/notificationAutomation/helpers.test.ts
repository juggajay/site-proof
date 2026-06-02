import { afterEach, describe, expect, it } from 'vitest';
import {
  appendQueryParams,
  buildProjectEntityLink,
  formatDateKey,
  getPreviousWorkingDay,
  isDueForProjectTime,
  isWorkingDay,
  parsePositiveInteger,
  parseTimeOfDay,
} from './helpers.js';
import {
  DEFAULT_EMAIL_PREFERENCES,
  getNotificationTiming,
  isNotificationTypeEnabled,
  normalizeBoolean,
  normalizeEmailPreferences,
  validateTiming,
} from './preferences.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('notification automation helpers', () => {
  it('parses positive integers with the existing fallback semantics', () => {
    expect(parsePositiveInteger(5, 10)).toBe(5);
    expect(parsePositiveInteger('6', 10)).toBe(6);
    expect(parsePositiveInteger(0, 10)).toBe(10);
    expect(parsePositiveInteger('1.5', 10)).toBe(10);
    expect(parsePositiveInteger('not-a-number', 10)).toBe(10);
  });

  it('parses reminder times and applies project/env due-time semantics', () => {
    expect(parseTimeOfDay('06:30')).toEqual({ hours: 6, minutes: 30 });
    expect(parseTimeOfDay('bad')).toEqual({ hours: 17, minutes: 0 });

    const now = new Date(2026, 4, 12, 16, 45, 0, 0);
    expect(isDueForProjectTime(now, '16:30')).toBe(true);
    expect(isDueForProjectTime(now, '17:00')).toBe(false);

    process.env.DIARY_REMINDER_TIME_OF_DAY = '16:00';
    expect(isDueForProjectTime(now, '17:00')).toBe(true);
  });

  it('keeps working-day date logic stable', () => {
    const monday = new Date(2026, 4, 11, 12, 0, 0, 0);
    const sunday = new Date(2026, 4, 10, 12, 0, 0, 0);
    const previousWorkingDay = getPreviousWorkingDay(monday, '1,2,3,4,5');

    expect(isWorkingDay({ workingDays: '1,2,3,4,5' }, monday)).toBe(true);
    expect(isWorkingDay({ workingDays: '1,2,3,4,5' }, sunday)).toBe(false);
    expect(previousWorkingDay.getDay()).toBe(5);
    expect(previousWorkingDay.getHours()).toBe(0);
    expect(formatDateKey(new Date(Date.UTC(2026, 4, 8, 12, 0, 0, 0)))).toBe('2026-05-08');
  });

  it('builds notification links with existing paths, encoding, and query filtering', () => {
    expect(appendQueryParams('/notifications', { status: 'active', q: '', type: undefined })).toBe(
      '/notifications?status=active',
    );
    expect(buildProjectEntityLink('lot', 'lot/1 a', 'proj/A')).toBe(
      '/projects/proj%2FA/lots/lot%2F1%20a',
    );
    expect(buildProjectEntityLink('ncr', 'n 1&2', 'p1', { source: 'email' })).toBe(
      '/projects/p1/ncr?ncr=n+1%262&source=email',
    );
    expect(buildProjectEntityLink('Daily Docket', 'dk1', 'p1')).toBe(
      '/projects/p1/dockets?docket=dk1',
    );
    expect(buildProjectEntityLink('mystery', 'x', null)).toBe('/dashboard');
  });
});

describe('notification automation preference helpers', () => {
  it('normalizes booleans and timing values with existing defaults', () => {
    expect(normalizeBoolean(false, true)).toBe(false);
    expect(normalizeBoolean('false', true)).toBe(true);
    expect(validateTiming('digest', 'immediate')).toBe('digest');
    expect(validateTiming('weekly', 'immediate')).toBe('immediate');

    expect(normalizeEmailPreferences(null)).toEqual(DEFAULT_EMAIL_PREFERENCES);
    expect(
      normalizeEmailPreferences({
        enabled: false,
        dailyDigest: true,
        mentionsTiming: 'digest',
        ncrAssignedTiming: 99,
      }),
    ).toEqual({
      ...DEFAULT_EMAIL_PREFERENCES,
      enabled: false,
      dailyDigest: true,
      mentionsTiming: 'digest',
    });
  });

  it('maps notification type enablement and timing to the existing preference fields', () => {
    const preferences = normalizeEmailPreferences({
      holdPointRelease: false,
      diaryReminderTiming: 'digest',
    });

    expect(isNotificationTypeEnabled(preferences, 'holdPointRelease')).toBe(false);
    expect(isNotificationTypeEnabled(preferences, 'diaryReminder')).toBe(true);
    expect(getNotificationTiming(preferences, 'diaryReminder')).toBe('digest');
    expect(getNotificationTiming(preferences, 'holdPointRelease')).toBe('immediate');
  });
});
