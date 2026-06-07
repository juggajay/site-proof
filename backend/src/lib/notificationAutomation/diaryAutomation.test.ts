import { describe, expect, it, vi } from 'vitest';
import { processDueDiaryReminders, type DiaryAutomationDependencies } from './diaryAutomation.js';

// A Monday afternoon (getDay() === 1) so the project is in a working day and the
// reminder time has passed. 2026-06-08 is a Monday.
const NOW = new Date(2026, 5, 8, 18, 0, 0, 0);

type DiaryProject = {
  id: string;
  name: string;
  companyId: string;
  workingHoursEnd: string | null;
  workingDays: string | null;
  settings: string | null;
};

function buildDeps(
  project: DiaryProject,
  notifyUsers: DiaryAutomationDependencies['notifyUsers'],
): DiaryAutomationDependencies {
  return {
    prisma: {
      dailyDiary: {
        // No diary entry exists for the day -> a reminder is otherwise due.
        findFirst: vi.fn().mockResolvedValue(null),
      },
      notification: {
        // No prior reminder already sent for the day.
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as DiaryAutomationDependencies['prisma'],
    dayMs: 24 * 60 * 60 * 1000,
    diaryReminderRoles: ['foreman'],
    missingDiaryAlertRoles: ['project_manager'],
    findActiveProjects: vi.fn().mockResolvedValue([project]),
    findProjectUsersByRoles: vi
      .fn()
      .mockResolvedValue([{ id: 'user-1', email: 'foreman@example.com', fullName: 'Foreman' }]),
    notifyUsers,
  };
}

function baseProject(settings: string | null): DiaryProject {
  return {
    id: 'project-1',
    name: 'Test Project',
    companyId: 'company-1',
    workingHoursEnd: '17:00',
    workingDays: '1,2,3,4,5',
    settings,
  };
}

describe('processDueDiaryReminders project-level toggle', () => {
  it('sends reminders when settings are missing (default enabled)', async () => {
    const notifyUsers = vi.fn().mockResolvedValue({
      inAppCreated: 1,
      emailsSent: 1,
      emailsQueued: 0,
      emailsFailed: 0,
      usersNotified: 1,
    });
    const result = await processDueDiaryReminders(
      { now: NOW, projectIds: ['project-1'] },
      buildDeps(baseProject(null), notifyUsers),
    );

    expect(notifyUsers).toHaveBeenCalledTimes(1);
    expect(result.remindersCreated).toBe(1);
    expect(result.usersNotified).toBe(1);
    expect(result.skippedProjects).toBe(0);
  });

  it('sends reminders when the toggle is explicitly enabled', async () => {
    const notifyUsers = vi.fn().mockResolvedValue({
      inAppCreated: 1,
      emailsSent: 1,
      emailsQueued: 0,
      emailsFailed: 0,
      usersNotified: 1,
    });
    const settings = JSON.stringify({ notificationPreferences: { dailyDiaryReminders: true } });
    const result = await processDueDiaryReminders(
      { now: NOW, projectIds: ['project-1'] },
      buildDeps(baseProject(settings), notifyUsers),
    );

    expect(notifyUsers).toHaveBeenCalledTimes(1);
    expect(result.remindersCreated).toBe(1);
  });

  it('suppresses reminders for everyone when the toggle is off', async () => {
    const notifyUsers = vi.fn();
    const settings = JSON.stringify({ notificationPreferences: { dailyDiaryReminders: false } });
    const result = await processDueDiaryReminders(
      { now: NOW, projectIds: ['project-1'] },
      buildDeps(baseProject(settings), notifyUsers),
    );

    expect(notifyUsers).not.toHaveBeenCalled();
    expect(result.remindersCreated).toBe(0);
    expect(result.skippedProjects).toBe(1);
  });
});
