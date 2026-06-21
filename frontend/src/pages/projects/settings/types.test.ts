import { describe, expect, it } from 'vitest';

import { DEFAULT_NOTIFICATION_PREFERENCES } from './types';

describe('project settings notification defaults', () => {
  it('matches the backend default that daily diary reminders stay enabled unless explicitly disabled', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.dailyDiaryReminders).toBe(true);
  });
});
