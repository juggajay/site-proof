import { describe, expect, it } from 'vitest';
import {
  buildHoldPointReleaseEmailNotification,
  buildHoldPointReleaseNotifications,
  type HoldPointReleaseEmailContext,
  type HoldPointReleaseNotificationContext,
} from './releaseNotifications.js';

/**
 * Characterizes the pure hold-point release notification payload builders
 * extracted verbatim from backend/src/routes/holdpoints.ts (the authenticated
 * POST /:id/release handler). These freeze the in-app record shape (one per
 * recipient), the shared headline, the `releasedByName || 'Unknown'` fallback,
 * and the email body's project / release-method / notes block with the
 * `'Digital'` / `'None'` fallbacks. All inputs are plain fixtures — no database.
 */

const baseContext: HoldPointReleaseNotificationContext = {
  projectId: 'proj-1',
  holdPointDescription: 'Footing inspection',
  lotNumber: 'LOT-7',
  releasedByName: 'Jane Foreman',
};

const baseEmailContext: HoldPointReleaseEmailContext = {
  ...baseContext,
  projectName: 'Riverside Upgrade',
  releaseMethod: 'physical_signoff',
  releaseNotes: 'Cleared on site',
};

describe('buildHoldPointReleaseNotifications', () => {
  it('produces one in-app notification record per project user', () => {
    const result = buildHoldPointReleaseNotifications(
      [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }],
      baseContext,
    );

    expect(result).toEqual([
      {
        userId: 'u1',
        projectId: 'proj-1',
        type: 'hold_point_release',
        title: 'Hold Point Released',
        message: 'Hold point "Footing inspection" on lot LOT-7 has been released by Jane Foreman.',
        linkUrl: '/projects/proj-1/hold-points',
      },
      {
        userId: 'u2',
        projectId: 'proj-1',
        type: 'hold_point_release',
        title: 'Hold Point Released',
        message: 'Hold point "Footing inspection" on lot LOT-7 has been released by Jane Foreman.',
        linkUrl: '/projects/proj-1/hold-points',
      },
      {
        userId: 'u3',
        projectId: 'proj-1',
        type: 'hold_point_release',
        title: 'Hold Point Released',
        message: 'Hold point "Footing inspection" on lot LOT-7 has been released by Jane Foreman.',
        linkUrl: '/projects/proj-1/hold-points',
      },
    ]);
  });

  it('returns an empty list when there are no project users', () => {
    expect(buildHoldPointReleaseNotifications([], baseContext)).toEqual([]);
  });

  it('falls back to "Unknown" when releasedByName is missing', () => {
    const [record] = buildHoldPointReleaseNotifications([{ userId: 'u1' }], {
      ...baseContext,
      releasedByName: undefined,
    });

    expect(record.message).toBe(
      'Hold point "Footing inspection" on lot LOT-7 has been released by Unknown.',
    );

    const [nullRecord] = buildHoldPointReleaseNotifications([{ userId: 'u1' }], {
      ...baseContext,
      releasedByName: null,
    });
    expect(nullRecord.message).toBe(
      'Hold point "Footing inspection" on lot LOT-7 has been released by Unknown.',
    );
  });
});

describe('buildHoldPointReleaseEmailNotification', () => {
  it('preserves project name, lot/hold point text, and the provided method and notes', () => {
    const payload = buildHoldPointReleaseEmailNotification(baseEmailContext);

    expect(payload).toEqual({
      title: 'Hold Point Released',
      message:
        'Hold point "Footing inspection" on lot LOT-7 has been released by Jane Foreman.\n\n' +
        'Project: Riverside Upgrade\nRelease Method: physical_signoff\nNotes: Cleared on site',
      projectName: 'Riverside Upgrade',
      linkUrl: '/projects/proj-1/hold-points',
    });
  });

  it('uses the "Unknown" / "Digital" / "None" fallbacks when fields are missing', () => {
    const payload = buildHoldPointReleaseEmailNotification({
      ...baseEmailContext,
      releasedByName: undefined,
      releaseMethod: undefined,
      releaseNotes: undefined,
    });

    expect(payload.message).toBe(
      'Hold point "Footing inspection" on lot LOT-7 has been released by Unknown.\n\n' +
        'Project: Riverside Upgrade\nRelease Method: Digital\nNotes: None',
    );
    // title / projectName / linkUrl are unaffected by the missing optional fields
    expect(payload.title).toBe('Hold Point Released');
    expect(payload.projectName).toBe('Riverside Upgrade');
    expect(payload.linkUrl).toBe('/projects/proj-1/hold-points');
  });

  it('shares the same headline as the in-app notification record', () => {
    const headline =
      'Hold point "Footing inspection" on lot LOT-7 has been released by Jane Foreman.';
    const [record] = buildHoldPointReleaseNotifications([{ userId: 'u1' }], baseContext);
    const payload = buildHoldPointReleaseEmailNotification(baseEmailContext);

    // The in-app record carries the bare headline; the email body starts with it.
    expect(record.message).toBe(headline);
    expect(payload.message.startsWith(headline)).toBe(true);
  });
});
