import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  buildHoldPointEvidencePhotoDocuments,
  buildHoldPointEvidenceChecklist,
  buildHoldPointEvidenceChecklistItemIdSet,
  buildHoldPointEvidencePackageResponse,
  buildHoldPointEvidenceSummary,
  buildPublicHoldPointEvidencePackageResponse,
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
            document: {
              id: 'd1',
              filename: 'photo.jpg',
              fileUrl: 'https://x/photo.jpg',
              caption: 'cap',
              uploadedAt: UPLOADED_AT,
            },
          },
        ],
      },
    ];

    const result = buildHoldPointEvidenceChecklist(items, completions, 2);

    expect(result).toHaveLength(2); // i3 (seq 3) is excluded
    expect(result[0]).toEqual({
      itpChecklistItemId: 'i1',
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
        {
          id: 'a1',
          documentId: 'd1',
          filename: 'photo.jpg',
          fileUrl: 'https://x/photo.jpg',
          caption: 'cap',
        },
      ],
    });
  });

  it('defaults cleanly for an item with no completion', () => {
    const result = buildHoldPointEvidenceChecklist(items, [], 2);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      itpChecklistItemId: 'i2',
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

describe('hold point evidence-package response helpers', () => {
  it('wraps authenticated and preview evidence packages and strips raw storage locators', () => {
    const evidencePackage = {
      holdPoint: { id: 'hp-1' },
      generatedAt: '2026-06-01T00:00:00Z',
      checklist: [
        {
          sequenceNumber: 1,
          attachments: [
            {
              id: 'att-1',
              documentId: 'doc-1',
              filename: 'release-photo.jpg',
              fileUrl: 'supabase://documents/project-id/release-photo.jpg',
              caption: 'release evidence',
            },
          ],
        },
      ],
      photos: [
        {
          id: 'photo-1',
          filename: 'release-photo.jpg',
          fileUrl: 'https://storage.example.com/public/release-photo.jpg',
          caption: 'release evidence',
          uploadedAt: UPLOADED_AT,
        },
      ],
    };

    expect(buildHoldPointEvidencePackageResponse(evidencePackage)).toEqual({
      evidencePackage: {
        holdPoint: { id: 'hp-1' },
        generatedAt: '2026-06-01T00:00:00Z',
        checklist: [
          {
            sequenceNumber: 1,
            attachments: [
              {
                id: 'att-1',
                documentId: 'doc-1',
                filename: 'release-photo.jpg',
                caption: 'release evidence',
              },
            ],
          },
        ],
        photos: [
          {
            id: 'photo-1',
            filename: 'release-photo.jpg',
            caption: 'release evidence',
            uploadedAt: UPLOADED_AT,
          },
        ],
      },
    });
    expect(evidencePackage.checklist[0].attachments[0].fileUrl).toBe(
      'supabase://documents/project-id/release-photo.jpg',
    );
    expect(evidencePackage.photos[0].fileUrl).toBe(
      'https://storage.example.com/public/release-photo.jpg',
    );
  });

  it('wraps public evidence packages with token info and the public marker', () => {
    const evidencePackage = { holdPoint: { id: 'hp-2' } };
    const tokenInfo = { recipientEmail: 'qa@example.com', canRelease: true };

    expect(buildPublicHoldPointEvidencePackageResponse(evidencePackage, tokenInfo)).toEqual({
      evidencePackage,
      tokenInfo,
      isPublicAccess: true,
    });
  });

  it('strips raw storage locators from public checklist attachments and photos', () => {
    const evidencePackage = {
      holdPoint: { id: 'hp-3' },
      checklist: [
        {
          sequenceNumber: 1,
          attachments: [
            {
              id: 'att-1',
              documentId: 'doc-1',
              filename: 'release-photo.jpg',
              fileUrl: 'supabase://documents/project-id/release-photo.jpg',
              caption: 'release evidence',
            },
          ],
        },
      ],
      photos: [
        {
          id: 'photo-1',
          filename: 'release-photo.jpg',
          fileUrl: 'https://storage.example.com/public/release-photo.jpg',
          caption: 'release evidence',
          uploadedAt: UPLOADED_AT,
        },
      ],
    };
    const tokenInfo = { recipientEmail: 'qa@example.com', canRelease: true };

    expect(buildPublicHoldPointEvidencePackageResponse(evidencePackage, tokenInfo)).toEqual({
      evidencePackage: {
        holdPoint: { id: 'hp-3' },
        checklist: [
          {
            sequenceNumber: 1,
            attachments: [
              {
                id: 'att-1',
                documentId: 'doc-1',
                filename: 'release-photo.jpg',
                caption: 'release evidence',
              },
            ],
          },
        ],
        photos: [
          {
            id: 'photo-1',
            filename: 'release-photo.jpg',
            caption: 'release evidence',
            uploadedAt: UPLOADED_AT,
          },
        ],
      },
      tokenInfo,
      isPublicAccess: true,
    });
    expect(evidencePackage.checklist[0].attachments[0].fileUrl).toBe(
      'supabase://documents/project-id/release-photo.jpg',
    );
    expect(evidencePackage.photos[0].fileUrl).toBe(
      'https://storage.example.com/public/release-photo.jpg',
    );
  });
});

describe('mapHoldPointEvidenceTestResults', () => {
  it('excludes test results outside the hold-point checklist boundary', () => {
    const result = mapHoldPointEvidenceTestResults(
      [
        {
          id: 'inside',
          testType: 'compaction',
          testRequestNumber: null,
          laboratoryName: null,
          resultValue: null,
          resultUnit: null,
          passFail: 'pass',
          status: 'verified',
          verifiedBy: null,
          createdAt: CREATED_AT,
          itpChecklistItemId: 'item-before-hp',
        },
        {
          id: 'outside',
          testType: 'slump',
          testRequestNumber: null,
          laboratoryName: null,
          resultValue: null,
          resultUnit: null,
          passFail: 'pass',
          status: 'verified',
          verifiedBy: null,
          createdAt: CREATED_AT,
          itpChecklistItemId: 'item-after-hp',
        },
        {
          id: 'lot-level',
          testType: 'general',
          testRequestNumber: null,
          laboratoryName: null,
          resultValue: null,
          resultUnit: null,
          passFail: 'pass',
          status: 'verified',
          verifiedBy: null,
          createdAt: CREATED_AT,
          itpChecklistItemId: null,
        },
      ],
      { includedChecklistItemIds: new Set(['item-before-hp']) },
    );

    expect(result.map((item) => item.id)).toEqual(['inside']);
  });

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
  it('maps only completion attachment photos inside the hold-point checklist boundary', () => {
    const documents = buildHoldPointEvidencePhotoDocuments([
      {
        checklistItemId: 'item-before-hp',
        status: 'completed',
        completedAt: COMPLETED_AT,
        completedBy: null,
        verificationStatus: 'verified',
        verifiedAt: VERIFIED_AT,
        verifiedBy: null,
        notes: null,
        attachments: [
          {
            id: 'att-inside',
            document: {
              id: 'doc-inside',
              filename: 'inside.jpg',
              fileUrl: 'https://x/inside.jpg',
              caption: 'inside',
              uploadedAt: UPLOADED_AT,
            },
          },
        ],
      },
      {
        checklistItemId: 'item-after-hp',
        status: 'completed',
        completedAt: COMPLETED_AT,
        completedBy: null,
        verificationStatus: 'verified',
        verifiedAt: VERIFIED_AT,
        verifiedBy: null,
        notes: null,
        attachments: [
          {
            id: 'att-outside',
            document: {
              id: 'doc-outside',
              filename: 'outside.jpg',
              fileUrl: 'https://x/outside.jpg',
              caption: 'outside',
              uploadedAt: UPLOADED_AT,
            },
          },
        ],
      },
    ]);

    const result = mapHoldPointEvidencePhotos(documents, {
      includedChecklistItemIds: new Set(['item-before-hp']),
    });

    expect(result).toEqual([
      {
        id: 'doc-inside',
        filename: 'inside.jpg',
        fileUrl: 'https://x/inside.jpg',
        caption: 'inside',
        uploadedAt: UPLOADED_AT,
      },
    ]);
  });

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
  it('buildHoldPointEvidenceChecklistItemIdSet returns ids up to and including the hold point', () => {
    expect(Array.from(buildHoldPointEvidenceChecklistItemIdSet(items, 2))).toEqual(['i1', 'i2']);
  });

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

  it('mapHoldPointEvidenceProject selects id/name/projectNumber', async () => {
    expect(
      await mapHoldPointEvidenceProject({ id: 'p1', name: 'Highway', projectNumber: 'PRJ-9' }),
    ).toEqual({ id: 'p1', name: 'Highway', projectNumber: 'PRJ-9' });
  });

  it('mapHoldPointEvidenceProject includes display-safe company branding when present', async () => {
    expect(
      await mapHoldPointEvidenceProject({
        id: 'p1',
        name: 'Highway',
        projectNumber: 'PRJ-9',
        company: {
          id: 'company-1',
          name: 'Gateway Civil Pty Ltd',
          abn: '12 345 678 901',
          address: '1 Haul Rd, Sydney NSW',
          logoUrl: 'https://cdn.example.com/gateway-logo.png',
        },
      }),
    ).toEqual({
      id: 'p1',
      name: 'Highway',
      projectNumber: 'PRJ-9',
      company: {
        name: 'Gateway Civil Pty Ltd',
        abn: '12 345 678 901',
        address: '1 Haul Rd, Sydney NSW',
        logoUrl: 'https://cdn.example.com/gateway-logo.png',
      },
    });
    // Companies without ABN/address serialize explicit nulls (PDF-side treats
    // them as absent).
    expect(
      await mapHoldPointEvidenceProject({
        id: 'p1',
        name: 'Highway',
        projectNumber: 'PRJ-9',
        company: {
          id: 'company-1',
          name: 'Gateway Civil Pty Ltd',
          logoUrl: 'https://cdn.example.com/gateway-logo.png',
        },
      }),
    ).toEqual({
      id: 'p1',
      name: 'Highway',
      projectNumber: 'PRJ-9',
      company: {
        name: 'Gateway Civil Pty Ltd',
        abn: null,
        address: null,
        logoUrl: 'https://cdn.example.com/gateway-logo.png',
      },
    });
  });

  it('mapHoldPointEvidenceItpTemplate selects id/name/activityType (nullable)', () => {
    expect(
      mapHoldPointEvidenceItpTemplate({ id: 'tpl1', name: 'Subgrade ITP', activityType: null }),
    ).toEqual({ id: 'tpl1', name: 'Subgrade ITP', activityType: null });
  });
});
