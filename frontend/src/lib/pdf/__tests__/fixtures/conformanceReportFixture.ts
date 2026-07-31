import type { ConformanceReportData, HPEvidencePackageData } from '../../../pdfGenerator';

import { releasedHpEvidencePackageFixture } from './holdPointEvidenceFixtures';

/**
 * A conformed lot with the sections the report renders by default. Mirrors the
 * `baseReport` the recorder-mocked suites use, extracted here so the byte
 * regression tests render the same document those suites characterize.
 */
export const conformedLotConformanceFixture: ConformanceReportData = {
  lot: {
    lotNumber: 'LOT-001',
    description: 'Subgrade preparation',
    status: 'conformed',
    activityType: 'Earthworks',
    chainageStart: 100,
    chainageEnd: 250,
    layer: 'Layer 1',
    areaZone: 'Zone A',
    conformedAt: '2026-05-30T00:00:00.000Z',
    conformedBy: { fullName: 'Jane Foreman', email: 'jane@example.com' },
  },
  project: {
    name: 'Pacific Highway Upgrade',
    projectNumber: 'PHU-001',
  },
  itp: {
    templateName: 'Earthworks ITP',
    checklistItems: [
      {
        id: 'item-proof-roll',
        order: 1,
        description: 'Proof roll subgrade',
        category: 'earthworks',
        responsibleParty: 'contractor',
        pointType: 'hold_point',
        isHoldPoint: true,
        evidenceRequired: 'photo',
      },
      {
        id: 'item-survey',
        order: 2,
        description: 'Survey set-out not applicable',
        category: 'survey',
        responsibleParty: 'contractor',
        pointType: 'standard',
        isHoldPoint: false,
        evidenceRequired: 'none',
      },
    ],
    completions: [
      {
        checklistItemId: 'item-proof-roll',
        isCompleted: true,
        notes: null,
        completedAt: '2026-05-30T01:00:00.000Z',
        completedBy: { fullName: 'Riley Foreman', email: 'riley@example.com' },
        isVerified: true,
        verifiedAt: '2026-05-30T02:00:00.000Z',
        verifiedBy: { fullName: 'Quinn Manager', email: 'qm@example.com' },
      },
      {
        checklistItemId: 'item-survey',
        isCompleted: false,
        isNotApplicable: true,
        notes: 'Not applicable to this lot.',
        completedAt: '2026-05-30T01:05:00.000Z',
        completedBy: { fullName: 'Riley Foreman', email: 'riley@example.com' },
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
      },
    ],
  },
  testResults: [
    {
      testType: 'Field Density',
      testRequestNumber: 'TR-900',
      laboratoryName: 'Acme Labs',
      laboratoryReportNumber: 'LR-900',
      resultValue: 98.5,
      resultUnit: '%',
      specificationMin: 95,
      specificationMax: null,
      passFail: 'pass',
      status: 'verified',
      sampleDate: '2026-05-29T00:00:00.000Z',
      resultDate: '2026-05-30T00:00:00.000Z',
    },
  ],
  ncrs: [],
  holdPointReleases: [
    {
      checklistItemDescription: 'Proof roll subgrade',
      releasedAt: '2026-05-30T03:00:00.000Z',
      releasedBy: { fullName: 'Sam Supervisor', email: 'sam@example.com' },
    },
  ],
  photoCount: 2,
};

// ---------------------------------------------------------------------------
// The four hard layout fixtures (spec §4.2 step 4 / program §6 output
// standard): long descriptions, a large ITP, many photographs, and a record
// with every optional value missing. These are the cases the recorder-mocked
// suites structurally cannot see — `pdfTestRecorder.ts:47` fakes text width as
// `length * 2` and `:88` splits only on newlines, so no existing test has ever
// wrapped a line or measured a page break.
// ---------------------------------------------------------------------------

const LONG_SENTENCE =
  'Subgrade prepared, trimmed and proof rolled across the full formation width in accordance with the approved method statement, with all soft spots identified by the proof roll excavated to firm material and replaced with select fill compacted in layers not exceeding 200mm loose thickness.';

/** Every free-text field long enough to wrap several times. */
export const longDescriptionsConformanceFixture: ConformanceReportData = {
  ...conformedLotConformanceFixture,
  lot: {
    ...conformedLotConformanceFixture.lot,
    description: `${LONG_SENTENCE} ${LONG_SENTENCE}`,
  },
  itp: {
    templateName:
      'Earthworks Inspection and Test Plan — Subgrade Preparation, Proof Rolling and Acceptance Testing (Revision C)',
    checklistItems: Array.from({ length: 8 }, (_, index) => ({
      id: `long-item-${index}`,
      order: index + 1,
      description: `${index + 1}. ${LONG_SENTENCE}`,
      category: 'earthworks',
      responsibleParty: 'contractor',
      pointType: index % 3 === 0 ? 'hold_point' : 'standard',
      isHoldPoint: index % 3 === 0,
      evidenceRequired: 'photo',
    })),
    completions: Array.from({ length: 8 }, (_, index) => ({
      checklistItemId: `long-item-${index}`,
      isCompleted: true,
      notes: LONG_SENTENCE,
      completedAt: '2026-05-30T01:00:00.000Z',
      completedBy: { fullName: 'Riley Foreman', email: 'riley@example.com' },
      isVerified: true,
      verifiedAt: '2026-05-30T02:00:00.000Z',
      verifiedBy: { fullName: 'Quinn Manager', email: 'qm@example.com' },
    })),
  },
  ncrs: [
    {
      ncrNumber: 'NCR-0001',
      description: LONG_SENTENCE,
      category: 'workmanship',
      severity: 'major',
      status: 'closed',
      createdAt: '2026-05-28T00:00:00.000Z',
      closedAt: '2026-05-29T00:00:00.000Z',
    },
  ],
};

/** 120 checklist items — the "large ITP" case the program names. */
export const largeItpConformanceFixture: ConformanceReportData = {
  ...conformedLotConformanceFixture,
  itp: {
    templateName: 'Earthworks ITP — full register',
    checklistItems: Array.from({ length: 120 }, (_, index) => ({
      id: `bulk-item-${index}`,
      order: index + 1,
      description: `Inspection point ${index + 1} — verify layer thickness and moisture`,
      category: 'earthworks',
      responsibleParty: 'contractor',
      pointType: index % 10 === 0 ? 'hold_point' : 'standard',
      isHoldPoint: index % 10 === 0,
      evidenceRequired: index % 4 === 0 ? 'test' : 'photo',
    })),
    completions: Array.from({ length: 120 }, (_, index) => ({
      checklistItemId: `bulk-item-${index}`,
      isCompleted: true,
      notes: null,
      completedAt: '2026-05-30T01:00:00.000Z',
      completedBy: { fullName: 'Riley Foreman', email: 'riley@example.com' },
      isVerified: index % 2 === 0,
      verifiedAt: index % 2 === 0 ? '2026-05-30T02:00:00.000Z' : null,
      verifiedBy: index % 2 === 0 ? { fullName: 'Quinn Manager', email: 'qm@example.com' } : null,
    })),
  },
  testResults: Array.from({ length: 40 }, (_, index) => ({
    testType: 'Field Density',
    testRequestNumber: `TR-${900 + index}`,
    laboratoryName: 'Acme Labs',
    laboratoryReportNumber: `LR-${900 + index}`,
    resultValue: 95 + (index % 5),
    resultUnit: '%',
    specificationMin: 95,
    specificationMax: null,
    passFail: index % 7 === 0 ? 'fail' : 'pass',
    status: 'verified',
    sampleDate: '2026-05-29T00:00:00.000Z',
    resultDate: '2026-05-30T00:00:00.000Z',
  })),
};

/** Every optional value absent — the "missing optional values" case. */
export const missingOptionalsConformanceFixture: ConformanceReportData = {
  lot: {
    lotNumber: 'LOT-999',
    description: null,
    status: 'in_progress',
    activityType: null,
    chainageStart: null,
    chainageEnd: null,
    layer: null,
    areaZone: null,
    conformedAt: null,
    conformedBy: null,
  },
  project: { name: 'Unnamed Project', projectNumber: null },
  itp: null,
  testResults: [],
  ncrs: [],
  holdPointReleases: [],
  photoCount: 0,
  coverage: null,
};

/** 60 photographs and 60 checklist attachments — the "many photographs" case. */
export const manyPhotosHpEvidenceFixture: HPEvidencePackageData = {
  ...releasedHpEvidencePackageFixture,
  photos: Array.from({ length: 60 }, (_, index) => ({
    id: `photo-${index}`,
    filename: `IMG_${String(index).padStart(4, '0')}_subgrade_proof_roll_chainage_${100 + index}.jpg`,
    caption: index % 3 === 0 ? `Proof roll pass ${index + 1} looking north` : null,
    uploadedAt: '2026-05-27T04:00:00.000Z',
  })),
  summary: {
    ...releasedHpEvidencePackageFixture.summary,
    totalPhotos: 60,
    totalAttachments: 60,
  },
};
