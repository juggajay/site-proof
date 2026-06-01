import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  buildHoldPointEvidenceChecklist,
  buildHoldPointEvidenceSummary,
  mapHoldPointEvidenceItpTemplate,
  mapHoldPointEvidenceLot,
  mapHoldPointEvidencePhotos,
  mapHoldPointEvidenceProject,
  mapHoldPointEvidenceTestResults,
  type EvidenceChecklistItemInput,
  type EvidenceCompletionInput,
  type EvidenceDocumentInput,
  type EvidenceTestResultInput,
} from './evidencePackage.js';

/**
 * Characterizes the pure hold-point evidence-package presentation helpers
 * extracted verbatim from backend/src/routes/holdpoints.ts. These freeze the
 * field names, status derivations (isCompleted/isVerified/isVerified-from-status),
 * the sequence-number cutoff (<= the hold point), attachment/photo mapping, the
 * summary counts, and the lot/project/template header selection.
 *
 * All inputs are plain fixtures — no database. Date and Decimal values are passed
 * through untouched, so assertions compare the same instances (no formatting →
 * no timezone fragility).
 */

const COMPLETED_AT = new Date('2026-03-01T02:00:00.000Z');
const VERIFIED_AT = new Date('2026-03-02T02:00:00.000Z');
const CREATED_AT = new Date('2026-03-03T02:00:00.000Z');
const UPLOADED_AT = new Date('2026-03-04T02:00:00.000Z');

const items: EvidenceChecklistItemInput[] = [
  {
    id: 'i1',
    sequenceNumber: 1,
    description: 'Item 1',
    pointType: 'standard',
    responsibleParty: 'contractor',
  },
  {
    id: 'i2',
    sequenceNumber: 2,
    description: 'Hold Point',
    pointType: 'hold_point',
    responsibleParty: 'contractor',
  },
  {
    id: 'i3',
    sequenceNumber: 3,
    description: 'After HP',
    pointType: 'standard',
    responsibleParty: 'contractor',
  },
];

describe('buildHoldPointEvidenceChecklist', () => {
  it('includes items up to and including the hold-point sequence number, and maps completion status + attachments', () => {
    const completions: EvidenceCompletionInput[] = [
      {
        checklistItemId: 'i1',
        status: 'completed',
        completedAt: COMPLETED_AT,
        completedBy: { fullName: 'Alice' },
        verificationStatus: 'verified',
        verifiedAt: VERIFIED_AT,
        verifiedBy: { fullName: 'Bob' },
        notes: 'looks good',
        attachments: [
          {
            id: 'a1',
            document: { filename: 'photo.jpg', fileUrl: 'https://x/photo.jpg', caption: 'cap' },
          },
        ],
      },
    ];

    const result = buildHoldPointEvidenceChecklist(items, completions, 2);

    expect(result).toHaveLength(2); // i3 (seq 3) is excluded
    expect(result[0]).toEqual({
      sequenceNumber: 1,
      description: 'Item 1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      isCompleted: true,
      completedAt: COMPLETED_AT,
      completedBy: 'Alice',
      isVerified: true,
      verifiedAt: VERIFIED_AT,
      verifiedBy: 'Bob',
      notes: 'looks good',
      attachments: [
        { id: 'a1', filename: 'photo.jpg', fileUrl: 'https://x/photo.jpg', caption: 'cap' },
      ],
    });
  });

  it('defaults cleanly for an item with no completion', () => {
    const result = buildHoldPointEvidenceChecklist(items, [], 2);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      sequenceNumber: 2,
      description: 'Hold Point',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      isCompleted: false,
      completedAt: undefined,
      completedBy: null,
      isVerified: false,
      verifiedAt: undefined,
      verifiedBy: null,
      notes: undefined,
      attachments: [],
    });
  });

  it('treats non-"completed"/non-"verified" statuses as false and missing names/attachments as null/[]', () => {
    const completions: EvidenceCompletionInput[] = [
      {
        checklistItemId: 'i1',
        status: 'in_progress',
        completedAt: null,
        completedBy: null,
        verificationStatus: 'none',
        verifiedAt: null,
        verifiedBy: null,
        notes: null,
        attachments: null,
      },
    ];

    const [entry] = buildHoldPointEvidenceChecklist(items, completions, 1);

    expect(entry.isCompleted).toBe(false);
    expect(entry.isVerified).toBe(false);
    expect(entry.completedBy).toBeNull();
    expect(entry.verifiedBy).toBeNull();
    expect(entry.attachments).toEqual([]);
  });
});

describe('mapHoldPointEvidenceTestResults', () => {
  it('maps fields and derives isVerified from status', () => {
    const testResults: EvidenceTestResultInput[] = [
      {
        id: 't1',
        testType: 'compaction',
        testRequestNumber: 'TR-1',
        laboratoryName: 'Lab A',
        resultValue: null,
        resultUnit: '%',
        passFail: 'pass',
        status: 'verified',
        verifiedBy: { fullName: 'Vera' },
        createdAt: CREATED_AT,
      },
      {
        id: 't2',
        testType: 'slump',
        testRequestNumber: null,
        laboratoryName: null,
        resultValue: null,
        resultUnit: null,
        passFail: 'fail',
        status: 'requested',
        verifiedBy: null,
        createdAt: CREATED_AT,
      },
    ];

    const result = mapHoldPointEvidenceTestResults(testResults);

    expect(result).toEqual([
      {
        id: 't1',
        testType: 'compaction',
        testRequestNumber: 'TR-1',
        laboratoryName: 'Lab A',
        resultValue: null,
        resultUnit: '%',
        passFail: 'pass',
        status: 'verified',
        isVerified: true,
        verifiedBy: 'Vera',
        createdAt: CREATED_AT,
      },
      {
        id: 't2',
        testType: 'slump',
        testRequestNumber: null,
        laboratoryName: null,
        resultValue: null,
        resultUnit: null,
        passFail: 'fail',
        status: 'requested',
        isVerified: false,
        verifiedBy: null,
        createdAt: CREATED_AT,
      },
    ]);
  });

  it('passes a Decimal resultValue through untouched (same instance)', () => {
    const resultValue = new Prisma.Decimal('7.25');
    const [mapped] = mapHoldPointEvidenceTestResults([
      {
        id: 't3',
        testType: 'density',
        testRequestNumber: null,
        laboratoryName: null,
        resultValue,
        resultUnit: 't/m3',
        passFail: 'pass',
        status: 'verified',
        verifiedBy: null,
        createdAt: CREATED_AT,
      },
    ]);

    expect(mapped.resultValue).toBe(resultValue);
  });
});

describe('mapHoldPointEvidencePhotos', () => {
  it('maps the document fields used by the evidence package', () => {
    const documents: EvidenceDocumentInput[] = [
      {
        id: 'd1',
        filename: 'site.jpg',
        fileUrl: 'https://x/site.jpg',
        caption: null,
        uploadedAt: UPLOADED_AT,
      },
    ];

    expect(mapHoldPointEvidencePhotos(documents)).toEqual([
      {
        id: 'd1',
        filename: 'site.jpg',
        fileUrl: 'https://x/site.jpg',
        caption: null,
        uploadedAt: UPLOADED_AT,
      },
    ]);
  });
});

describe('buildHoldPointEvidenceSummary', () => {
  it('counts checklist completion/verification, attachments, tests, passing tests, and photos', () => {
    const checklist = [
      { isCompleted: true, isVerified: true, attachments: [{ id: 'a' }, { id: 'b' }] },
      { isCompleted: true, isVerified: false, attachments: [] },
      { isCompleted: false, isVerified: false, attachments: [{ id: 'c' }] },
    ] as unknown as Parameters<typeof buildHoldPointEvidenceSummary>[0];
    const testResults = [
      { passFail: 'pass' },
      { passFail: 'fail' },
      { passFail: 'pass' },
    ] as unknown as Parameters<typeof buildHoldPointEvidenceSummary>[1];
    const photos = [{ id: 'p1' }, { id: 'p2' }] as unknown as Parameters<
      typeof buildHoldPointEvidenceSummary
    >[2];

    expect(buildHoldPointEvidenceSummary(checklist, testResults, photos)).toEqual({
      totalChecklistItems: 3,
      completedItems: 2,
      verifiedItems: 1,
      totalTestResults: 3,
      passingTests: 2,
      totalPhotos: 2,
      totalAttachments: 3,
    });
  });
});

describe('header mappers', () => {
  it('mapHoldPointEvidenceLot selects only the package lot fields', () => {
    const chainageStart = new Prisma.Decimal('100.0');
    const lot = {
      id: 'lot-1',
      lotNumber: 'L-001',
      description: 'Lot one',
      activityType: 'earthworks',
      chainageStart,
      chainageEnd: null,
      // extra fields that must be dropped:
      projectId: 'proj-1',
      status: 'open',
    } as unknown as Parameters<typeof mapHoldPointEvidenceLot>[0];

    const mapped = mapHoldPointEvidenceLot(lot);

    expect(mapped).toEqual({
      id: 'lot-1',
      lotNumber: 'L-001',
      description: 'Lot one',
      activityType: 'earthworks',
      chainageStart,
      chainageEnd: null,
    });
    expect(mapped).not.toHaveProperty('projectId');
    expect(mapped.chainageStart).toBe(chainageStart); // Decimal passed through
  });

  it('mapHoldPointEvidenceProject selects id/name/projectNumber', () => {
    expect(
      mapHoldPointEvidenceProject({ id: 'p1', name: 'Highway', projectNumber: 'PRJ-9' }),
    ).toEqual({ id: 'p1', name: 'Highway', projectNumber: 'PRJ-9' });
  });

  it('mapHoldPointEvidenceItpTemplate selects id/name/activityType (nullable)', () => {
    expect(
      mapHoldPointEvidenceItpTemplate({ id: 'tpl1', name: 'Subgrade ITP', activityType: null }),
    ).toEqual({ id: 'tpl1', name: 'Subgrade ITP', activityType: null });
  });
});
