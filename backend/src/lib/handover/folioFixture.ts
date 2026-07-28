// Wave D `D1b` — a folio-shaped `FolioSnapshotPayload` for tests.
//
// Deliberately NOT a `*.test.ts` file: `folioRenderer.test.ts` and the
// storage-integration suite both build one, and a fixture duplicated across two
// suites drifts. It carries no assertions and is never imported by runtime code.

import { FOLIO_PAYLOAD_SCHEMA_VERSION } from './revisionTokens.js';
import { countEvidenceRows, type FolioSnapshotPayload } from './folioPayload.js';
import { resolveLoganPsp5Profile, type LoganPsp5ResolverInput } from './loganPsp5Profile.js';

const RESOLVER_INPUT: LoganPsp5ResolverInput = {
  lotId: 'lot-fixture',
  tests: [
    {
      id: 'test-pass',
      testType: 'Field density (compaction)',
      status: 'verified',
      passFail: 'pass',
    },
    {
      id: 'test-fail',
      testType: 'Field density (compaction)',
      status: 'verified',
      passFail: 'fail',
    },
    // Unverified — must never reach a PASS verdict (§4.3.2 item 4).
    {
      id: 'test-unverified',
      testType: 'Field density (compaction)',
      status: 'entered',
      passFail: 'pass',
    },
    // A type the crosswalk cannot resolve — named, never silently dropped.
    { id: 'test-unknown', testType: 'Bespoke widget torque', status: 'verified', passFail: 'pass' },
  ],
  ncrs: [
    {
      id: 'ncr-1',
      ncrNumber: 'NCR-001',
      linkedTestResultId: 'test-fail',
      rectificationNotes: 'Re-rolled and retested.',
      rectificationSubmittedAt: '2026-07-20T00:00:00.000Z',
      evidenceCount: 2,
    },
  ],
  documents: [
    {
      id: 'doc-photo',
      documentType: 'photo',
      mimeType: 'image/jpeg',
      fileSize: 5_000_000,
      captureTimestamp: '2026-07-19T00:00:00.000Z',
    },
    {
      id: 'doc-manual',
      documentType: 'om_manual',
      mimeType: 'application/pdf',
      captureTimestamp: null,
    },
  ],
};

export function buildFolioPayloadFixture(
  overrides: Partial<FolioSnapshotPayload> = {},
): FolioSnapshotPayload {
  const evidence = {
    tests: [
      {
        id: 'test-pass',
        testType: 'Field density (compaction)',
        status: 'verified',
        passFail: 'pass',
        verdict: 'PASS',
        testDate: '2026-07-18T00:00:00.000Z',
        laboratoryName: 'Acme Materials',
        resultSummary: '98.4 %',
      },
      {
        id: 'test-fail',
        testType: 'Field density (compaction)',
        status: 'verified',
        passFail: 'fail',
        verdict: 'FAIL',
        testDate: '2026-07-18T00:00:00.000Z',
        laboratoryName: 'Acme Materials',
        resultSummary: '91.2 %',
      },
      {
        id: 'test-unverified',
        testType: 'Field density (compaction)',
        status: 'entered',
        passFail: 'pass',
        verdict: 'Pending verification',
        testDate: null,
        laboratoryName: null,
        resultSummary: null,
      },
    ],
    ncrs: [
      {
        id: 'ncr-1',
        ncrNumber: 'NCR-001',
        severity: 'major',
        status: 'open',
        linkedTestResultId: 'test-fail',
        rectificationSubmittedAt: '2026-07-20T00:00:00.000Z',
      },
    ],
    documents: [
      {
        id: 'doc-photo',
        filename: 'CH1250-1310_subgrade.jpg',
        documentType: 'photo',
        mimeType: 'image/jpeg',
        captureTimestamp: '2026-07-19T00:00:00.000Z',
      },
    ],
    itpCompletions: [
      {
        id: 'itp-1',
        itemDescription: 'Subgrade proof roll witnessed',
        status: 'complete',
        verificationStatus: 'verified',
        completedAt: '2026-07-17T00:00:00.000Z',
      },
    ],
    holdPoints: [
      {
        id: 'hp-1',
        description: 'Subgrade acceptance',
        pointType: 'hold',
        status: 'released',
        releasedAt: '2026-07-17T04:00:00.000Z',
        releasedByOrg: 'Consulting Engineers Pty Ltd',
      },
    ],
  };

  return {
    schemaVersion: FOLIO_PAYLOAD_SCHEMA_VERSION,
    folio: {
      issueId: '11111111-2222-3333-4444-555555555555',
      version: 1,
      compiledAt: '2026-07-28T02:00:00.000Z',
      compiledByName: 'Jayson Ryan',
    },
    branding: { companyName: 'Ryox Civil Pty Ltd', abn: '12 345 678 901' },
    project: {
      id: 'project-fixture',
      name: 'Logan Reserve Stage 4',
      projectNumber: 'P-2026-004',
      clientName: 'Sunrise Developments',
      state: 'QLD',
    },
    lot: {
      id: 'lot-fixture',
      lotNumber: 'LOT-014',
      description: 'Subgrade, chainage 1250 to 1310',
      activityType: 'Earthworks',
      chainageStart: '1250.4',
      chainageEnd: '1310',
      status: 'conformed',
      conformedAt: '2026-07-21T00:00:00.000Z',
    },
    profile: resolveLoganPsp5Profile(RESOLVER_INPUT),
    evidence,
    evidenceRowCount: countEvidenceRows(evidence),
    ...overrides,
  };
}
