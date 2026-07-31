// Wave `C5.3` — the survey collection in a hold-point release package.
//
// **AT-182**: all three `evidencePackage.ts` consumers return the survey
// collection and the new counts; the public batch route returns it only for the
// hold points in its own batch; deliveries are absent (`[C5S-e]`). Plus the
// fail-closed flag, asserted against real rows rather than an empty lot.
//
// DB-backed because "all three consumers" is a claim about three routes, and
// two of them are unauthenticated token doors whose payload shape IS the trust
// boundary. Local disposable database only (`src/test/databaseSafety.ts`).

import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { holdpointsRouter } from '../holdpoints.js';
import { buildTemplateSnapshot } from '../itp/helpers/templateSnapshot.js';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const tag = `c53-hp-survey-${Date.now()}`;

function hashToken(rawToken: string): string {
  return `sha256:${crypto.createHash('sha256').update(rawToken).digest('hex')}`;
}

type SurveyRow = {
  id: string;
  kind: string;
  status: string;
  surveyorName: string | null;
  surveyorVerdict: string | null;
  verdictAttribution: string;
  reportFilename: string | null;
  isReceived: boolean;
};

type EvidencePackageBody = {
  evidencePackage: {
    surveys: SurveyRow[];
    summary: { totalSurveys: number; receivedSurveys: number };
  };
};

let companyId: string;
let projectId: string;
let templateId: string;
let userId: string;
let ownerToken: string;
let lotId: string;
let otherLotId: string;
let holdPointId: string;
let holdPointItemId: string;
let otherLotHoldPointId: string;
let batchId: string;
let batchRawToken: string;
let singleRawToken: string;
let conformanceSurveyId: string;
let requestedSurveyId: string;
let supersededSurveyId: string;
let otherLotSurveyId: string;

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

/** The three consumers, each on a real 200 path, as one list. */
function consumers(): Array<{ label: string; fetch: () => Promise<EvidencePackageBody> }> {
  return [
    {
      label: 'GET /:id/evidence-package (authenticated)',
      fetch: async () => {
        const res = await request(app)
          .get(`/api/holdpoints/${holdPointId}/evidence-package`)
          .set('Authorization', `Bearer ${ownerToken}`);
        expect(res.status, 'authenticated evidence package must be a real 200').toBe(200);
        return res.body as EvidencePackageBody;
      },
    },
    {
      label: 'POST /preview-evidence-package (authenticated)',
      fetch: async () => {
        const res = await request(app)
          .post('/api/holdpoints/preview-evidence-package')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ lotId, itpChecklistItemId: holdPointItemId });
        expect(res.status, 'preview must be a real 200').toBe(200);
        return res.body as EvidencePackageBody;
      },
    },
    {
      label: 'GET /public/:token (unauthenticated)',
      fetch: async () => {
        const res = await request(app).get(`/api/holdpoints/public/${singleRawToken}`);
        expect(res.status, 'public token page must be a real 200').toBe(200);
        return res.body as EvidencePackageBody;
      },
    },
  ];
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const owner = await registerTestUser(app, {
    fullName: 'Quinn Manager',
    emailPrefix: `${tag}-o`,
    companyId,
    roleInCompany: 'owner',
  });
  ownerToken = owner.token;
  userId = owner.userId;

  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `P-${tag}`,
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;
  await prisma.projectUser.create({
    data: { projectId, userId, role: 'admin', status: 'active' },
  });

  const template = await prisma.iTPTemplate.create({
    data: { projectId, name: `Template ${tag}`, activityType: 'Earthworks' },
  });
  templateId = template.id;

  const holdPointItem = await prisma.iTPChecklistItem.create({
    data: {
      templateId,
      description: 'Subgrade acceptance',
      pointType: 'hold_point',
      sequenceNumber: 1,
    },
  });
  holdPointItemId = holdPointItem.id;

  const snapshotSource = await prisma.iTPTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
  });
  const snapshot = JSON.stringify(buildTemplateSnapshot(snapshotSource));

  for (const suffix of ['L1', 'L2'] as const) {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-${suffix}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    const instance = await prisma.iTPInstance.create({
      data: { templateId, lotId: lot.id, templateSnapshot: snapshot, status: 'in_progress' },
    });
    await prisma.iTPCompletion.create({
      data: { itpInstanceId: instance.id, checklistItemId: holdPointItemId, status: 'completed' },
    });
    const holdPoint = await prisma.holdPoint.create({
      data: {
        lotId: lot.id,
        itpChecklistItemId: holdPointItemId,
        pointType: 'hold_point',
        description: 'Subgrade acceptance',
        status: 'notified',
      },
    });

    if (suffix === 'L1') {
      lotId = lot.id;
      holdPointId = holdPoint.id;
    } else {
      otherLotId = lot.id;
      otherLotHoldPointId = holdPoint.id;
    }
  }

  const reportDocument = await prisma.document.create({
    data: {
      projectId,
      documentType: 'other',
      filename: 'conformance-survey-rev-b.pdf',
      fileUrl: 'uploads/conformance-survey-rev-b.pdf',
    },
  });

  conformanceSurveyId = (
    await prisma.surveyRecord.create({
      data: {
        projectId,
        lotId,
        kind: 'conformance',
        status: 'received',
        surveyorName: 'J. Smith',
        surveyorCompany: 'Smith Surveys Pty Ltd',
        surveyorRegistration: 'Registered Surveyor 4471',
        surveyedAt: new Date('2026-07-19T00:00:00.000Z'),
        surveyorVerdict: 'conforms',
        verdictSourceNote: 'report rev B',
        reportDocumentId: reportDocument.id,
        receivedById: userId,
        receivedAt: new Date('2026-07-20T00:00:00.000Z'),
      },
    })
  ).id;

  requestedSurveyId = (
    await prisma.surveyRecord.create({
      data: {
        projectId,
        lotId,
        // Still outstanding: the package carries it so the reader can see what
        // the lot is waiting on, and the summary does not count it as arrived.
        kind: 'set_out',
        status: 'requested',
        surveyedAt: new Date('2026-07-21T00:00:00.000Z'),
      },
    })
  ).id;

  supersededSurveyId = (
    await prisma.surveyRecord.create({
      data: {
        projectId,
        lotId,
        kind: 'conformance',
        status: 'returned_for_correction',
        returnReason: 'Levels computed against the superseded design surface',
        surveyorName: 'J. Smith',
        surveyedAt: new Date('2026-07-10T00:00:00.000Z'),
        supersededById: conformanceSurveyId,
      },
    })
  ).id;

  otherLotSurveyId = (
    await prisma.surveyRecord.create({
      data: { projectId, lotId: otherLotId, kind: 'as_built', status: 'requested' },
    })
  ).id;

  // A lot-linked delivery, so "deliveries are absent from the release package"
  // is a claim about behaviour rather than about an empty table (`[C5S-e]`).
  const diary = await prisma.dailyDiary.create({
    data: { projectId, date: new Date('2026-07-16T00:00:00.000Z'), status: 'submitted' },
  });
  await prisma.diaryDelivery.create({
    data: { diaryId: diary.id, lotId, description: 'N32 concrete', supplier: 'Boral Concrete' },
  });

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  singleRawToken = `${tag}-single`;
  await prisma.holdPointReleaseToken.create({
    data: {
      holdPointId,
      recipientEmail: `${tag}-super@example.com`,
      recipientName: 'Named Superintendent',
      token: hashToken(singleRawToken),
      expiresAt,
    },
  });

  // A batch holding ONLY the other lot's hold point, so "returns it only for
  // the hold points in its own batch" has something to be wrong about.
  batchRawToken = `${tag}-batch`;
  const batch = await prisma.holdPointReleaseBatch.create({
    data: {
      lotId: otherLotId,
      recipientEmail: `${tag}-super@example.com`,
      recipientName: 'Named Superintendent',
      token: hashToken(batchRawToken),
      expiresAt,
      requestedByUserId: userId,
    },
  });
  batchId = batch.id;
  await prisma.holdPointReleaseToken.create({
    data: {
      holdPointId: otherLotHoldPointId,
      batchId,
      recipientEmail: `${tag}-super@example.com`,
      recipientName: 'Named Superintendent',
      token: hashToken(`${batchRawToken}-hp`),
      expiresAt,
    },
  });
}, 120_000);

afterAll(async () => {
  delete process.env.C5_SURVEY_RECORDS_ENABLED;
  await prisma.diaryDelivery.deleteMany({ where: { diary: { projectId } } });
  await prisma.dailyDiary.deleteMany({ where: { projectId } });
  await prisma.surveyRecord.updateMany({ where: { projectId }, data: { supersededById: null } });
  await prisma.surveyRecord.deleteMany({ where: { projectId } });
  await prisma.holdPointReleaseToken.deleteMany({ where: { holdPoint: { lot: { projectId } } } });
  await prisma.holdPointReleaseBatch.deleteMany({ where: { lot: { projectId } } });
  await prisma.holdPoint.deleteMany({ where: { lot: { projectId } } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lot: { projectId } } } });
  await prisma.document.deleteMany({ where: { projectId } });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('**AT-182** — surveys reach all three evidence-package consumers', () => {
  it.each(consumers())(
    '$label returns the current surveys and the new counts',
    async ({ fetch }) => {
      const body = await withSurveyFlag('true', fetch);
      const { surveys, summary } = body.evidencePackage;

      const ids = surveys.map((survey) => survey.id);
      expect(ids).toContain(conformanceSurveyId);
      expect(ids).toContain(requestedSurveyId);
      // A re-survey is a new record; the superseded one stays retrievable through
      // the chain rather than appearing beside its own replacement.
      expect(ids).not.toContain(supersededSurveyId);
      // Lot scoping is what keeps another lot's survey out — the same thing that
      // scopes the rest of the package.
      expect(ids).not.toContain(otherLotSurveyId);

      expect(summary.totalSurveys).toBe(2);
      // Records whose report has ARRIVED — not a count of conforming surveys,
      // and no longer a count of anything CIVOS accepted. The superintendent
      // reading this package is the one who accepts.
      expect(summary.receivedSurveys).toBe(1);
    },
  );

  it.each(consumers())(
    '$label attributes the verdict to the surveyor (`[C5S-B1]`)',
    async ({ fetch }) => {
      const body = await withSurveyFlag('true', fetch);
      const received = body.evidencePackage.surveys.find((s) => s.id === conformanceSurveyId);

      expect(received?.surveyorVerdict).toBe('conforms');
      expect(received?.verdictAttribution).toBe(
        'Verdict stated by J. Smith, recorded in CIVOS by Quinn Manager.',
      );
      expect(received?.reportFilename).toBe('conformance-survey-rev-b.pdf');
      expect(received?.isReceived).toBe(true);
    },
  );

  it.each(consumers())(
    '$label leaks no storage locator for the survey report',
    async ({ fetch }) => {
      const body = await withSurveyFlag('true', fetch);
      // The report's `Document` id is deliberately absent: the public download
      // allow-list is built from checklist attachments and photos, and naming a
      // document here would widen it without anyone reviewing that as a change to
      // the trust boundary.
      for (const survey of body.evidencePackage.surveys) {
        expect(Object.keys(survey)).not.toContain('fileUrl');
        expect(Object.keys(survey)).not.toContain('reportDocumentId');
      }
      expect(JSON.stringify(body.evidencePackage.surveys)).not.toContain('uploads/');
    },
  );

  it.each(consumers())('$label carries NO deliveries (`[C5S-e]`)', async ({ fetch }) => {
    const body = await withSurveyFlag('true', fetch);
    // A superintendent releasing a hold point is deciding about workmanship and
    // testing; the delivery register at that moment is noise. Deliveries reach
    // the folio instead. Flip it when a real superintendent asks.
    expect(await prisma.diaryDelivery.count({ where: { lotId } })).toBe(1);
    expect(body.evidencePackage).not.toHaveProperty('deliveries');
    expect(JSON.stringify(body.evidencePackage)).not.toContain('Boral Concrete');
  });

  it.each(consumers())(
    '$label returns an empty collection when the flag is off',
    async ({ fetch }) => {
      const body = await withSurveyFlag(undefined, fetch);

      // The lot really holds three survey rows. Fail-closed means none of them
      // reaches a superintendent's inbox until the tenant is switched on.
      expect(await prisma.surveyRecord.count({ where: { lotId } })).toBe(3);
      expect(body.evidencePackage.surveys).toEqual([]);
      expect(body.evidencePackage.summary.totalSurveys).toBe(0);
      expect(body.evidencePackage.summary.receivedSurveys).toBe(0);
    },
  );
});

describe('**AT-182** — the batch route stays inside its own batch', () => {
  it("returns the batch hold point's OWN lot surveys, not the other lot's", async () => {
    const res = await withSurveyFlag('true', async () =>
      request(app).get(
        `/api/holdpoints/public/batch/${batchRawToken}/holdpoints/${otherLotHoldPointId}`,
      ),
    );
    expect(res.status).toBe(200);

    const ids = (res.body as EvidencePackageBody).evidencePackage.surveys.map((s) => s.id);
    expect(ids).toEqual([otherLotSurveyId]);
    expect(ids).not.toContain(conformanceSurveyId);
  });

  it('refuses a hold point that is not in the batch, so the survey never loads', async () => {
    // The scoping that matters is the batch -> token -> hold point chain, which
    // predates this wave; asserted here because surveys now ride it.
    const res = await withSurveyFlag('true', async () =>
      request(app).get(`/api/holdpoints/public/batch/${batchRawToken}/holdpoints/${holdPointId}`),
    );
    expect(res.status).toBe(404);
  });
});
