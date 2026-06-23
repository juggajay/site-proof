import { describe, expect, it } from 'vitest';
import type { ITPAttachment, ITPChecklistItem, ITPCompletion, ITPTemplate } from '../types';
import {
  canReviewItpByRole,
  canReviewItpItem,
  filterItpChecklistItems,
  getAdjacentItpAttachment,
  getItpAttachments,
  getItpCategoryProgress,
  getItpChecklistProgress,
  getItpVerificationDisplay,
  groupItpChecklistItemsByCategory,
  isItpTemplateActivityMatch,
  sortItpTemplatesForLotActivity,
  toggleExpandedItpCategory,
} from './itpChecklistTabHelpers';

function item(overrides: Partial<ITPChecklistItem> = {}): ITPChecklistItem {
  return {
    id: overrides.id ?? 'item-1',
    description: overrides.description ?? 'Checklist item',
    category: overrides.category ?? 'Earthworks',
    responsibleParty: overrides.responsibleParty ?? 'contractor',
    isHoldPoint: overrides.isHoldPoint ?? false,
    pointType: overrides.pointType ?? 'standard',
    evidenceRequired: overrides.evidenceRequired ?? 'none',
    order: overrides.order ?? 1,
    testType: overrides.testType ?? null,
    acceptanceCriteria: overrides.acceptanceCriteria ?? null,
  };
}

function completion(overrides: Partial<ITPCompletion> = {}): ITPCompletion {
  return {
    id: overrides.id ?? 'completion-1',
    checklistItemId: overrides.checklistItemId ?? 'item-1',
    isCompleted: overrides.isCompleted ?? false,
    isNotApplicable: overrides.isNotApplicable,
    isFailed: overrides.isFailed,
    notes: overrides.notes ?? null,
    completedAt: overrides.completedAt ?? null,
    completedBy: overrides.completedBy ?? null,
    isVerified: overrides.isVerified ?? false,
    isPendingVerification: overrides.isPendingVerification,
    isRejected: overrides.isRejected,
    verificationStatus: overrides.verificationStatus,
    verificationNotes: overrides.verificationNotes,
    verifiedAt: overrides.verifiedAt ?? null,
    verifiedBy: overrides.verifiedBy ?? null,
    attachments: overrides.attachments ?? [],
    linkedNcr: overrides.linkedNcr ?? null,
    witnessPresent: overrides.witnessPresent ?? null,
    witnessName: overrides.witnessName ?? null,
    witnessCompany: overrides.witnessCompany ?? null,
  };
}

function attachment(id: string): ITPAttachment {
  return {
    id,
    documentId: `doc-${id}`,
    document: {
      id: `doc-${id}`,
      filename: `${id}.jpg`,
      fileUrl: `https://example.test/${id}.jpg`,
      caption: null,
      uploadedAt: '2026-06-06T00:00:00.000Z',
      uploadedBy: null,
      gpsLatitude: null,
      gpsLongitude: null,
    },
  };
}

function template(overrides: Partial<ITPTemplate> = {}): ITPTemplate {
  return {
    id: overrides.id ?? 'template-1',
    name: overrides.name ?? 'Earthworks ITP',
    activityType: overrides.activityType ?? 'earthworks',
    checklistItems: overrides.checklistItems ?? [],
  };
}

describe('getItpChecklistProgress', () => {
  it('counts completed and not-applicable completions as finished items', () => {
    const progress = getItpChecklistProgress(
      [item({ id: 'item-1' }), item({ id: 'item-2' }), item({ id: 'item-3' })],
      [
        completion({ checklistItemId: 'item-1', isCompleted: true }),
        completion({ checklistItemId: 'item-2', isNotApplicable: true }),
        completion({ checklistItemId: 'item-3', isFailed: true }),
      ],
    );

    expect(progress).toEqual({
      totalItems: 3,
      completedItems: 1,
      naItems: 1,
      finishedItems: 2,
      percentage: 67,
    });
  });

  it('preserves the current completion-count behavior even when completions exceed items', () => {
    const progress = getItpChecklistProgress(
      [item({ id: 'item-1' })],
      [
        completion({ checklistItemId: 'item-1', isCompleted: true }),
        completion({ checklistItemId: 'extra-item', isNotApplicable: true }),
      ],
    );

    expect(progress.finishedItems).toBe(2);
    expect(progress.percentage).toBe(200);
  });

  it('returns zero percent when the template has no checklist items', () => {
    expect(getItpChecklistProgress([], [completion({ isCompleted: true })]).percentage).toBe(0);
  });
});

describe('groupItpChecklistItemsByCategory', () => {
  it('groups items in input order and falls back to General for blank categories', () => {
    expect(
      groupItpChecklistItemsByCategory([
        item({ id: 'earthworks-1', category: 'Earthworks' }),
        item({ id: 'general-1', category: '' }),
        item({ id: 'earthworks-2', category: 'Earthworks' }),
      ]),
    ).toEqual({
      Earthworks: [
        expect.objectContaining({ id: 'earthworks-1' }),
        expect.objectContaining({ id: 'earthworks-2' }),
      ],
      General: [expect.objectContaining({ id: 'general-1' })],
    });
  });
});

describe('filterItpChecklistItems', () => {
  const checklistItems = [
    item({ id: 'pending' }),
    item({ id: 'completed' }),
    item({ id: 'na' }),
    item({ id: 'failed' }),
  ];
  const completions = [
    completion({ checklistItemId: 'completed', isCompleted: true }),
    completion({ checklistItemId: 'na', isNotApplicable: true }),
    completion({ checklistItemId: 'failed', isFailed: true }),
  ];

  it('keeps all items for the all filter unless incomplete-only is enabled', () => {
    expect(filterItpChecklistItems(checklistItems, completions, 'all', false)).toHaveLength(4);
    expect(filterItpChecklistItems(checklistItems, completions, 'all', true)).toEqual([
      expect.objectContaining({ id: 'pending' }),
    ]);
  });

  it('filters pending, completed, not-applicable, and failed states exactly', () => {
    expect(filterItpChecklistItems(checklistItems, completions, 'pending', false)).toEqual([
      expect.objectContaining({ id: 'pending' }),
    ]);
    expect(filterItpChecklistItems(checklistItems, completions, 'completed', false)).toEqual([
      expect.objectContaining({ id: 'completed' }),
    ]);
    expect(filterItpChecklistItems(checklistItems, completions, 'na', false)).toEqual([
      expect.objectContaining({ id: 'na' }),
    ]);
    expect(filterItpChecklistItems(checklistItems, completions, 'failed', false)).toEqual([
      expect.objectContaining({ id: 'failed' }),
    ]);
  });
});

describe('getItpCategoryProgress', () => {
  it('treats completed and not-applicable items as complete, but not failed items', () => {
    expect(
      getItpCategoryProgress(
        [item({ id: 'completed' }), item({ id: 'na' }), item({ id: 'failed' })],
        [
          completion({ checklistItemId: 'completed', isCompleted: true }),
          completion({ checklistItemId: 'na', isNotApplicable: true }),
          completion({ checklistItemId: 'failed', isFailed: true }),
        ],
      ),
    ).toEqual({
      completedInCategory: 2,
      totalInCategory: 3,
      isCategoryComplete: false,
    });
  });

  it('matches the current empty-category complete flag', () => {
    expect(getItpCategoryProgress([], []).isCategoryComplete).toBe(true);
  });
});

describe('ITP photo helpers', () => {
  it('flattens completion attachments in completion order', () => {
    expect(
      getItpAttachments([
        completion({ id: 'c1', attachments: [attachment('a'), attachment('b')] }),
        completion({ id: 'c2', attachments: [] }),
        completion({ id: 'c3', attachments: [attachment('c')] }),
      ]).map((photo) => photo.id),
    ).toEqual(['a', 'b', 'c']);
  });

  it('returns adjacent attachments and null at the boundaries', () => {
    const attachments = [attachment('a'), attachment('b'), attachment('c')];

    expect(getAdjacentItpAttachment(attachments, 'b', 'previous')?.id).toBe('a');
    expect(getAdjacentItpAttachment(attachments, 'b', 'next')?.id).toBe('c');
    expect(getAdjacentItpAttachment(attachments, 'a', 'previous')).toBeNull();
    expect(getAdjacentItpAttachment(attachments, 'c', 'next')).toBeNull();
    expect(getAdjacentItpAttachment(attachments, 'missing', 'next')).toBeNull();
  });
});

describe('ITP template selection helpers', () => {
  it('matches template activity type case-insensitively when a lot activity is present', () => {
    expect(isItpTemplateActivityMatch(template({ activityType: 'Earthworks' }), 'earthworks')).toBe(
      true,
    );
    expect(isItpTemplateActivityMatch(template({ activityType: 'Drainage' }), 'earthworks')).toBe(
      false,
    );
    expect(isItpTemplateActivityMatch(template({ activityType: 'Earthworks' }), null)).toBe(false);
  });

  it('sorts matching templates first while preserving existing order inside match groups', () => {
    const templates = [
      template({ id: 'drainage-1', activityType: 'drainage' }),
      template({ id: 'earthworks-1', activityType: 'earthworks' }),
      template({ id: 'earthworks-2', activityType: 'Earthworks' }),
      template({ id: 'drainage-2', activityType: 'drainage' }),
    ];

    expect(
      sortItpTemplatesForLotActivity(templates, 'earthworks').map((entry) => entry.id),
    ).toEqual(['earthworks-1', 'earthworks-2', 'drainage-1', 'drainage-2']);
    expect(templates.map((entry) => entry.id)).toEqual([
      'drainage-1',
      'earthworks-1',
      'earthworks-2',
      'drainage-2',
    ]);
  });
});

describe('toggleExpandedItpCategory', () => {
  it('adds missing categories and removes expanded categories without mutating the input set', () => {
    const expandedCategories = new Set(['Earthworks']);

    const withDrainage = toggleExpandedItpCategory(expandedCategories, 'Drainage');
    const withoutEarthworks = toggleExpandedItpCategory(expandedCategories, 'Earthworks');

    expect([...withDrainage]).toEqual(['Earthworks', 'Drainage']);
    expect([...withoutEarthworks]).toEqual([]);
    expect([...expandedCategories]).toEqual(['Earthworks']);
  });
});

describe('getItpVerificationDisplay (M15 rejected field-state)', () => {
  it('returns the rejected state with the head-contractor reason', () => {
    expect(
      getItpVerificationDisplay(
        completion({
          isRejected: true,
          verificationStatus: 'rejected',
          verificationNotes: 'Photo does not show the bedding layer',
        }),
      ),
    ).toEqual({
      tone: 'rejected',
      label: 'Rejected',
      rejectionReason: 'Photo does not show the bedding layer',
    });
  });

  it('returns a null reason for a rejected item with no recorded note', () => {
    expect(
      getItpVerificationDisplay(completion({ isRejected: true, verificationNotes: null })),
    ).toEqual({ tone: 'rejected', label: 'Rejected', rejectionReason: null });
  });

  it('returns the pending-verification state', () => {
    expect(getItpVerificationDisplay(completion({ isPendingVerification: true }))).toEqual({
      tone: 'pending',
      label: 'Pending verification',
      rejectionReason: null,
    });
  });

  it('returns the verified state', () => {
    expect(getItpVerificationDisplay(completion({ isVerified: true }))).toEqual({
      tone: 'verified',
      label: 'Verified',
      rejectionReason: null,
    });
  });

  it('prioritises the rejected state over a stale verified flag', () => {
    expect(
      getItpVerificationDisplay(
        completion({ isRejected: true, isVerified: true, verificationNotes: 'Redo it' }),
      ),
    ).toEqual({ tone: 'rejected', label: 'Rejected', rejectionReason: 'Redo it' });
  });

  it('returns null when the item is not in a verification workflow', () => {
    expect(getItpVerificationDisplay(completion())).toBeNull();
  });

  it('returns null when there is no completion', () => {
    expect(getItpVerificationDisplay(undefined)).toBeNull();
  });
});

describe('canReviewItpByRole (H4)', () => {
  it('allows the head-contractor verification roles', () => {
    for (const role of [
      'owner',
      'admin',
      'project_manager',
      'quality_manager',
      'site_manager',
      'superintendent',
    ]) {
      expect(canReviewItpByRole(role)).toBe(true);
    }
  });

  it('rejects field/subcontractor roles and empty values', () => {
    for (const role of ['foreman', 'site_engineer', 'subcontractor', 'subcontractor_admin', '']) {
      expect(canReviewItpByRole(role)).toBe(false);
    }
    expect(canReviewItpByRole(null)).toBe(false);
    expect(canReviewItpByRole(undefined)).toBe(false);
  });
});

describe('canReviewItpItem (H4 verify/reject gating)', () => {
  it('permits review of a pending-verification item by a different user with a review role', () => {
    expect(
      canReviewItpItem({
        canReviewByRole: true,
        currentUserId: 'verifier-1',
        completion: completion({
          isPendingVerification: true,
          completedBy: { id: 'subbie-1', fullName: 'Sub Bie', email: 's@x.test' },
        }),
      }),
    ).toBe(true);
  });

  it('blocks review when the reviewer completed the item themselves (assertDifferentVerifier)', () => {
    expect(
      canReviewItpItem({
        canReviewByRole: true,
        currentUserId: 'verifier-1',
        completion: completion({
          isPendingVerification: true,
          completedBy: { id: 'verifier-1', fullName: 'Same Person', email: 'v@x.test' },
        }),
      }),
    ).toBe(false);
  });

  it('blocks review without a verification role', () => {
    expect(
      canReviewItpItem({
        canReviewByRole: false,
        currentUserId: 'verifier-1',
        completion: completion({
          isPendingVerification: true,
          completedBy: { id: 'subbie-1', fullName: 'Sub Bie', email: 's@x.test' },
        }),
      }),
    ).toBe(false);
  });

  it('blocks review of an item that is not pending verification', () => {
    expect(
      canReviewItpItem({
        canReviewByRole: true,
        currentUserId: 'verifier-1',
        completion: completion({ isVerified: true }),
      }),
    ).toBe(false);
    expect(
      canReviewItpItem({
        canReviewByRole: true,
        currentUserId: 'verifier-1',
        completion: completion({ isRejected: true }),
      }),
    ).toBe(false);
  });

  it('blocks review when there is no completion', () => {
    expect(
      canReviewItpItem({
        canReviewByRole: true,
        currentUserId: 'verifier-1',
        completion: undefined,
      }),
    ).toBe(false);
  });
});
