import { describe, expect, it } from 'vitest';
import {
  canReviewPendingVerification,
  mapPendingItpVerification,
  type PendingItpVerification,
} from './pendingItpVerifications';

function raw(overrides: Partial<PendingItpVerification> = {}): PendingItpVerification {
  return {
    id: 'completion-1',
    status: 'completed',
    verificationStatus: 'pending_verification',
    completedAt: '2026-06-20T03:00:00.000Z',
    notes: null,
    completedBy: { id: 'subbie-1', fullName: 'Sub Bie', email: 'sub@x.test' },
    checklistItem: {
      id: 'item-1',
      description: 'Place bedding',
      responsibleParty: 'subcontractor',
    },
    lot: { id: 'lot-1', lotNumber: 'EW-001', description: 'Earthworks lot' },
    template: { id: 'template-1', name: 'Earthworks ITP' },
    subcontractor: { id: 'sc-1', companyName: 'Acme Civil' },
    ...overrides,
  };
}

describe('mapPendingItpVerification', () => {
  it('flattens the nested response into a display row', () => {
    expect(mapPendingItpVerification(raw())).toEqual({
      id: 'completion-1',
      lotId: 'lot-1',
      lotNumber: 'EW-001',
      itemDescription: 'Place bedding',
      completedById: 'subbie-1',
      completedByName: 'Sub Bie',
      subcontractorName: 'Acme Civil',
      templateName: 'Earthworks ITP',
      completedAt: '2026-06-20T03:00:00.000Z',
    });
  });

  it('falls back to the email then "Unknown" for the completer name', () => {
    expect(
      mapPendingItpVerification(
        raw({ completedBy: { id: 'subbie-2', fullName: null, email: 'only@x.test' } }),
      ).completedByName,
    ).toBe('only@x.test');
    expect(mapPendingItpVerification(raw({ completedBy: null })).completedByName).toBe('Unknown');
    expect(mapPendingItpVerification(raw({ completedBy: null })).completedById).toBeNull();
  });

  it('tolerates a missing subcontractor and template', () => {
    const row = mapPendingItpVerification(raw({ subcontractor: null, template: null }));
    expect(row.subcontractorName).toBeNull();
    expect(row.templateName).toBeNull();
  });
});

describe('canReviewPendingVerification (assertDifferentVerifier)', () => {
  it('blocks the user from reviewing an item they completed themselves', () => {
    expect(canReviewPendingVerification('user-1', 'user-1')).toBe(false);
  });

  it('allows reviewing items completed by someone else', () => {
    expect(canReviewPendingVerification('user-1', 'subbie-9')).toBe(true);
  });

  it('allows review when the completer or current user is unknown', () => {
    expect(canReviewPendingVerification('user-1', null)).toBe(true);
    expect(canReviewPendingVerification(undefined, 'subbie-9')).toBe(true);
    expect(canReviewPendingVerification(null, null)).toBe(true);
  });
});
