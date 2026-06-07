import { describe, expect, it } from 'vitest';
import {
  buildHoldPointPrerequisites,
  buildIncompletePrerequisiteDetails,
  getIncompletePrerequisites,
  getPrecedingChecklistItems,
  type PrerequisiteChecklistItem,
  type PrerequisiteCompletion,
} from './prerequisites.js';

/**
 * Characterizes the pure hold-point prerequisite helpers extracted verbatim from
 * backend/src/routes/holdpoints.ts (the GET /lot/:lotId/item/:itemId prerequisite
 * report and the POST /request-release prerequisite gate). These freeze the strict
 * `<` sequence cutoff, the completion-status derivations, the "incomplete = not
 * completed (a missing completion counts)" rule, and the trimmed error-details
 * shape. All inputs are plain fixtures — no database. The single Date is passed
 * through untouched, so its assertion is timezone-independent.
 */

const COMPLETED_AT = new Date('2026-03-01T02:00:00.000Z');

const items: PrerequisiteChecklistItem[] = [
  { id: 'i1', description: 'First', sequenceNumber: 1, pointType: 'standard' },
  { id: 'i2', description: 'Witness', sequenceNumber: 2, pointType: 'witness_point' },
  { id: 'i3', description: 'Earlier HP', sequenceNumber: 3, pointType: 'hold_point' },
  { id: 'i4', description: 'Target HP', sequenceNumber: 4, pointType: 'hold_point' },
];

describe('getPrecedingChecklistItems', () => {
  it('includes only items strictly before the hold-point sequence number', () => {
    const preceding = getPrecedingChecklistItems(items, 4);

    expect(preceding.map((i) => i.id)).toEqual(['i1', 'i2', 'i3']); // i4 (== 4) excluded
  });

  it('excludes the hold-point item itself and anything after it', () => {
    const preceding = getPrecedingChecklistItems(items, 3);

    expect(preceding.map((i) => i.id)).toEqual(['i1', 'i2']); // i3 (== 3) and i4 (> 3) excluded
  });

  it('returns an empty list when the hold point is first', () => {
    expect(getPrecedingChecklistItems(items, 1)).toEqual([]);
  });
});

describe('buildHoldPointPrerequisites', () => {
  it('maps isCompleted, isNotApplicable, isVerified, completedAt, and isHoldPoint exactly', () => {
    const preceding = getPrecedingChecklistItems(items, 4);
    const completions: PrerequisiteCompletion[] = [
      {
        checklistItemId: 'i1',
        status: 'completed',
        verificationStatus: 'verified',
        completedAt: COMPLETED_AT,
      },
      {
        checklistItemId: 'i2',
        status: 'in_progress',
        verificationStatus: 'none',
        completedAt: null,
      },
      // i3 has no completion at all
    ];

    const prerequisites = buildHoldPointPrerequisites(preceding, completions);

    expect(prerequisites).toEqual([
      {
        id: 'i1',
        description: 'First',
        sequenceNumber: 1,
        isHoldPoint: false,
        isCompleted: true,
        isNotApplicable: false,
        isVerified: true,
        completedAt: COMPLETED_AT,
      },
      {
        id: 'i2',
        description: 'Witness',
        sequenceNumber: 2,
        isHoldPoint: false,
        isCompleted: false,
        isNotApplicable: false,
        isVerified: false,
        completedAt: null,
      },
      {
        id: 'i3',
        description: 'Earlier HP',
        sequenceNumber: 3,
        isHoldPoint: true, // pointType === 'hold_point'
        isCompleted: false,
        isNotApplicable: false,
        isVerified: false,
        completedAt: undefined, // no completion record
      },
    ]);
  });

  it('marks an N/A completion as isNotApplicable (and not isCompleted)', () => {
    const preceding = getPrecedingChecklistItems(items, 4);
    const completions: PrerequisiteCompletion[] = [
      {
        checklistItemId: 'i1',
        status: 'not_applicable',
        verificationStatus: 'none',
        completedAt: COMPLETED_AT,
      },
    ];

    const [first] = buildHoldPointPrerequisites(preceding, completions);

    expect(first.isCompleted).toBe(false);
    expect(first.isNotApplicable).toBe(true);
  });
});

describe('getIncompletePrerequisites', () => {
  it('includes items with no completion and items that are not completed, and excludes completed ones', () => {
    const preceding = getPrecedingChecklistItems(items, 4);
    const completions: PrerequisiteCompletion[] = [
      {
        checklistItemId: 'i1',
        status: 'completed',
        verificationStatus: 'verified',
        completedAt: COMPLETED_AT,
      },
      // i2 missing entirely
      {
        checklistItemId: 'i3',
        status: 'pending',
        verificationStatus: 'none',
        completedAt: null,
      },
    ];

    const prerequisites = buildHoldPointPrerequisites(preceding, completions);
    const incomplete = getIncompletePrerequisites(prerequisites);

    expect(incomplete.map((p) => p.id)).toEqual(['i2', 'i3']); // i1 (completed) excluded
  });

  it('treats an N/A preceding item as satisfied (does not block release)', () => {
    const preceding = getPrecedingChecklistItems(items, 4);
    const completions: PrerequisiteCompletion[] = [
      {
        checklistItemId: 'i1',
        status: 'completed',
        verificationStatus: 'verified',
        completedAt: COMPLETED_AT,
      },
      {
        checklistItemId: 'i2',
        status: 'not_applicable',
        verificationStatus: 'none',
        completedAt: COMPLETED_AT,
      },
      {
        checklistItemId: 'i3',
        status: 'completed',
        verificationStatus: 'verified',
        completedAt: COMPLETED_AT,
      },
    ];

    const prerequisites = buildHoldPointPrerequisites(preceding, completions);

    expect(getIncompletePrerequisites(prerequisites)).toEqual([]); // N/A i2 does not block
  });

  it('still blocks on a failed preceding item', () => {
    const preceding = getPrecedingChecklistItems(items, 4);
    const completions: PrerequisiteCompletion[] = [
      {
        checklistItemId: 'i1',
        status: 'completed',
        verificationStatus: 'verified',
        completedAt: COMPLETED_AT,
      },
      {
        checklistItemId: 'i2',
        status: 'failed',
        verificationStatus: 'none',
        completedAt: COMPLETED_AT,
      },
      {
        checklistItemId: 'i3',
        status: 'not_applicable',
        verificationStatus: 'none',
        completedAt: COMPLETED_AT,
      },
    ];

    const prerequisites = buildHoldPointPrerequisites(preceding, completions);
    const incomplete = getIncompletePrerequisites(prerequisites);

    expect(incomplete.map((p) => p.id)).toEqual(['i2']); // failed i2 blocks; N/A i3 does not
  });
});

describe('buildIncompletePrerequisiteDetails', () => {
  it('keeps only { id, description, sequenceNumber, isHoldPoint } and drops completion fields', () => {
    const preceding = getPrecedingChecklistItems(items, 4);
    const prerequisites = buildHoldPointPrerequisites(preceding, []); // none completed
    const incomplete = getIncompletePrerequisites(prerequisites);

    const details = buildIncompletePrerequisiteDetails(incomplete);

    expect(details).toEqual([
      { id: 'i1', description: 'First', sequenceNumber: 1, isHoldPoint: false },
      { id: 'i2', description: 'Witness', sequenceNumber: 2, isHoldPoint: false },
      { id: 'i3', description: 'Earlier HP', sequenceNumber: 3, isHoldPoint: true },
    ]);
    // completion-only fields must not leak into the error details
    for (const detail of details) {
      expect(detail).not.toHaveProperty('isCompleted');
      expect(detail).not.toHaveProperty('isVerified');
      expect(detail).not.toHaveProperty('completedAt');
    }
  });
});
