import { describe, expect, it } from 'vitest';
import { getAvailableNcrActions } from './ncrActions';
import type { NCR, UserRole } from './types';

function makeNcr(overrides: Partial<NCR> = {}): NCR {
  return {
    id: 'ncr-1',
    ncrNumber: 'NCR-001',
    description: 'Defect',
    category: 'workmanship',
    severity: 'minor',
    status: 'open',
    qmApprovalRequired: false,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Raiser', email: 'r@x.test' },
    createdAt: '2026-06-01T00:00:00.000Z',
    project: { name: 'Proj', projectNumber: 'P-1' },
    ncrLots: [],
    ...overrides,
  };
}

function role(overrides: Partial<UserRole> = {}): UserRole {
  return {
    role: 'viewer',
    isQualityManager: false,
    canApproveNCRs: false,
    ...overrides,
  };
}

describe('getAvailableNcrActions', () => {
  it('offers Respond on an open NCR to managers or the responsible user, and Assign to managers', () => {
    const viewer = getAvailableNcrActions(makeNcr({ status: 'open' }), role());
    expect(viewer.respond).toBe(false);
    expect(viewer.assign).toBe(false);
    expect(viewer.rectify).toBe(false);
    expect(viewer.close).toBe(false);

    const pm = getAvailableNcrActions(
      makeNcr({ status: 'open' }),
      role({ role: 'project_manager' }),
    );
    expect(pm.respond).toBe(true);
    expect(pm.assign).toBe(true);

    const responsible = getAvailableNcrActions(
      makeNcr({ status: 'open', responsibleUserId: 'user-1' }),
      role({ role: 'foreman' }),
      'user-1',
    );
    expect(responsible.respond).toBe(true);
  });

  it('allows management roles to review a response while investigating, and responsible users to submit rectification', () => {
    const qm = getAvailableNcrActions(
      makeNcr({ status: 'investigating' }),
      role({ role: 'quality_manager', isQualityManager: true }),
    );
    expect(qm.reviewResponse).toBe(true);
    expect(qm.rectify).toBe(true);

    const foreman = getAvailableNcrActions(
      makeNcr({ status: 'investigating' }),
      role({ role: 'foreman' }),
    );
    expect(foreman.reviewResponse).toBe(false);
    expect(foreman.rectify).toBe(false);

    const responsible = getAvailableNcrActions(
      makeNcr({ status: 'investigating', responsibleUserId: 'user-1' }),
      role({ role: 'foreman' }),
      'user-1',
    );
    expect(responsible.rectify).toBe(true);
  });

  it('exposes rectify in the rectification status too', () => {
    expect(
      getAvailableNcrActions(
        makeNcr({ status: 'rectification', responsibleUserId: 'user-1' }),
        role({ role: 'foreman' }),
        'user-1',
      ).rectify,
    ).toBe(true);
  });

  it('lets closure roles close or concede a minor NCR in verification, with reject available to QM/PM/admin', () => {
    const pm = getAvailableNcrActions(
      makeNcr({ status: 'verification', severity: 'minor' }),
      role({ role: 'project_manager' }),
    );
    expect(pm.close).toBe(true);
    expect(pm.concession).toBe(true);
    expect(pm.rejectRectification).toBe(true);
    expect(pm.closeBlockedPendingQmApproval).toBe(false);

    const siteManager = getAvailableNcrActions(
      makeNcr({ status: 'verification', severity: 'minor' }),
      role({ role: 'site_manager', isQualityManager: true }),
    );
    expect(siteManager.close).toBe(true);
    expect(siteManager.rejectRectification).toBe(true);

    const viewer = getAvailableNcrActions(
      makeNcr({ status: 'verification', severity: 'minor' }),
      role(),
    );
    expect(viewer.close).toBe(false);
    expect(viewer.concession).toBe(false);
  });

  it('requires QM approval before a major NCR can be closed/conceded, and offers QM Approve to the QM', () => {
    const qmUnapproved = getAvailableNcrActions(
      makeNcr({ status: 'verification', severity: 'major', qmApprovedAt: null }),
      role({ role: 'quality_manager', isQualityManager: true }),
    );
    expect(qmUnapproved.qmApprove).toBe(true);
    expect(qmUnapproved.close).toBe(true); // shown, but...
    expect(qmUnapproved.closeBlockedPendingQmApproval).toBe(true); // ...disabled until approved

    const qmApproved = getAvailableNcrActions(
      makeNcr({
        status: 'verification',
        severity: 'major',
        qmApprovedAt: '2026-06-10T00:00:00.000Z',
      }),
      role({ role: 'quality_manager', isQualityManager: true }),
    );
    expect(qmApproved.qmApprove).toBe(false); // already approved
    expect(qmApproved.closeBlockedPendingQmApproval).toBe(false);

    const adminUnapproved = getAvailableNcrActions(
      makeNcr({ status: 'verification', severity: 'major', qmApprovedAt: null }),
      role({ role: 'admin', isQualityManager: true }),
    );
    expect(adminUnapproved.qmApprove).toBe(false);
  });

  it('offers Notify Client only for an un-notified major NCR that requires it, to the right roles', () => {
    const base = {
      status: 'verification' as const,
      severity: 'major' as const,
      clientNotificationRequired: true,
      clientNotifiedAt: null,
    };
    expect(
      getAvailableNcrActions(makeNcr(base), role({ role: 'project_manager' })).notifyClient,
    ).toBe(true);
    expect(getAvailableNcrActions(makeNcr(base), role({ role: 'site_manager' })).notifyClient).toBe(
      false,
    );
    expect(
      getAvailableNcrActions(
        makeNcr({ ...base, clientNotifiedAt: '2026-06-09T00:00:00.000Z' }),
        role({ role: 'project_manager' }),
      ).notifyClient,
    ).toBe(false);
    expect(
      getAvailableNcrActions(
        makeNcr({ ...base, clientNotificationRequired: false }),
        role({ role: 'project_manager' }),
      ).notifyClient,
    ).toBe(false);
  });

  it('treats a null role as having no role-gated actions', () => {
    const actions = getAvailableNcrActions(
      makeNcr({ status: 'verification', severity: 'minor' }),
      null,
    );
    expect(actions).toMatchObject({
      assign: false,
      reviewResponse: false,
      qmApprove: false,
      notifyClient: false,
      rejectRectification: false,
      close: false,
      concession: false,
    });
  });
});
