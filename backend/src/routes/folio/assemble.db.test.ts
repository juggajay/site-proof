// Wave `C5.3` — surveys and deliveries reaching the folio payload.
//
// **AT-179** the ceiling counts both new collections and REFUSES with the
// measured number rather than truncating, and `FOLIO_EVIDENCE_ROW_CEILING_DEFAULT`
// is not raised · the flag is FAIL-CLOSED, asserted against real rows in a real
// database rather than against an empty one, which would pass either way.
//
// DB-backed: `assembleFolioPayload` is a query, and the thing worth asserting
// is what it reads and what it refuses to read. Local disposable database only
// (`src/test/databaseSafety.ts`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import {
  assembleFolioPayload,
  FOLIO_EVIDENCE_ROW_CEILING_DEFAULT,
  folioEvidenceRowCeiling,
} from './assemble.js';

const tag = `c53-assemble-${Date.now()}`;

let companyId: string;
let projectId: string;
let userId: string;
let lotId: string;
let otherLotId: string;
let diaryId: string;
let acceptedSurveyId: string;
let requestedSurveyId: string;
let supersededSurveyId: string;
let linkedDeliveryId: string;

function assemble(lot = lotId) {
  return prisma.$transaction((tx) =>
    assembleFolioPayload(tx, {
      lotId: lot,
      folioIssueId: '11111111-2222-3333-4444-555555555555',
      version: 1,
      compiledAt: new Date('2026-07-31T00:00:00.000Z'),
      compiledByName: 'Quinn Manager',
    }),
  );
}

function withSurveyFlag<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const previous = process.env.C5_SURVEY_RECORDS_ENABLED;
  if (value === undefined) {
    delete process.env.C5_SURVEY_RECORDS_ENABLED;
  } else {
    process.env.C5_SURVEY_RECORDS_ENABLED = value;
  }
  return run().finally(() => {
    if (previous === undefined) {
      delete process.env.C5_SURVEY_RECORDS_ENABLED;
    } else {
      process.env.C5_SURVEY_RECORDS_ENABLED = previous;
    }
  });
}

async function createLot(suffix: string) {
  return prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-${suffix}`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      activitySlug: 'earthworks_general',
      status: 'in_progress',
    },
  });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const user = await prisma.user.create({
    data: {
      email: `${tag}@example.com`,
      fullName: 'Quinn Manager',
      passwordHash: 'x',
      companyId,
      roleInCompany: 'owner',
    },
  });
  userId = user.id;

  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `${tag}-P1`,
      companyId,
      state: 'QLD',
      specificationSet: 'TMR',
    },
  });
  projectId = project.id;

  lotId = (await createLot('L1')).id;
  otherLotId = (await createLot('L2')).id;

  const reportDocument = await prisma.document.create({
    data: {
      projectId,
      documentType: 'other',
      filename: 'conformance-survey-rev-b.pdf',
      fileUrl: 'uploads/conformance-survey-rev-b.pdf',
    },
  });
  const docketDocument = await prisma.document.create({
    data: {
      projectId,
      documentType: 'other',
      filename: 'docket-99812.pdf',
      fileUrl: 'uploads/docket-99812.pdf',
    },
  });

  acceptedSurveyId = (
    await prisma.surveyRecord.create({
      data: {
        projectId,
        lotId,
        kind: 'conformance',
        status: 'accepted',
        surveyorName: 'J. Smith',
        surveyorCompany: 'Smith Surveys Pty Ltd',
        surveyorRegistration: 'Registered Surveyor 4471',
        surveyedAt: new Date('2026-07-19T00:00:00.000Z'),
        surveyorVerdict: 'conforms',
        verdictSourceNote: 'report rev B',
        reportDocumentId: reportDocument.id,
        acceptedById: userId,
        acceptedAt: new Date('2026-07-20T00:00:00.000Z'),
      },
    })
  ).id;

  requestedSurveyId = (
    await prisma.surveyRecord.create({
      data: {
        projectId,
        lotId,
        kind: 'set_out',
        status: 'requested',
        requestedById: userId,
        surveyedAt: new Date('2026-07-21T00:00:00.000Z'),
      },
    })
  ).id;

  // A superseded record: a re-survey is a new row, and the folio shows the
  // current one. The old row stays in the database, retrievable through the
  // chain — which is exactly why "it is not in the payload" is worth asserting.
  supersededSurveyId = (
    await prisma.surveyRecord.create({
      data: {
        projectId,
        lotId,
        kind: 'conformance',
        status: 'rejected',
        surveyorName: 'J. Smith',
        surveyedAt: new Date('2026-07-10T00:00:00.000Z'),
        supersededById: acceptedSurveyId,
      },
    })
  ).id;

  // Another lot's survey, so lot scoping is a claim about behaviour.
  await prisma.surveyRecord.create({
    data: { projectId, lotId: otherLotId, kind: 'as_built', status: 'requested' },
  });

  const diary = await prisma.dailyDiary.create({
    data: { projectId, date: new Date('2026-07-16T00:00:00.000Z'), status: 'submitted' },
  });
  diaryId = diary.id;

  linkedDeliveryId = (
    await prisma.diaryDelivery.create({
      data: {
        diaryId,
        lotId,
        description: 'N32 concrete',
        supplier: 'Boral Concrete',
        docketNumber: 'DK-99812',
        batchRef: 'BATCH-7741',
        quantity: '12.5',
        unit: 'm3',
        docketDocumentId: docketDocument.id,
      },
    })
  ).id;

  // An UNLINKED delivery on the same diary. The folio is one lot's, so this is
  // structurally out of scope rather than filtered — asserted so a future
  // change to the `where` clause cannot quietly pull it in.
  await prisma.diaryDelivery.create({
    data: { diaryId, description: 'Unlinked aggregate delivery' },
  });
}, 120_000);

afterAll(async () => {
  delete process.env.FOLIO_EVIDENCE_ROW_CEILING;
  await prisma.diaryDelivery.deleteMany({ where: { diaryId } });
  await prisma.dailyDiary.deleteMany({ where: { projectId } });
  await prisma.surveyRecord.updateMany({ where: { projectId }, data: { supersededById: null } });
  await prisma.surveyRecord.deleteMany({ where: { projectId } });
  await prisma.document.deleteMany({ where: { projectId } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('the survey flag is fail-closed in the folio (`[C5S-B4]`)', () => {
  it('reads NO survey — against a lot that really has three — when the flag is absent', async () => {
    const assembled = await withSurveyFlag(undefined, () => assemble());

    // The lot holds three survey rows. With the flag off none of them reaches
    // the payload, none of them reaches `compiledFrom`, and none of them moves
    // the row count. A tenant that has not been switched on gets the folio it
    // got before this wave.
    expect(await prisma.surveyRecord.count({ where: { lotId } })).toBe(3);
    expect(assembled.payload.evidence.surveys).toEqual([]);
    expect(assembled.sourceRowRefs.filter((ref) => ref.sourceType === 'survey_record')).toEqual([]);
  });

  it.each(['false', 'off', '0', 'TRUEish', ''])(
    'stays closed for C5_SURVEY_RECORDS_ENABLED=%j',
    async (value) => {
      const assembled = await withSurveyFlag(value, () => assemble());
      expect(assembled.payload.evidence.surveys).toEqual([]);
    },
  );

  it('opens for the three values the shipped parse accepts', async () => {
    for (const value of ['true', '1', 'yes']) {
      const assembled = await withSurveyFlag(value, () => assemble());
      expect(assembled.payload.evidence.surveys.length).toBeGreaterThan(0);
    }
  });
});

describe('the survey projection is attributed, never computed (`[C5S-B1]`)', () => {
  it("carries the SURVEYOR'S verdict resolved server-side, with who recorded it", async () => {
    const assembled = await withSurveyFlag('true', () => assemble());
    const survey = assembled.payload.evidence.surveys.find((row) => row.id === acceptedSurveyId);

    expect(survey).toMatchObject({
      kind: 'conformance',
      status: 'accepted',
      surveyorName: 'J. Smith',
      surveyorCompany: 'Smith Surveys Pty Ltd',
      surveyorRegistration: 'Registered Surveyor 4471',
      surveyorVerdict: 'conforms',
      // Decided here, in the `testVerdict()` shape, so the renderer prints a
      // string it is given and never derives one.
      verdict: 'Conforms',
      verdictSourceNote: 'report rev B',
      reportFilename: 'conformance-survey-rev-b.pdf',
      recordedByName: 'Quinn Manager',
      recordedAt: '2026-07-20T00:00:00.000Z',
    });
  });

  it('says "not yet recorded" for a record with no verdict rather than inventing one', async () => {
    const assembled = await withSurveyFlag('true', () => assemble());
    const survey = assembled.payload.evidence.surveys.find((row) => row.id === requestedSurveyId);

    expect(survey?.surveyorVerdict).toBeNull();
    expect(survey?.verdict).toBe('Not yet recorded');
    // Attribution still resolves to the CIVOS user who opened the record.
    expect(survey?.recordedByName).toBe('Quinn Manager');
  });

  it('shows the current record only, and only this lot\u2019s', async () => {
    const assembled = await withSurveyFlag('true', () => assemble());
    const ids = assembled.payload.evidence.surveys.map((row) => row.id);

    expect(ids).toContain(acceptedSurveyId);
    expect(ids).toContain(requestedSurveyId);
    expect(ids).not.toContain(supersededSurveyId);
    expect(ids).toHaveLength(2);

    const otherLot = await withSurveyFlag('true', () => assemble(otherLotId));
    expect(otherLot.payload.evidence.surveys.map((row) => row.id)).not.toContain(acceptedSurveyId);
  });

  it('carries a §7.7 `updated_at` revision token for every survey it compiled from', async () => {
    const assembled = await withSurveyFlag('true', () => assemble());
    const refs = assembled.sourceRowRefs.filter((ref) => ref.sourceType === 'survey_record');

    expect(refs).toHaveLength(2);
    for (const ref of refs) {
      expect(ref.revision).toMatch(/^t:/);
    }
  });
});

describe('the delivery projection is unflagged and lot-scoped (`[C5S-f]`)', () => {
  it('transcribes the docket even with the survey flag off', async () => {
    const assembled = await withSurveyFlag(undefined, () => assemble());

    expect(assembled.payload.evidence.deliveries).toEqual([
      {
        id: linkedDeliveryId,
        deliveredOn: '2026-07-16T00:00:00.000Z',
        description: 'N32 concrete',
        supplier: 'Boral Concrete',
        docketNumber: 'DK-99812',
        batchRef: 'BATCH-7741',
        quantity: '12.5',
        unit: 'm3',
        docketFilename: 'docket-99812.pdf',
      },
    ]);
  });

  it('leaves an unlinked delivery out — the folio is one lot\u2019s', async () => {
    const assembled = await withSurveyFlag(undefined, () => assemble());
    const descriptions = assembled.payload.evidence.deliveries.map((row) => row.description);

    expect(await prisma.diaryDelivery.count({ where: { diaryId, lotId: null } })).toBe(1);
    expect(descriptions).not.toContain('Unlinked aggregate delivery');
  });

  it('carries a §7.7 `updated_at` revision token for the delivery', async () => {
    const assembled = await withSurveyFlag(undefined, () => assemble());
    const refs = assembled.sourceRowRefs.filter((ref) => ref.sourceType === 'diary_delivery');

    expect(refs).toHaveLength(1);
    expect(refs[0]!.sourceId).toBe(linkedDeliveryId);
    expect(refs[0]!.revision).toMatch(/^t:/);
  });
});

describe('the ceiling counts the new collections and refuses (**AT-179**)', () => {
  it('includes surveys and deliveries in the stated row count', async () => {
    const withFlag = await withSurveyFlag('true', () => assemble());
    const withoutFlag = await withSurveyFlag(undefined, () => assemble());

    // Two surveys, and they are the only difference between the two runs.
    expect(withFlag.payload.evidenceRowCount).toBe(withoutFlag.payload.evidenceRowCount + 2);
    // One delivery, counted in both.
    expect(withoutFlag.payload.evidenceRowCount).toBeGreaterThanOrEqual(1);
  });

  it('REFUSES with the measured number rather than truncating, and does not raise the ceiling', async () => {
    // The shipped default is unchanged: a collection added to the payload is
    // never an excuse to widen the bound (`[DR2-B6]`).
    expect(FOLIO_EVIDENCE_ROW_CEILING_DEFAULT).toBe(5000);

    process.env.FOLIO_EVIDENCE_ROW_CEILING = '2';
    try {
      expect(folioEvidenceRowCeiling()).toBe(2);
      // Three C5 rows alone (two surveys, one delivery) clear a ceiling of 2,
      // so the refusal below is driven by THIS WAVE'S collections.
      await expect(withSurveyFlag('true', () => assemble())).rejects.toMatchObject({
        statusCode: 400,
        code: 'FOLIO_EVIDENCE_CEILING_EXCEEDED',
      });
      await expect(withSurveyFlag('true', () => assemble())).rejects.toThrow(
        /3 or more evidence rows/,
      );
    } finally {
      delete process.env.FOLIO_EVIDENCE_ROW_CEILING;
    }

    // Nothing partial survived: the refusal is thrown inside the caller's
    // transaction, before any snapshot exists.
    expect(await prisma.folioSnapshot.count({ where: { lotId } })).toBe(0);
  });
});
