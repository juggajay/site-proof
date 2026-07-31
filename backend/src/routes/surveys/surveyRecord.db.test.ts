// Wave C5.2 — AT-172, AT-173 (route half), AT-174, AT-176, AT-187 (survey
// half), AT-188, plus the fail-closed flag gate.
//
// The wave's flagship invariant is `[C5S-B1]`: **CIVOS records a verdict; it
// never makes one.** AT-172 proves it AT THE DATABASE, by raw SQL that bypasses
// the routes entirely — a route-level test of a CHECK proves nothing about the
// CHECK, and Rev 1 shipped two constraints that both permitted the exact row
// they were supposed to forbid.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Prisma } from '@prisma/client';

import { authRouter } from '../auth.js';
import { projectsRouter } from '../projects.js';
import documentsRouter from '../documents.js';
import { lotSurveysRouter, projectSurveysRouter, surveysRouter } from './index.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser, TEST_USER_PASSWORD } from '../../test/routeTestHarness.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', projectSurveysRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/lots', lotSurveysRouter);
app.use('/api/surveys', surveysRouter);
app.use('/api/documents', documentsRouter);
app.use(errorHandler);

const originalFlag = process.env.C5_SURVEY_RECORDS_ENABLED;

async function createProject(companyId: string, prefix: string, status = 'active') {
  return prisma.project.create({
    data: {
      name: `${prefix} Project`,
      projectNumber: `${prefix}-${Date.now()}-${Math.trunc(performance.now())}`,
      state: 'NSW',
      specificationSet: 'TfNSW',
      companyId,
      status,
    },
  });
}

async function createLot(projectId: string, lotNumber: string) {
  return prisma.lot.create({
    data: { projectId, lotNumber, lotType: 'general', activityType: 'earthworks' },
  });
}

async function createDocument(projectId: string, filename: string) {
  return prisma.document.create({
    data: {
      projectId,
      filename,
      fileUrl: `documents/${filename}`,
      mimeType: 'application/pdf',
      documentType: 'other',
    },
  });
}

describe('C5.2 — the survey record', () => {
  let adminToken: string;
  let adminUserId: string;
  let engineerToken: string;
  let subbieToken: string;
  let otherTenantToken: string;

  let companyId: string;
  let projectId: string;
  let lotId: string;
  let reportDocumentId: string;
  let foreignLotId: string;
  let foreignDocumentId: string;
  let foreignSurveyId: string;

  beforeAll(async () => {
    process.env.C5_SURVEY_RECORDS_ENABLED = 'true';

    const company = await prisma.company.create({ data: { name: `C5 Survey Co ${Date.now()}` } });
    companyId = company.id;

    const admin = await registerTestUser(app, {
      emailPrefix: 'c5-survey-admin',
      fullName: 'C5 Survey Admin',
      companyId,
      roleInCompany: 'admin',
    });
    adminToken = admin.token;
    adminUserId = admin.userId;

    const project = await createProject(companyId, 'C5S');
    projectId = project.id;
    lotId = (await createLot(projectId, 'SUR-001')).id;
    reportDocumentId = (await createDocument(projectId, 'survey-report-rev-a.pdf')).id;

    // `site_engineer` is a SURVEY_CREATOR but NOT a SURVEY_ACCEPTOR.
    const engineer = await registerTestUser(app, {
      emailPrefix: 'c5-survey-engineer',
      fullName: 'C5 Site Engineer',
      companyId,
      roleInCompany: 'member',
    });
    engineerToken = engineer.token;
    await prisma.projectUser.create({
      data: { projectId, userId: engineer.userId, role: 'site_engineer', status: 'active' },
    });

    const subbie = await registerTestUser(app, {
      emailPrefix: 'c5-survey-subbie',
      fullName: 'C5 Survey Subbie',
      companyId,
      roleInCompany: 'subcontractor',
    });
    subbieToken = subbie.token;
    await prisma.projectUser.create({
      data: { projectId, userId: subbie.userId, role: 'subcontractor', status: 'active' },
    });

    const otherCompany = await prisma.company.create({
      data: { name: `C5 Survey Other Co ${Date.now()}` },
    });
    const otherAdmin = await registerTestUser(app, {
      emailPrefix: 'c5-survey-other',
      fullName: 'C5 Survey Other Admin',
      companyId: otherCompany.id,
      roleInCompany: 'admin',
    });
    otherTenantToken = otherAdmin.token;
    const otherProject = await createProject(otherCompany.id, 'C5SO');
    foreignLotId = (await createLot(otherProject.id, 'OTHER-SUR-001')).id;
    foreignDocumentId = (await createDocument(otherProject.id, 'other-report.pdf')).id;
    foreignSurveyId = (
      await prisma.surveyRecord.create({
        data: { projectId: otherProject.id, lotId: foreignLotId, kind: 'conformance' },
      })
    ).id;
  });

  afterAll(() => {
    if (originalFlag === undefined) {
      delete process.env.C5_SURVEY_RECORDS_ENABLED;
    } else {
      process.env.C5_SURVEY_RECORDS_ENABLED = originalFlag;
    }
  });

  // -------------------------------------------------------------------------
  // AT-172 — proven at the DB, by raw SQL that bypasses the routes.
  // -------------------------------------------------------------------------
  describe('AT-172 — the constraints, after the evidence-of-arrival restructure', () => {
    async function rawInsert(columns: Prisma.Sql) {
      await prisma.$executeRaw(columns);
    }

    it('(a) has no acceptance left to constrain — the three accepted CHECKs are gone', async () => {
      // Acceptance is the hold-point release and the lot conformance, not an act
      // on this record (research §4.6). The columns went with the act.
      const columns = await prisma.$queryRaw<{ column_name: string }[]>(Prisma.sql`
        SELECT column_name FROM information_schema.columns
         WHERE table_name = 'survey_records' AND column_name IN ('accepted_by','accepted_at')
      `);
      expect(columns).toEqual([]);

      const checks = await prisma.$queryRaw<{ conname: string }[]>(Prisma.sql`
        SELECT conname FROM pg_constraint
         WHERE conrelid = 'survey_records'::regclass AND conname LIKE '%accepted%'
      `);
      expect(checks).toEqual([]);
    });

    it('(b) refuses a return with no reason — the state is worthless without it', async () => {
      // Six distinct return triggers are evidenced and each demands a different
      // fix (research §5.3). At the DB, so a future route cannot skip it.
      await expect(
        rawInsert(Prisma.sql`
          INSERT INTO survey_records
            (id, project_id, lot_id, kind, status, surveyor_name, updated_at)
          VALUES
            (gen_random_uuid()::text, ${projectId}, ${lotId}, 'conformance',
             'returned_for_correction', 'J. Smith', NOW())
        `),
      ).rejects.toThrow(/survey_records_returned_requires_reason_check/);

      // Whitespace is not a reason either.
      await expect(
        rawInsert(Prisma.sql`
          INSERT INTO survey_records
            (id, project_id, lot_id, kind, status, return_reason, updated_at)
          VALUES
            (gen_random_uuid()::text, ${projectId}, ${lotId}, 'conformance',
             'returned_for_correction', '   ', NOW())
        `),
      ).rejects.toThrow(/survey_records_returned_requires_reason_check/);
    });

    it('(c) refuses received_at without received_by', async () => {
      await expect(
        rawInsert(Prisma.sql`
          INSERT INTO survey_records
            (id, project_id, lot_id, kind, status, received_at, updated_at)
          VALUES
            (gen_random_uuid()::text, ${projectId}, ${lotId}, 'conformance', 'received',
             NOW(), NOW())
        `),
      ).rejects.toThrow(/survey_records_received_actor_check/);
    });

    it('accepts a fully attributed received row', async () => {
      await rawInsert(Prisma.sql`
        INSERT INTO survey_records
          (id, project_id, lot_id, kind, status, surveyor_name, surveyor_verdict,
           received_by, received_at, updated_at)
        VALUES
          (gen_random_uuid()::text, ${projectId}, ${lotId}, 'conformance', 'received',
           'J. Smith', 'conforms', ${adminUserId}, NOW(), NOW())
      `);
      expect(
        await prisma.surveyRecord.count({
          where: { projectId, status: 'received', surveyorName: 'J. Smith' },
        }),
      ).toBe(1);
    });

    it('refuses a status, kind or verdict outside the CHECK vocabularies', async () => {
      // The retired states are refused BY NAME, which is what makes the rename a
      // reviewed migration rather than silent drift.
      for (const retired of ['in_progress', 'accepted', 'rejected']) {
        await expect(
          rawInsert(Prisma.sql`
            INSERT INTO survey_records (id, project_id, kind, status, updated_at)
            VALUES (gen_random_uuid()::text, ${projectId}, 'conformance', ${retired}, NOW())
          `),
        ).rejects.toThrow(/survey_records_status_check/);
      }

      await expect(
        rawInsert(Prisma.sql`
          INSERT INTO survey_records (id, project_id, kind, status, updated_at)
          VALUES (gen_random_uuid()::text, ${projectId}, 'conformance', 'conforming', NOW())
        `),
      ).rejects.toThrow(/survey_records_status_check/);

      await expect(
        rawInsert(Prisma.sql`
          INSERT INTO survey_records (id, project_id, kind, status, updated_at)
          VALUES (gen_random_uuid()::text, ${projectId}, 'levels', 'requested', NOW())
        `),
      ).rejects.toThrow(/survey_records_kind_check/);

      await expect(
        rawInsert(Prisma.sql`
          INSERT INTO survey_records (id, project_id, kind, status, surveyor_verdict, updated_at)
          VALUES (gen_random_uuid()::text, ${projectId}, 'conformance', 'received', 'passes', NOW())
        `),
      ).rejects.toThrow(/survey_records_verdict_check/);
    });

    it('refuses a row that supersedes itself', async () => {
      const row = await prisma.surveyRecord.create({
        data: { projectId, lotId, kind: 'as_built' },
      });
      await expect(
        prisma.$executeRaw(
          Prisma.sql`UPDATE survey_records SET superseded_by_id = id WHERE id = ${row.id}`,
        ),
      ).rejects.toThrow(/survey_records_self_supersede_check/);
    });
  });

  // -------------------------------------------------------------------------
  // AT-173 — the transition map is the only path, short paths included.
  // -------------------------------------------------------------------------
  describe('AT-173 — status transitions through the route', () => {
    function createSurvey(body: Record<string, unknown> = {}, token = adminToken) {
      return request(app)
        .post(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'conformance', ...body });
    }

    it('creates at the default status and derives project_id from the lot', async () => {
      const res = await createSurvey().expect(201);
      expect(res.body).toMatchObject({ status: 'requested', projectId, lotId });
    });

    it('stamps requested_at only when the record actually starts at requested', async () => {
      const requested = await createSurvey().expect(201);
      expect(requested.body.requestedAt).toBeTruthy();

      // The retrospective case: nobody requested this, the report just arrived.
      // Dating a request that never happened is a lie the folio would print.
      const retrospective = await createSurvey({
        status: 'received',
        reportDocumentId,
        surveyorName: 'J. Smith',
      }).expect(201);
      expect(retrospective.body.requestedAt).toBeNull();
      // Who FILED it is still recorded — the folio's attribution depends on it.
      expect(retrospective.body.requestedBy.id).toBe(adminUserId);
    });

    it('takes the short path requested -> received when the report and surveyor are in', async () => {
      const created = await createSurvey({ reportDocumentId, surveyorName: 'J. Smith' }).expect(
        201,
      );
      const res = await request(app)
        .post(`/api/surveys/${created.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'received' })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'received', receivedById: adminUserId });
      expect(res.body.receivedAt).toBeTruthy();
    });

    it('files a received record with NO verdict — arrival is not a judgement', async () => {
      // `accepted` demanded a verdict because it was a judgement about one.
      // Receipt is not: the one real AU conformance report in the corpus was 20%
      // within tolerance and 70% too high — a trim instruction (research §3.3).
      const res = await createSurvey({
        status: 'received',
        reportDocumentId,
        surveyorName: 'J. Smith',
      }).expect(201);
      expect(res.body).toMatchObject({ status: 'received', surveyorVerdict: null });
      expect(res.body.receivedById).toBe(adminUserId);
    });

    it('creates directly at a non-default status, subject to the same gates', async () => {
      // The gates still apply on creation: no report, no `received`.
      const noReport = await createSurvey({ status: 'received', surveyorName: 'J. Smith' });
      expect(noReport.status).toBe(400);
      expect(noReport.body.error.code).toBe('SURVEY_REPORT_REQUIRED');

      // No surveyor, no arrival — evidence attributed to nobody is not evidence.
      const noSurveyor = await createSurvey({ status: 'received', reportDocumentId });
      expect(noSurveyor.status).toBe(400);
      expect(noSurveyor.body.error.details.code).toBe('SURVEYOR_REQUIRED');

      // Filing a return retrospectively still has to say what was wrong.
      const noReason = await createSurvey({
        status: 'returned_for_correction',
        reportDocumentId,
        surveyorName: 'J. Smith',
      });
      expect(noReason.status).toBe(400);
      expect(noReason.body.error.details.code).toBe('SURVEY_RETURN_REASON_REQUIRED');
    });

    it('refuses every pair outside the map, and points a returned record at a new revision', async () => {
      const created = await createSurvey({
        reportDocumentId,
        surveyorName: 'J. Smith',
      }).expect(201);
      const id = created.body.id as string;

      // requested -> returned_for_correction is not an edge: nothing arrived yet.
      const badEdge = await request(app)
        .post(`/api/surveys/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'returned_for_correction', returnReason: 'Wrong datum' });
      expect(badEdge.status).toBe(400);
      expect(badEdge.body.error.details.code).toBe('INVALID_SURVEY_TRANSITION');

      await request(app)
        .post(`/api/surveys/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'received' })
        .expect(200);

      const noReason = await request(app)
        .post(`/api/surveys/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'returned_for_correction' });
      expect(noReason.status).toBe(400);
      expect(noReason.body.error.details.code).toBe('SURVEY_RETURN_REASON_REQUIRED');

      const returned = await request(app)
        .post(`/api/surveys/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'returned_for_correction',
          returnReason: 'RTK GNSS used for vertical compliance on subgrade',
        })
        .expect(200);
      expect(returned.body).toMatchObject({
        status: 'returned_for_correction',
        returnReason: 'RTK GNSS used for vertical compliance on subgrade',
      });

      // No edge out — and the refusal says where the workflow actually goes.
      const fromReturned = await request(app)
        .post(`/api/surveys/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'received' });
      expect(fromReturned.status).toBe(400);
      expect(fromReturned.body.error.details.allowedTransitions).toEqual([]);
      expect(fromReturned.body.error.details.hint).toContain('supersede');
    });

    it('loops a returned record to a NEW revision through the supersession chain', async () => {
      // The AU idiom for a redo: a new, renumbered artifact cross-referenced to
      // its predecessor (MRTS50 cl. 7.2), never the same row flipped back.
      const first = await createSurvey({
        status: 'received',
        reportDocumentId,
        surveyorName: 'J. Smith',
        surveyorVerdict: 'does_not_conform',
      }).expect(201);

      await request(app)
        .post(`/api/surveys/${first.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'returned_for_correction', returnReason: 'Chainage gaps exceed 50 m' })
        .expect(200);

      const corrected = await createSurvey({
        status: 'received',
        reportDocumentId,
        surveyorName: 'J. Smith',
        surveyorVerdict: 'conforms',
      }).expect(201);

      const superseded = await request(app)
        .post(`/api/surveys/${first.body.id}/supersede`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ supersededById: corrected.body.id, reason: 'Re-survey after correction' })
        .expect(200);
      expect(superseded.body.supersededById).toBe(corrected.body.id);

      // The returned record keeps its state and its reason — it is the evidence
      // that the first result was bad — and stops counting as outstanding.
      expect(superseded.body.status).toBe('returned_for_correction');
      expect(superseded.body.returnReason).toBe('Chainage gaps exceed 50 m');
    });

    it('lets a site engineer record receipt but not return a survey for correction', async () => {
      const created = await createSurvey(
        { reportDocumentId, surveyorName: 'J. Smith', surveyorVerdict: 'conforms' },
        engineerToken,
      ).expect(201);

      // Recording arrival is the site engineer's filing act — MRWA routes the
      // result back to "the officer that requested the survey" (research §1.9).
      await request(app)
        .post(`/api/surveys/${created.body.id}/status`)
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({ status: 'received' })
        .expect(200);

      // Referring the deliverable back is the Project Manager's act in the
      // published text (TMR Surveying Standards Part 1 §7.6.4).
      await request(app)
        .post(`/api/surveys/${created.body.id}/status`)
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({ status: 'returned_for_correction', returnReason: 'Wrong design surface' })
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // AT-174 — a SUPERSEDED survey resists substantive edits, field by field.
  //
  // C5.2 froze accepted records and left superseded ones editable, which had it
  // backwards: with acceptance gone, the frozen half is the history, and the
  // current record stays editable because correcting a live record is filing
  // hygiene rather than rewriting what a successor was written against.
  // -------------------------------------------------------------------------
  describe('AT-174 — superseded records are closed, current ones are not', () => {
    let supersededId: string;

    async function fileSurvey(body: Record<string, unknown> = {}) {
      const res = await request(app)
        .post(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          kind: 'as_built',
          status: 'received',
          reportDocumentId,
          surveyorName: 'J. Smith',
          surveyorVerdict: 'qualified',
          verdictSourceNote: 'Report rev B, section 4',
          ...body,
        })
        .expect(201);
      return res.body.id as string;
    }

    beforeAll(async () => {
      supersededId = await fileSurvey();
      const replacementId = await fileSurvey({ surveyorVerdict: 'conforms' });
      await request(app)
        .post(`/api/surveys/${supersededId}/supersede`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ supersededById: replacementId, reason: 'Re-survey after correction' })
        .expect(200);
    });

    it('lets the CURRENT record be corrected — a typo is not a rewrite of history', async () => {
      const currentId = await fileSurvey();
      const res = await request(app)
        .patch(`/api/surveys/${currentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ surveyorName: 'J. Smith (RPEQ 12345)' })
        .expect(200);
      expect(res.body.surveyorName).toBe('J. Smith (RPEQ 12345)');
    });

    it('refuses to erase the surveyor off a record already filed as received', async () => {
      const currentId = await fileSurvey();
      const res = await request(app)
        .patch(`/api/surveys/${currentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ surveyorName: null });
      expect(res.status).toBe(400);
      expect(res.body.error.details.code).toBe('SURVEYOR_REQUIRED');
    });

    it.each([['notes']])(
      'leaves a superseded record alone when only %s is edited',
      async (field) => {
        const res = await request(app)
          .patch(`/api/surveys/${supersededId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ [field]: 'a working note added after supersession' })
          .expect(200);
        expect(res.body.supersededById).toBeTruthy();
      },
    );

    it.each([
      ['surveyorVerdict', 'conforms'],
      ['verdictSourceNote', 'Report rev C'],
      ['surveyorName', 'Somebody Else'],
    ])('refuses a substantive edit to %s on a superseded record', async (field, value) => {
      const res = await request(app)
        .patch(`/api/surveys/${supersededId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ [field]: value });
      expect(res.status).toBe(400);
      expect(res.body.error.details.code).toBe('SURVEY_SUPERSEDED_IMMUTABLE');
      expect(res.body.error.details.fields).toContain(field);
    });

    it('refuses re-pointing the report of a superseded survey', async () => {
      const replacement = await createDocument(projectId, 'survey-report-rev-c.pdf');
      const res = await request(app)
        .post(`/api/surveys/${supersededId}/report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ documentId: replacement.id });
      expect(res.status).toBe(400);
      expect(res.body.error.details.code).toBe('SURVEY_SUPERSEDED_IMMUTABLE');
    });

    it('refuses to move a superseded record to another state', async () => {
      const res = await request(app)
        .post(`/api/surveys/${supersededId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'returned_for_correction', returnReason: 'Too late' });
      expect(res.status).toBe(400);
      expect(res.body.error.details.code).toBe('SURVEY_SUPERSEDED_IMMUTABLE');
    });

    it('rejects an unknown key outright rather than ignoring it', async () => {
      await request(app)
        .patch(`/api/surveys/${supersededId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toleranceResult: 'within' })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------------
  // AT-176 — cross-tenant and the null-lot rule.
  // -------------------------------------------------------------------------
  describe('AT-176 — tenancy', () => {
    it('(c) another tenant survey id is refused to a user who legitimately holds a project', async () => {
      await request(app)
        .get(`/api/surveys/${foreignSurveyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('(e) a subcontractor is refused on every survey surface, read and write', async () => {
      await request(app)
        .get(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${subbieToken}`)
        .expect(403);
      await request(app)
        .get(`/api/projects/${projectId}/surveys`)
        .set('Authorization', `Bearer ${subbieToken}`)
        .expect(403);
      await request(app)
        .post(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${subbieToken}`)
        .send({ kind: 'conformance' })
        .expect(403);
    });

    it('(f) ignores a projectId in the create body and refuses a cross-project lot move', async () => {
      const created = await request(app)
        .post(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${adminToken}`)
        // `.strict()` refuses the smuggled key outright, which is stronger than
        // ignoring it.
        .send({ kind: 'conformance', projectId: 'some-other-project' });
      expect(created.status).toBe(400);

      const clean = await request(app)
        .post(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ kind: 'conformance' })
        .expect(201);
      expect(clean.body.projectId).toBe(projectId);

      const moved = await request(app)
        .patch(`/api/surveys/${clean.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lotId: foreignLotId });
      expect(moved.status).toBe(400);
      expect(moved.body.error.message).toContain('Lot does not belong to this project');
    });

    it('refuses a cross-tenant report document', async () => {
      const created = await request(app)
        .post(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ kind: 'conformance' })
        .expect(201);

      const res = await request(app)
        .post(`/api/surveys/${created.body.id}/report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ documentId: foreignDocumentId });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Document does not belong to this project');
    });

    it('(g) a null-lot survey is absent from the lot list and present on the project register', async () => {
      const created = await request(app)
        .post(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ kind: 'set_out' })
        .expect(201);
      const id = created.body.id as string;

      await request(app)
        .patch(`/api/surveys/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lotId: null })
        .expect(200);

      const lotList = await request(app)
        .get(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(lotList.body.surveys.map((s: { id: string }) => s.id)).not.toContain(id);

      const register = await request(app)
        .get(`/api/projects/${projectId}/surveys?limit=200`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(register.body.surveys.map((s: { id: string }) => s.id)).toContain(id);
    });

    it('refuses another tenant on the lot and project survey reads', async () => {
      await request(app)
        .get(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .expect(403);
      await request(app)
        .get(`/api/projects/${projectId}/surveys`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // AT-178 — the warning never blocks.
  // -------------------------------------------------------------------------
  it('AT-178 — a survey whose report has not arrived warns and never blocks', async () => {
    const res = await request(app)
      .get(`/api/lots/${lotId}/surveys`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const item = res.body.readiness[0];
    expect(item).toMatchObject({
      code: 'survey_not_received',
      severity: 'warning',
      area: 'survey',
      blocksAction: false,
    });
  });

  it('AT-178 — a returned record still counts as outstanding; a received one does not', async () => {
    const lot = await createLot(projectId, `SUR-READINESS-${Date.now()}`);
    const file = async (body: Record<string, unknown>) =>
      (
        await request(app)
          .post(`/api/lots/${lot.id}/surveys`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ kind: 'conformance', surveyorName: 'J. Smith', ...body })
          .expect(201)
      ).body.id as string;

    const readinessCount = async () =>
      (
        await request(app)
          .get(`/api/lots/${lot.id}/surveys`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
      ).body.readiness[0]?.count ?? 0;

    await file({ status: 'received', reportDocumentId });
    expect(await readinessCount()).toBe(0);

    // Returned is NOT closed the way `rejected` was: the lot is still waiting on
    // a corrected report, on a one-business-day clock (research §5.6).
    const returned = await file({
      status: 'returned_for_correction',
      reportDocumentId,
      returnReason: 'Missing points either side of CH 940',
    });
    expect(await readinessCount()).toBe(1);

    // Superseding it by the corrected report clears the warning.
    const corrected = await file({ status: 'received', reportDocumentId });
    await request(app)
      .post(`/api/surveys/${returned}/supersede`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supersededById: corrected, reason: 'Corrected report' })
      .expect(200);
    expect(await readinessCount()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AT-187 — the report cannot be stranded or churned by the generic routes.
  // -------------------------------------------------------------------------
  describe('AT-187 — the survey report is protected from the generic document routes', () => {
    it('refuses deletion of a linked report with a usable 409', async () => {
      const document = await createDocument(projectId, 'linked-survey-report.pdf');
      await prisma.surveyRecord.create({
        data: { projectId, lotId, kind: 'conformance', reportDocumentId: document.id },
      });

      const res = await request(app)
        .delete(`/api/documents/${document.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(409);
      expect(res.body.error.details).toMatchObject({
        code: 'WORKFLOW_EVIDENCE_DELETE_BLOCKED',
        evidenceType: 'survey_report',
      });
      expect(await prisma.document.findUnique({ where: { id: document.id } })).not.toBeNull();
    });

    it('refuses generic versioning, so the FK cannot be left on a superseded file', async () => {
      const document = await createDocument(projectId, 'versionable-survey-report.pdf');
      const record = await prisma.surveyRecord.create({
        data: { projectId, lotId, kind: 'conformance', reportDocumentId: document.id },
      });

      const res = await request(app)
        .post(`/api/documents/${document.id}/version`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('%PDF-1.4\n%rev b\n'), {
          filename: 'rev-b.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(409);
      expect(res.body.error.details).toMatchObject({
        code: 'WORKFLOW_EVIDENCE_VERSION_BLOCKED',
        evidenceType: 'survey_report',
      });

      const after = await prisma.surveyRecord.findUnique({
        where: { id: record.id },
        select: { reportDocument: { select: { id: true, isLatestVersion: true } } },
      });
      expect(after?.reportDocument).toMatchObject({ id: document.id, isLatestVersion: true });
    });

    it('locks the report metadata once the survey record is superseded, and not before', async () => {
      const document = await createDocument(projectId, 'metadata-survey-report.pdf');
      const record = await prisma.surveyRecord.create({
        data: {
          projectId,
          lotId,
          kind: 'conformance',
          status: 'received',
          surveyorName: 'J. Smith',
          receivedById: adminUserId,
          receivedAt: new Date(),
          reportDocumentId: document.id,
        },
      });

      // Current — a metadata edit is allowed.
      await request(app)
        .patch(`/api/documents/${document.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ caption: 'Conformance survey, rev A' })
        .expect(200);

      const replacement = await prisma.surveyRecord.create({
        data: { projectId, lotId, kind: 'conformance', status: 'requested' },
      });
      await prisma.surveyRecord.update({
        where: { id: record.id },
        data: { supersededById: replacement.id },
      });

      const locked = await request(app)
        .patch(`/api/documents/${document.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ caption: 'Something else entirely' });
      expect(locked.status).toBe(409);
      expect(locked.body.error.details).toMatchObject({
        code: 'WORKFLOW_EVIDENCE_LOCKED',
        evidenceType: 'survey_report',
      });
    });
  });

  // -------------------------------------------------------------------------
  // AT-188 — survey evidence survives the retention guard.
  // -------------------------------------------------------------------------
  it('AT-188 — a project holding only a survey record refuses a permanent delete', async () => {
    const project = await createProject(companyId, 'C5SR');
    const lot = await createLot(project.id, 'RETAIN-001');
    await prisma.surveyRecord.create({
      data: { projectId: project.id, lotId: lot.id, kind: 'conformance' },
    });
    // Leave ONLY the survey record behind: the lot itself is separately counted,
    // and deleting it SET NULLs the survey's `lot_id` rather than cascading.
    await prisma.lot.delete({ where: { id: lot.id } });

    const res = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_USER_PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('Project contains retained records');
    expect(res.body.error.details.retainedRecordCounts.surveyRecords).toBe(1);

    // Archiving still succeeds.
    await request(app)
      .patch(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'archived' })
      .expect(200);
  });

  // -------------------------------------------------------------------------
  // The flag is fail-closed.
  // -------------------------------------------------------------------------
  it('is unreachable with the flag absent — §11 step 2', async () => {
    delete process.env.C5_SURVEY_RECORDS_ENABLED;
    try {
      await request(app)
        .get(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      await request(app)
        .get(`/api/projects/${projectId}/surveys`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      await request(app)
        .post(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ kind: 'conformance' })
        .expect(404);
    } finally {
      process.env.C5_SURVEY_RECORDS_ENABLED = 'true';
    }
  });
});
