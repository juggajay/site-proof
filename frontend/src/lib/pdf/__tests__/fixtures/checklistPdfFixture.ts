import type { ChecklistPdfData } from '../../../pdfGenerator';

/**
 * One lot's checklist covering every cell state the printed output can render:
 * a completed+verified standard row, a not-applicable row, a released hold
 * point (the only row whose authority cell is live and signed), an unreleased
 * witness point (authority cell live and empty), and an outstanding row with an
 * NCR against it. Two people sign, so the abbreviation key has two entries.
 */
export const mixedStateChecklistFixture: ChecklistPdfData = {
  company: {
    name: 'Gateway Civil Pty Ltd',
    abn: '11 222 333 444',
    address: '5 Depot Road, Newcastle NSW',
    logoUrl: null,
  },
  project: {
    name: 'Pacific Highway Upgrade',
    projectNumber: 'PHU-001',
  },
  lot: {
    lotNumber: 'EW-001',
    description: 'Bulk earthworks to subgrade level',
    activityType: 'Earthworks',
    chainageStart: 100,
    chainageEnd: 350,
    layer: 'Subgrade',
    areaZone: 'Zone A',
  },
  itp: {
    templateName: 'Earthworks ITP - Subgrade',
    specificationReference: 'MRTS04 Cl. 8.3',
    checklistItems: [
      {
        id: 'item-1',
        order: 1,
        description: 'Strip topsoil and stockpile clear of the works',
        category: 'earthworks',
        responsibleParty: 'contractor',
        pointType: 'standard',
        isHoldPoint: false,
        evidenceRequired: 'photo',
        acceptanceCriteria: '150mm minimum strip depth',
        testType: null,
      },
      {
        id: 'item-2',
        order: 2,
        description: 'Proof roll the subgrade in the presence of the Superintendent',
        category: 'earthworks',
        responsibleParty: 'contractor',
        pointType: 'hold_point',
        isHoldPoint: true,
        evidenceRequired: 'photo',
        acceptanceCriteria: 'No visible deflection or pumping',
        testType: null,
      },
      {
        id: 'item-3',
        order: 3,
        description: 'Density testing of the compacted layer',
        category: 'testing',
        responsibleParty: 'contractor',
        pointType: 'witness',
        isHoldPoint: false,
        evidenceRequired: 'test',
        acceptanceCriteria: '95% RDD',
        testType: 'Insitu Dry Density (Sand Replacement)',
      },
      {
        id: 'item-4',
        order: 4,
        description: 'Trim subgrade to design level and crossfall',
        category: 'earthworks',
        responsibleParty: 'contractor',
        pointType: 'standard',
        isHoldPoint: false,
        evidenceRequired: 'none',
        acceptanceCriteria: null,
        testType: null,
      },
      {
        id: 'item-5',
        order: 5,
        description: 'Batter slopes trimmed to design profile',
        category: 'earthworks',
        responsibleParty: 'subcontractor',
        pointType: 'standard',
        isHoldPoint: false,
        evidenceRequired: 'photo',
        acceptanceCriteria: null,
        testType: null,
      },
    ],
    completions: [
      {
        checklistItemId: 'item-1',
        isCompleted: true,
        notes: null,
        completedAt: '2026-05-20T04:00:00.000Z',
        completedBy: { fullName: 'Amos Soo', email: 'amos@example.com' },
        isVerified: true,
        verifiedAt: '2026-05-20T06:00:00.000Z',
        verifiedBy: { fullName: 'Jordan Surveyor', email: 'jordan@example.com' },
      },
      {
        checklistItemId: 'item-2',
        isCompleted: true,
        notes: null,
        completedAt: '2026-05-21T04:00:00.000Z',
        completedBy: { fullName: 'Amos Soo', email: 'amos@example.com' },
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        holdPointRelease: {
          releasedByName: 'Priya Nair',
          releasedByOrg: 'Transport for NSW',
          releaseMethod: 'secure_link',
          releasedAt: '2026-05-21T23:00:00.000Z',
        },
      },
      {
        checklistItemId: 'item-3',
        isCompleted: false,
        notes: null,
        completedAt: null,
        completedBy: null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
      },
      {
        checklistItemId: 'item-4',
        isCompleted: false,
        isNotApplicable: true,
        notes: 'Trimmed under LOT EW-002',
        completedAt: '2026-05-22T04:00:00.000Z',
        completedBy: { fullName: 'Amos Soo', email: 'amos@example.com' },
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
      },
      {
        checklistItemId: 'item-5',
        isCompleted: false,
        notes: null,
        completedAt: null,
        completedBy: null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        linkedNcr: { ncrNumber: 'NCR-0021' },
      },
    ],
  },
};

/** A lot whose template was assigned but never worked. */
export const emptyChecklistFixture: ChecklistPdfData = {
  ...mixedStateChecklistFixture,
  itp: {
    templateName: 'Earthworks ITP - Subgrade',
    specificationReference: null,
    checklistItems: [],
    completions: [],
  },
};

/**
 * The provenance cases a real evidence pack hits and a happy-path fixture
 * never does: a deleted user (completion survives, `completedBy` does not), a
 * Unicode name, a hold point released through the public token page with no
 * captured name, a failed item, and one awaiting verification.
 */
export const provenanceChecklistFixture: ChecklistPdfData = {
  ...mixedStateChecklistFixture,
  itp: {
    templateName: 'Drainage ITP - Pipe Laying',
    specificationReference: null,
    checklistItems: [
      {
        id: 'p-1',
        order: 1,
        description: 'Bedding placed and compacted',
        category: 'drainage',
        responsibleParty: 'contractor',
        pointType: 'standard',
        isHoldPoint: false,
        evidenceRequired: 'photo',
        acceptanceCriteria: null,
        testType: null,
      },
      {
        id: 'p-2',
        order: 2,
        description: 'Pipe invert level survey',
        category: 'drainage',
        responsibleParty: 'contractor',
        pointType: 'standard',
        isHoldPoint: false,
        evidenceRequired: 'none',
        acceptanceCriteria: '±10mm of design invert',
        testType: null,
      },
      {
        id: 'p-3',
        order: 3,
        description: 'Backfill inspection before cover',
        category: 'drainage',
        responsibleParty: 'contractor',
        pointType: 'hold_point',
        isHoldPoint: true,
        evidenceRequired: 'photo',
        acceptanceCriteria: 'Compaction certificate sighted',
        testType: null,
      },
      {
        id: 'p-4',
        order: 4,
        description: 'Pit benching and rendering',
        category: 'drainage',
        responsibleParty: 'contractor',
        pointType: 'standard',
        isHoldPoint: false,
        evidenceRequired: 'photo',
        acceptanceCriteria: 'Smooth flow path, no ponding',
        testType: null,
      },
    ],
    completions: [
      // Deleted user: the completion outlived the account.
      {
        checklistItemId: 'p-1',
        isCompleted: true,
        notes: null,
        completedAt: '2026-05-20T04:00:00.000Z',
        completedBy: null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
      },
      // Unicode name, and awaiting a second pair of eyes.
      {
        checklistItemId: 'p-2',
        isCompleted: true,
        isPendingVerification: true,
        verificationStatus: 'pending_verification',
        notes: null,
        completedAt: '2026-05-20T05:00:00.000Z',
        completedBy: { fullName: 'Åsa Ødegård-Ruiz', email: 'asa@example.com' },
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
      },
      // Token release: no CIVOS account behind it, and no name captured.
      {
        checklistItemId: 'p-3',
        isCompleted: true,
        notes: null,
        completedAt: '2026-05-21T04:00:00.000Z',
        completedBy: { fullName: '李明', email: 'liming@example.com' },
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        holdPointRelease: {
          releasedByName: null,
          releasedByOrg: null,
          releaseMethod: 'secure_link',
          releasedAt: '2026-05-21T23:00:00.000Z',
        },
      },
      // Failed, then rejected at verification.
      {
        checklistItemId: 'p-4',
        isCompleted: false,
        isFailed: true,
        isRejected: true,
        verificationStatus: 'rejected',
        notes: 'Ponding at the outlet',
        completedAt: '2026-05-22T04:00:00.000Z',
        completedBy: { fullName: 'Amos Soo', email: 'amos@example.com' },
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
      },
    ],
  },
};

/** 60 items — forces page breaks and a repeated column header. */
export const longChecklistFixture: ChecklistPdfData = {
  ...mixedStateChecklistFixture,
  itp: {
    templateName: 'Structures ITP - Bridge Deck',
    specificationReference: 'MRTS70',
    checklistItems: Array.from({ length: 60 }, (_, index) => ({
      id: `long-${index + 1}`,
      order: index + 1,
      description: `Inspection step ${index + 1} — verify the works comply with the specification clause governing this activity before proceeding to the next stage`,
      category: 'structures',
      responsibleParty: 'contractor',
      pointType: index % 10 === 0 ? 'hold_point' : 'standard',
      isHoldPoint: index % 10 === 0,
      evidenceRequired: index % 3 === 0 ? 'photo' : 'none',
      acceptanceCriteria: index % 2 === 0 ? `Tolerance band ${index + 1}` : null,
      testType: null,
    })),
    completions: Array.from({ length: 30 }, (_, index) => ({
      checklistItemId: `long-${index + 1}`,
      isCompleted: true,
      notes: null,
      completedAt: '2026-05-20T04:00:00.000Z',
      completedBy: { fullName: 'Amos Soo', email: 'amos@example.com' },
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
    })),
  },
};
