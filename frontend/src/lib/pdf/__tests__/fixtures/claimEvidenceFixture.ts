import type { ClaimEvidencePackageData } from '../../../pdfGenerator';

export const submittedClaimEvidencePackageFixture: ClaimEvidencePackageData = {
  claim: {
    id: 'claim-1',
    claimNumber: 7,
    periodStart: '2026-05-01T00:00:00.000Z',
    periodEnd: '2026-05-28T00:00:00.000Z',
    status: 'submitted',
    totalClaimedAmount: 248500,
    certifiedAmount: null,
    submittedAt: '2026-05-29T01:00:00.000Z',
    preparedBy: {
      name: 'Morgan Estimator',
      email: 'morgan@example.com',
    },
    preparedAt: '2026-05-29T00:30:00.000Z',
  },
  project: {
    id: 'project-1',
    name: 'Pacific Highway Upgrade',
    projectNumber: 'PHU-001',
    clientName: 'Transport for NSW',
    state: 'NSW',
  },
  lots: [
    {
      id: 'lot-1',
      lotNumber: 'EW-001',
      description: 'Bulk earthworks to subgrade level',
      activityType: 'Earthworks',
      chainageStart: 100,
      chainageEnd: 350,
      layer: 'Subgrade',
      areaZone: 'Zone A',
      status: 'conformed',
      conformedAt: '2026-05-20T05:00:00.000Z',
      conformedBy: {
        name: 'Jordan Surveyor',
        email: 'jordan@example.com',
      },
      claimAmount: 185000,
      percentComplete: 100,
      itp: {
        templateName: 'Earthworks ITP - Subgrade',
        checklistItems: [{}, {}, {}, {}],
        completions: [
          { isCompleted: true },
          { isCompleted: true },
          { isCompleted: true },
          { isCompleted: true },
        ],
      },
      holdPoints: [{ status: 'released' }, { status: 'released' }],
      testResults: [
        { testType: 'Compaction', resultValue: 98, resultUnit: '%', passFail: 'pass' },
        { testType: 'Moisture', resultValue: 12, resultUnit: '%', passFail: 'pass' },
        { testType: 'CBR', resultValue: 45, resultUnit: '%', passFail: 'pass' },
      ],
      ncrs: [],
      documents: [
        {
          id: 'doc-photo-1',
          filename: 'EW-001-proof-photo.jpg',
          documentType: 'photo',
          caption: 'Conformed subgrade proof photo',
          uploadedAt: '2026-05-20T04:30:00.000Z',
        },
        {
          id: 'doc-cert-1',
          filename: 'EW-001-compaction-certificate.pdf',
          documentType: 'test_result',
          caption: 'Compaction certificate',
          uploadedAt: '2026-05-20T04:45:00.000Z',
        },
      ],
      summary: {
        testResultCount: 3,
        passedTestCount: 3,
        ncrCount: 0,
        openNcrCount: 0,
        photoCount: 6,
        itpCompletionPercentage: 100,
      },
    },
    {
      id: 'lot-2',
      lotNumber: 'DR-014',
      description: 'Stormwater drainage line and pits',
      activityType: 'Drainage',
      chainageStart: 200,
      chainageEnd: 260,
      layer: null,
      areaZone: 'Zone B',
      status: 'in_progress',
      conformedAt: null,
      conformedBy: null,
      claimAmount: 63500,
      percentComplete: 75,
      itp: {
        templateName: 'Drainage ITP - Pipe Laying',
        checklistItems: [{}, {}, {}, {}],
        completions: [
          { isCompleted: true },
          { isCompleted: true },
          { isCompleted: true },
          { isCompleted: false },
        ],
      },
      holdPoints: [{ status: 'released' }, { status: 'pending' }],
      testResults: [
        { testType: 'Concrete Slump', resultValue: 80, resultUnit: 'mm', passFail: 'pass' },
        { testType: 'Pipe Joint', resultValue: null, resultUnit: null, passFail: 'fail' },
      ],
      ncrs: [{ ncrNumber: 'NCR-0021', severity: 'minor', status: 'open' }],
      documents: [
        {
          id: 'doc-photo-2',
          filename: 'DR-014-pit-photo.jpg',
          documentType: 'photo',
          caption: null,
          uploadedAt: '2026-05-21T04:30:00.000Z',
        },
      ],
      summary: {
        testResultCount: 2,
        passedTestCount: 1,
        ncrCount: 1,
        openNcrCount: 1,
        photoCount: 3,
        itpCompletionPercentage: 75,
      },
    },
  ],
  summary: {
    totalLots: 2,
    totalClaimedAmount: 248500,
    totalTestResults: 5,
    totalPassedTests: 4,
    totalNCRs: 1,
    totalOpenNCRs: 1,
    totalPhotos: 9,
    conformedLots: 1,
  },
  generatedAt: '2026-05-28T03:15:00.000Z',
  generationTimeMs: 1234,
};

/**
 * Empty-lot fixture for the B1 regression test (Evidence Package PDF crash).
 *
 * Represents the real-world malformed payload that crashed the builder: a lot
 * whose `itp` is undefined and whose collection fields (testResults, ncrs,
 * completions, holdPoints, documents) are undefined rather than empty arrays.
 * The `lots` array as a whole is also undefined-safety-tested below.
 *
 * The runtime API can return these fields absent even though the TS type marks
 * them required, so the lot objects are built loosely and cast to the data type.
 */
const emptyLot = {
  id: 'lot-empty',
  lotNumber: 'EMPTY-01',
  description: null,
  activityType: null,
  chainageStart: null,
  chainageEnd: null,
  layer: null,
  areaZone: null,
  status: 'pending',
  conformedAt: null,
  conformedBy: null,
  claimAmount: 0,
  percentComplete: 0,
  // itp intentionally undefined (absent) — pre-fix this crashed on
  // lot.itp.completions.filter(...) only when itp existed, but the undefined
  // collections below crash regardless of itp.
  itp: undefined,
  // holdPoints / testResults / ncrs / documents intentionally undefined (absent)
  holdPoints: undefined,
  testResults: undefined,
  ncrs: undefined,
  documents: undefined,
  summary: {
    testResultCount: 0,
    passedTestCount: 0,
    ncrCount: 0,
    openNcrCount: 0,
    photoCount: 0,
    itpCompletionPercentage: 0,
  },
};

/**
 * Second empty lot whose `itp` IS present but whose nested arrays
 * (completions, checklistItems) are undefined — exercises the
 * exact crash sites from the ticket: claimEvidencePackagePdf.ts:269/280.
 */
const itpPresentButArraysUndefinedLot = {
  ...emptyLot,
  id: 'lot-empty-2',
  lotNumber: 'EMPTY-02',
  itp: {
    templateName: 'Bare ITP',
    checklistItems: undefined,
    completions: undefined,
  },
};

export const emptyClaimEvidencePackageFixture: ClaimEvidencePackageData = {
  ...submittedClaimEvidencePackageFixture,
  lots: [emptyLot, itpPresentButArraysUndefinedLot] as unknown as ClaimEvidencePackageData['lots'],
  summary: {
    totalLots: 2,
    totalClaimedAmount: 0,
    totalTestResults: 0,
    totalPassedTests: 0,
    totalNCRs: 0,
    totalOpenNCRs: 0,
    totalPhotos: 0,
    conformedLots: 0,
  },
};

/**
 * Fixture whose top-level `lots` array is itself undefined — exercises the
 * `data.lots.forEach(...)` / `data.lots.length` guards.
 */
export const noLotsClaimEvidencePackageFixture: ClaimEvidencePackageData = {
  ...submittedClaimEvidencePackageFixture,
  lots: undefined as unknown as ClaimEvidencePackageData['lots'],
  summary: {
    totalLots: 0,
    totalClaimedAmount: 0,
    totalTestResults: 0,
    totalPassedTests: 0,
    totalNCRs: 0,
    totalOpenNCRs: 0,
    totalPhotos: 0,
    conformedLots: 0,
  },
};
