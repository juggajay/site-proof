import { describe, expect, it } from 'vitest';
import { formatDateKey } from '@/lib/localDate';
import {
  buildNeedsAttentionItems,
  formatCurrency,
  formatDate,
  getDocketPrerequisiteState,
  getDocketStatusMeta,
  getGreeting,
  getToday,
  type AttentionDocket,
  type AttentionNotification,
} from './subcontractorDashboardHelpers';

describe('subcontractor dashboard – formatCurrency', () => {
  it('formats whole-dollar AUD amounts with no decimals', () => {
    expect(formatCurrency(1234)).toBe('$1,234');
  });

  it('rounds to whole dollars', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
  });

  it('formats zero as $0', () => {
    expect(formatCurrency(0)).toBe('$0');
  });
});

describe('subcontractor dashboard – formatDate', () => {
  // toLocaleDateString output depends on the runner timezone (the date string
  // is parsed at UTC midnight), so assert only timezone-stable parts, matching
  // docketEditDisplay.test.ts.
  it('includes the year for a valid ISO date', () => {
    expect(formatDate('2026-06-06')).toContain('2026');
  });

  it('returns a non-empty string', () => {
    expect(formatDate('2026-06-06').length).toBeGreaterThan(0);
  });
});

describe('subcontractor dashboard – getGreeting', () => {
  // new Date(y, m, d, hour) is constructed in local time, so getHours() returns
  // the literal hour on any runner timezone.
  it('greets good morning before 12', () => {
    expect(getGreeting(new Date(2026, 5, 6, 0))).toBe('Good morning');
    expect(getGreeting(new Date(2026, 5, 6, 11))).toBe('Good morning');
  });

  it('greets good afternoon from 12 to before 17', () => {
    expect(getGreeting(new Date(2026, 5, 6, 12))).toBe('Good afternoon');
    expect(getGreeting(new Date(2026, 5, 6, 16))).toBe('Good afternoon');
  });

  it('greets good evening from 17', () => {
    expect(getGreeting(new Date(2026, 5, 6, 17))).toBe('Good evening');
    expect(getGreeting(new Date(2026, 5, 6, 23))).toBe('Good evening');
  });

  it('defaults to the current time and returns one of the three greetings', () => {
    expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(getGreeting());
  });
});

describe('subcontractor dashboard – getToday', () => {
  it("delegates to formatDateKey for today's docket key", () => {
    expect(getToday()).toBe(formatDateKey());
  });
});

describe('subcontractor dashboard – getDocketStatusMeta', () => {
  it('returns the existing label and badge classes for each known status', () => {
    expect(getDocketStatusMeta('draft')).toEqual({
      label: 'Draft',
      className: 'bg-muted text-foreground',
    });
    expect(getDocketStatusMeta('pending_approval')).toEqual({
      label: 'Pending',
      className: 'bg-warning/10 text-warning',
    });
    expect(getDocketStatusMeta('approved')).toEqual({
      label: 'Approved',
      className: 'bg-success/10 text-success',
    });
    expect(getDocketStatusMeta('rejected')).toEqual({
      label: 'Rejected',
      className: 'bg-destructive/10 text-destructive',
    });
    expect(getDocketStatusMeta('queried')).toEqual({
      label: 'Queried',
      className: 'bg-warning/10 text-warning',
    });
  });

  it('falls back to the raw status label and draft styling for unknown statuses', () => {
    expect(getDocketStatusMeta('some_new_status')).toEqual({
      label: 'some_new_status',
      className: 'bg-muted text-foreground',
    });
  });
});

describe('subcontractor dashboard – getDocketPrerequisiteState', () => {
  it('is ready when there are resources, the lots module is on, and a lot is assigned', () => {
    expect(
      getDocketPrerequisiteState({
        approvedEmployeeCount: 2,
        approvedPlantCount: 0,
        lotsModuleEnabled: true,
        assignedLotCount: 1,
      }),
    ).toEqual({
      hasDocketResources: true,
      needsLotAssignment: false,
      lotsModuleDisabled: false,
      prerequisitesMet: true,
    });
  });

  it('needs a lot assignment when the lots module is on but no lots are assigned', () => {
    const state = getDocketPrerequisiteState({
      approvedEmployeeCount: 1,
      approvedPlantCount: 0,
      lotsModuleEnabled: true,
      assignedLotCount: 0,
    });

    expect(state.needsLotAssignment).toBe(true);
    expect(state.lotsModuleDisabled).toBe(false);
    expect(state.prerequisitesMet).toBe(false);
  });

  it('is not ready and flags the disabled module when the lots module is off, even with resources', () => {
    // The core regression: lots-off previously skipped the lot check and made
    // the dashboard claim the subbie was ready, despite labour dockets being
    // impossible without lot access.
    const state = getDocketPrerequisiteState({
      approvedEmployeeCount: 3,
      approvedPlantCount: 1,
      lotsModuleEnabled: false,
      assignedLotCount: 0,
    });

    expect(state.hasDocketResources).toBe(true);
    expect(state.lotsModuleDisabled).toBe(true);
    // needsLotAssignment stays false because the "assign a lot" remedy does not
    // apply — the HC must turn the module back on.
    expect(state.needsLotAssignment).toBe(false);
    expect(state.prerequisitesMet).toBe(false);
  });

  it('is not ready when there are no approved employees or plant', () => {
    const state = getDocketPrerequisiteState({
      approvedEmployeeCount: 0,
      approvedPlantCount: 0,
      lotsModuleEnabled: true,
      assignedLotCount: 2,
    });

    expect(state.hasDocketResources).toBe(false);
    expect(state.prerequisitesMet).toBe(false);
  });
});

describe('subcontractor dashboard – buildNeedsAttentionItems', () => {
  const myCompanyLink = '/my-company?projectId=project-1';

  const queried: AttentionDocket = {
    id: 'd-queried',
    date: '2026-06-04',
    status: 'queried',
    foremanNotes: 'Check the plant hours on the roller',
  };
  const rejected: AttentionDocket = {
    id: 'd-rejected',
    date: '2026-06-03',
    status: 'rejected',
  };
  const approved: AttentionDocket = {
    id: 'd-approved',
    date: '2026-06-02',
    status: 'approved',
  };

  const unreadRateCounter: AttentionNotification = {
    id: 'n-1',
    type: 'rate_counter',
    title: 'Rate counter-proposal',
    message: 'Excavator rate countered at $180/hr',
    isRead: false,
    createdAt: '2026-06-05T01:00:00.000Z',
  };
  const readRateCounter: AttentionNotification = {
    ...unreadRateCounter,
    id: 'n-2',
    isRead: true,
  };
  const otherNotification: AttentionNotification = {
    ...unreadRateCounter,
    id: 'n-3',
    type: 'docket_approved',
  };

  it('orders queried dockets, then rejected dockets, then rate-counter notifications', () => {
    const items = buildNeedsAttentionItems({
      // Deliberately out of output order to prove ordering comes from the helper.
      recentDockets: [rejected, queried],
      notifications: [unreadRateCounter],
      myCompanyLink,
    });

    expect(items.map((item) => item.type)).toEqual([
      'docket_queried',
      'docket_rejected',
      'rate_counter',
    ]);
  });

  it('maps queried dockets with foreman notes and the docket link', () => {
    const [item] = buildNeedsAttentionItems({
      recentDockets: [queried],
      notifications: [],
      myCompanyLink,
    });

    expect(item).toEqual({
      id: 'd-queried',
      type: 'docket_queried',
      title: 'Docket Queried',
      message: 'Check the plant hours on the roller',
      date: '2026-06-04',
      link: '/subcontractor-portal/docket/d-queried',
    });
  });

  it('uses the fallback messages when foreman notes are missing', () => {
    const items = buildNeedsAttentionItems({
      recentDockets: [{ ...queried, foremanNotes: undefined }, rejected],
      notifications: [],
      myCompanyLink,
    });

    expect(items[0].message).toBe('Please review and respond');
    expect(items[1].message).toBe('Please review and resubmit');
    expect(items[1].title).toBe('Docket Rejected');
  });

  it('includes only unread rate_counter notifications, linking to the my-company link', () => {
    const items = buildNeedsAttentionItems({
      recentDockets: [],
      notifications: [unreadRateCounter, readRateCounter, otherNotification],
      myCompanyLink,
    });

    expect(items).toEqual([
      {
        id: 'n-1',
        type: 'rate_counter',
        title: 'Rate counter-proposal',
        message: 'Excavator rate countered at $180/hr',
        date: '2026-06-05T01:00:00.000Z',
        link: '/my-company?projectId=project-1',
      },
    ]);
  });

  it('ignores dockets that are not queried or rejected', () => {
    const items = buildNeedsAttentionItems({
      recentDockets: [approved],
      notifications: [],
      myCompanyLink,
    });

    expect(items).toEqual([]);
  });
});
