import { describe, expect, it } from 'vitest';

import { DEFAULT_NOTIFICATION_PREFERENCES, ROLE_OPTIONS } from './types';

describe('project settings notification defaults', () => {
  it('matches the backend default that daily diary reminders stay enabled unless explicitly disabled', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.dailyDiaryReminders).toBe(true);
  });
});

describe('project settings role options', () => {
  it('includes the backend-supported site manager role', () => {
    expect(ROLE_OPTIONS).toContainEqual({ value: 'site_manager', label: 'Site Manager' });
  });
});
