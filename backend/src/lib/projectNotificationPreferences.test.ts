import { describe, expect, it } from 'vitest';
import {
  isProjectNotificationEnabled,
  type ProjectNotificationPreferenceKey,
} from './projectNotificationPreferences.js';

const KEYS: ProjectNotificationPreferenceKey[] = [
  'holdPointReleases',
  'ncrAssignments',
  'testResults',
  'dailyDiaryReminders',
];

describe('isProjectNotificationEnabled', () => {
  it('defaults to enabled when settings is null or undefined', () => {
    for (const key of KEYS) {
      expect(isProjectNotificationEnabled(null, key)).toBe(true);
      expect(isProjectNotificationEnabled(undefined, key)).toBe(true);
    }
  });

  it('defaults to enabled when settings has no notificationPreferences object', () => {
    expect(isProjectNotificationEnabled('{}', 'holdPointReleases')).toBe(true);
    expect(
      isProjectNotificationEnabled(JSON.stringify({ hpApprovalRequirement: 'any' }), 'testResults'),
    ).toBe(true);
  });

  it('defaults to enabled when the specific key is missing', () => {
    const settings = JSON.stringify({
      notificationPreferences: { ncrAssignments: false },
    });
    // Different key not present -> still enabled.
    expect(isProjectNotificationEnabled(settings, 'holdPointReleases')).toBe(true);
    // The key that is present and false -> disabled.
    expect(isProjectNotificationEnabled(settings, 'ncrAssignments')).toBe(false);
  });

  it('returns false only when the key is explicitly false', () => {
    for (const key of KEYS) {
      const settings = JSON.stringify({ notificationPreferences: { [key]: false } });
      expect(isProjectNotificationEnabled(settings, key)).toBe(false);
    }
  });

  it('returns true when the key is explicitly true', () => {
    for (const key of KEYS) {
      const settings = JSON.stringify({ notificationPreferences: { [key]: true } });
      expect(isProjectNotificationEnabled(settings, key)).toBe(true);
    }
  });

  it('treats non-false truthy/other values as enabled (only an explicit false suppresses)', () => {
    // Defensive: a corrupted/legacy non-boolean value should not suppress.
    const settings = JSON.stringify({
      notificationPreferences: { holdPointReleases: 'no', testResults: 0, ncrAssignments: null },
    });
    expect(isProjectNotificationEnabled(settings, 'holdPointReleases')).toBe(true);
    expect(isProjectNotificationEnabled(settings, 'testResults')).toBe(true);
    expect(isProjectNotificationEnabled(settings, 'ncrAssignments')).toBe(true);
  });

  it('defaults to enabled when settings JSON is malformed', () => {
    expect(isProjectNotificationEnabled('{ not valid json', 'holdPointReleases')).toBe(true);
    expect(isProjectNotificationEnabled('null', 'testResults')).toBe(true);
    expect(isProjectNotificationEnabled('"a string"', 'ncrAssignments')).toBe(true);
    expect(isProjectNotificationEnabled('[1,2,3]', 'dailyDiaryReminders')).toBe(true);
  });

  it('accepts an already-parsed settings object', () => {
    expect(
      isProjectNotificationEnabled(
        { notificationPreferences: { holdPointReleases: false } },
        'holdPointReleases',
      ),
    ).toBe(false);
    expect(isProjectNotificationEnabled({ notificationPreferences: {} }, 'holdPointReleases')).toBe(
      true,
    );
    expect(isProjectNotificationEnabled({}, 'holdPointReleases')).toBe(true);
  });
});
