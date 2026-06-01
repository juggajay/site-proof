import { describe, expect, it } from 'vitest';
import {
  buildHoldPointReleaseConfirmationEmail,
  selectHoldPointReleaseContractors,
  selectHoldPointReleaseSuperintendents,
  type HoldPointReleaseConfirmationContext,
  type HoldPointReleaseConfirmationRecipient,
} from './releaseConfirmationEmails.js';

/**
 * Characterizes the pure hold-point release confirmation email helpers extracted
 * verbatim from backend/src/routes/holdpoints.ts (the authenticated
 * POST /:id/release handler). These freeze the contractor / superintendent role
 * selection, the role-driven recipient-name fallback ('Site Team' /
 * 'Superintendent'), and the `'Hold Point'` / `'Unknown'` / undefined fallbacks
 * in the payload. All inputs are plain fixtures — no database.
 */

type ProjectUser = {
  userId: string;
  role: string;
  user: { id: string; email: string; fullName: string | null };
};

function projectUser(role: string, overrides: Partial<ProjectUser['user']> = {}): ProjectUser {
  return {
    userId: `uid-${role}`,
    role,
    user: {
      id: `uid-${role}`,
      email: `${role}@example.com`,
      fullName: `${role} name`,
      ...overrides,
    },
  };
}

const allRoles: ProjectUser[] = [
  projectUser('site_engineer'),
  projectUser('foreman'),
  projectUser('engineer'),
  projectUser('superintendent'),
  projectUser('project_manager'),
  projectUser('admin'),
  projectUser('owner'),
  projectUser('subcontractor'),
];

const baseContext: HoldPointReleaseConfirmationContext = {
  projectName: 'Riverside Upgrade',
  lotNumber: 'LOT-7',
  holdPointDescription: 'Footing inspection',
  releasedByName: 'Jane Foreman',
  releasedByOrg: 'Acme Civil',
  releaseMethod: 'physical_signoff',
  releaseNotes: 'Cleared on site',
  releasedAt: 'Monday, 1 June 2026, 09:00 AM',
  lotUrl: 'https://app.example.com/projects/p1/lots/l1',
};

describe('selectHoldPointReleaseContractors', () => {
  it('includes only site_engineer / foreman / engineer roles', () => {
    const result = selectHoldPointReleaseContractors(allRoles);
    expect(result.map((pu) => pu.role)).toEqual(['site_engineer', 'foreman', 'engineer']);
  });
});

describe('selectHoldPointReleaseSuperintendents', () => {
  it('includes only superintendent / project_manager roles', () => {
    const result = selectHoldPointReleaseSuperintendents(allRoles);
    expect(result.map((pu) => pu.role)).toEqual(['superintendent', 'project_manager']);
  });
});

describe('buildHoldPointReleaseConfirmationEmail', () => {
  it('builds the full contractor payload from recipient and context', () => {
    const recipient: HoldPointReleaseConfirmationRecipient = {
      user: { email: 'sam@example.com', fullName: 'Sam Site' },
    };

    expect(buildHoldPointReleaseConfirmationEmail(recipient, 'contractor', baseContext)).toEqual({
      to: 'sam@example.com',
      recipientName: 'Sam Site',
      recipientRole: 'contractor',
      projectName: 'Riverside Upgrade',
      lotNumber: 'LOT-7',
      holdPointDescription: 'Footing inspection',
      releasedByName: 'Jane Foreman',
      releasedByOrg: 'Acme Civil',
      releaseMethod: 'physical_signoff',
      releaseNotes: 'Cleared on site',
      releasedAt: 'Monday, 1 June 2026, 09:00 AM',
      lotUrl: 'https://app.example.com/projects/p1/lots/l1',
    });
  });

  it('falls back to "Site Team" for a contractor with no full name', () => {
    const recipient: HoldPointReleaseConfirmationRecipient = {
      user: { email: 'x@example.com', fullName: null },
    };
    const payload = buildHoldPointReleaseConfirmationEmail(recipient, 'contractor', baseContext);
    expect(payload.recipientName).toBe('Site Team');
    expect(payload.recipientRole).toBe('contractor');
  });

  it('falls back to "Superintendent" for a superintendent with no full name', () => {
    const recipient: HoldPointReleaseConfirmationRecipient = {
      user: { email: 'y@example.com', fullName: null },
    };
    const payload = buildHoldPointReleaseConfirmationEmail(
      recipient,
      'superintendent',
      baseContext,
    );
    expect(payload.recipientName).toBe('Superintendent');
    expect(payload.recipientRole).toBe('superintendent');
  });

  it('applies the "Hold Point" / "Unknown" / undefined fallbacks when fields are missing', () => {
    const recipient: HoldPointReleaseConfirmationRecipient = {
      user: { email: 'z@example.com', fullName: 'Zoe' },
    };
    const payload = buildHoldPointReleaseConfirmationEmail(recipient, 'contractor', {
      ...baseContext,
      holdPointDescription: null,
      releasedByName: undefined,
      releasedByOrg: undefined,
      releaseMethod: undefined,
      releaseNotes: undefined,
    });

    expect(payload.holdPointDescription).toBe('Hold Point');
    expect(payload.releasedByName).toBe('Unknown');
    expect(payload.releasedByOrg).toBeUndefined();
    expect(payload.releaseMethod).toBeUndefined();
    expect(payload.releaseNotes).toBeUndefined();
  });

  it('produces one payload per selected recipient', () => {
    const contractors = selectHoldPointReleaseContractors(allRoles);
    const payloads = contractors.map((c) =>
      buildHoldPointReleaseConfirmationEmail(c, 'contractor', baseContext),
    );

    expect(payloads).toHaveLength(3);
    expect(payloads.map((p) => p.to)).toEqual([
      'site_engineer@example.com',
      'foreman@example.com',
      'engineer@example.com',
    ]);
  });
});
