/**
 * Project-level notification preference gate.
 *
 * The project settings screen (NotificationsTab) lets a head contractor turn
 * whole notification categories on or off for everyone on a project:
 *   - holdPointReleases   (Hold Point Releases)
 *   - ncrAssignments      (NCR Assignments)
 *   - testResults         (Test Results)
 *   - dailyDiaryReminders (Daily Diary Reminders)
 *
 * Those toggles are persisted into the project's JSON `settings` string at
 * `settings.notificationPreferences.<key>` (see the PATCH /api/projects/:id
 * blind merge). This helper is the single place senders read them.
 *
 * Default is ENABLED: a project that has never touched the toggles (no
 * settings, no notificationPreferences object, or a missing key) keeps sending
 * exactly as before. A category is only suppressed when the project explicitly
 * stored `false` for it. Malformed settings JSON falls back to enabled rather
 * than silently swallowing notifications.
 *
 * This layer is independent of the per-user email preference system. Both
 * apply: project OFF means nobody on the project gets that category; project ON
 * means each user's own preferences still decide whether they receive it.
 */

export type ProjectNotificationPreferenceKey =
  | 'holdPointReleases'
  | 'ncrAssignments'
  | 'testResults'
  | 'dailyDiaryReminders';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse a project's stored settings into an object. Accepts the raw JSON string
 * (as stored on Project.settings), an already-parsed object, or null/undefined.
 * Anything malformed or non-object returns an empty object.
 */
function parseProjectSettings(
  projectSettings: string | null | undefined | Record<string, unknown>,
): Record<string, unknown> {
  if (projectSettings == null) {
    return {};
  }

  if (typeof projectSettings === 'string') {
    try {
      const parsed = JSON.parse(projectSettings);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return isRecord(projectSettings) ? projectSettings : {};
}

/**
 * Returns whether a notification category is enabled for the project.
 *
 * Enabled (true) unless the project explicitly stored
 * `settings.notificationPreferences.<key> === false`.
 */
export function isProjectNotificationEnabled(
  projectSettings: string | null | undefined | Record<string, unknown>,
  key: ProjectNotificationPreferenceKey,
): boolean {
  const settings = parseProjectSettings(projectSettings);
  const preferences = settings.notificationPreferences;
  if (!isRecord(preferences)) {
    return true;
  }
  return preferences[key] !== false;
}
