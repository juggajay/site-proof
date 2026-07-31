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
  describe('AT-172 — CIVOS never accepts on its own', () => {
    async function rawInsert(columns: Prisma.Sql) {
      await prisma.$executeRaw(columns);
    }

    it('(a) refuses accepted with no actor — the row Rev 1 permitted', async () => {
      await expect(
        rawInsert(Prisma.sql`
          INSERT INTO survey_records
            (id, project_id, lot_id, kind, status, surveyor_verdict, updated_at)
          VALUES
            (gen_random_uuid()::text, ${projectId}, ${lotId}, 'conformance', 'accepted',
             'conforms', NOW())
        `),
      ).rejects.toThrow(/survey_records_accepted_requires_actor_check/);
    });

    it('(b) refuses accepted_at without accepted_by', async () => {
      await expect(
        rawInsert(Prisma.sql`
          INSERT INTO survey_records
            (id, project_id, lot_id, kind, status, accepted_at, updated_at)
          VALUES
            (gen_random_uuid()::text, ${projectId}, ${lotId}, 'conformance', 'received',
             NOW(), NOW())
        `),
      ).rejects.toThrow(/survey_records_accepted_actor_check/);
    });

    it('(c) refuses accepted with a NULL verdict', async () => {
      await expect(
        rawInsert(Prisma.sql`
          INSERT INTO survey_records
            (id, project_id, lot_id, kind, status, accepted_by, accepted_at, updated_at)
          VALUES
            (gen_random_uuid()::text, ${projectId}, ${lotId}, 'conformance', 'accepted',
             ${adminUserId}, NOW(), NOW())
        `),
      ).rejects.toThrow(/survey_records_accepted_requires_verdict_check/);
    });

    it('accepts a fully attributed accepted row', async () => {
      await rawInsert(Prisma.sql`
        INSERT INTO survey_records
          (id, project_id, lot_id, kind, status, surveyor_name, surveyor_verdict,
           accepted_by, accepted_at, updated_at)
        VALUES
          (gen_random_uuid()::text, ${projectId}, ${lotId}, 'conformance', 'accepted',
           'J. Smith', 'conforms', ${adminUserId}, NOW(), NOW())
      `);
      expect(
        await prisma.surveyRecord.count({
          where: { projectId, status: 'accepted', surveyorName: 'J. Smith' },
        }),
      ).toBe(1);
    });

    it('refuses a status, kind or verdict outside the CHECK vocabularies', async () => {
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

    it('takes the short path requested -> received when the report is attached', async () => {
      const created = await createSurvey({ reportDocumentId }).expect(201);
      const res = await request(app)
        .post(`/api/surveys/${created.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'received' })
        .expect(200);
      expect(res.body.status).toBe('received');
      expect(res.body.reviewedById).toBeTruthy();
    });

    it('takes the short path requested -> accepted with report, surveyor and verdict', async () => {
      const created = await createSurvey({
        reportDocumentId,
        surveyorName: 'J. Smith',
        surveyorVerdict: 'conforms',
      }).expect(201);

      const res = await request(app)
        .post(`/api/surveys/${created.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'accepted' })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'accepted', acceptedById: adminUserId });
      expect(res.body.acceptedAt).toBeTruthy();
    });

    it('creates directly at a non-default status, subject to the same gates', async () => {
      const straightToAccepted = await createSurvey({
        status: 'accepted',
        reportDocumentId,
        surveyorName: 'J. Smith',
        surveyorVerdict: 'not_stated',
      }).expect(201);
      expect(straightToAccepted.body).toMatchObject({
        status: 'accepted',
        surveyorVerdict: 'not_stated',
        acceptedById: adminUserId,
      });

      // The gates still apply on creation: no report, no `received`.
      const noReport = await createSurvey({ status: 'received' });
      expect(noReport.status).toBe(400);
      expect(noReport.body.error.code).toBe('SURVEY_REPORT_REQUIRED');

      // No verdict, no acceptance — `'not_stated'` is a verdict, absence is not.
      const noVerdict = await createSurvey({
        status: 'accepted',
        reportDocumentId,
        surveyorName: 'J. Smith',
      });
      expect(noVerdict.status).toBe(400);
      expect(noVerdict.body.error.details.code).toBe('SURVEYOR_VERDICT_REQUIRED');
    });

    it('refuses every pair outside the map, and treats accepted/rejected as terminal', async () => {
      const created = await createSurvey({ reportDocumentId }).expect(201);
      const id = created.body.id as string;

      // requested -> rejected is not an edge.
      const badEdge = await request(app)
        .post(`/api/surveys/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'rejected' });
      expect(badEdge.status).toBe(400);
      expect(badEdge.body.error.details.code).toBe('INVALID_SURVEY_TRANSITION');

      await request(app)
        .post(`/api/surveys/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'received' })
        .expect(200);
      await request(app)
        .post(`/api/surveys/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'rejected', rejectionReason: 'Levels do not match the design surface' })
        .expect(200);

      // rejected is terminal.
      const fromTerminal = await request(app)
        .post(`/api/surveys/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'accepted' });
      expect(fromTerminal.status).toBe(400);
      expect(fromTerminal.body.error.details.allowedTransitions).toEqual([]);
    });

    it('lets a site engineer move a survey along but not accept it', async () => {
      const created = await createSurvey(
        { reportDocumentId, surveyorName: 'J. Smith', surveyorVerdict: 'conforms' },
        engineerToken,
      ).expect(201);

      await request(app)
        .post(`/api/surveys/${created.body.id}/status`)
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({ status: 'received' })
        .expect(200);

      await request(app)
        .post(`/api/surveys/${created.body.id}/status`)
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({ status: 'accepted' })
        .expect(403);
    });
  });

  // -------------------------------------------------------------------------
  // AT-174 — an accepted survey resists substantive edits, field by field.
  // -------------------------------------------------------------------------
  describe('AT-174 — accepted records are closed', () => {
    let acceptedId: string;

    beforeAll(async () => {
      const created = await request(app)
        .post(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          kind: 'as_built',
          status: 'accepted',
          reportDocumentId,
          surveyorName: 'J. Smith',
          surveyorVerdict: 'qualified',
          verdictSourceNote: 'Report rev B, section 4',
        })
        .expect(201);
      acceptedId = created.body.id;
    });

    it.each([['notes']])('leaves the record accepted when only %s is edited', async (field) => {
      const res = await request(app)
        .patch(`/api/surveys/${acceptedId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ [field]: 'a working note added after acceptance' })
        .expect(200);
      expect(res.body.status).toBe('accepted');
    });

    it.each([
      ['surveyorVerdict', 'conforms'],
      ['verdictSourceNote', 'Report rev C'],
      ['surveyorName', 'Somebody Else'],
    ])('refuses a substantive edit to %s', async (field, value) => {
      const res = await request(app)
        .patch(`/api/surveys/${acceptedId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ [field]: value });
      expect(res.status).toBe(400);
      expect(res.body.error.details.code).toBe('SURVEY_ACCEPTED_IMMUTABLE');
      expect(res.body.error.details.fields).toContain(field);
    });

    it('refuses re-pointing the report of an accepted survey', async () => {
      const replacement = await createDocument(projectId, 'survey-report-rev-c.pdf');
      const res = await request(app)
        .post(`/api/surveys/${acceptedId}/report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ documentId: replacement.id });
      expect(res.status).toBe(400);
      expect(res.body.error.details.code).toBe('SURVEY_ACCEPTED_IMMUTABLE');
    });

    it('rejects an unknown key outright rather than ignoring it', async () => {
      await request(app)
        .patch(`/api/surveys/${acceptedId}`)
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
  it('AT-178 — an unaccepted survey warns and never blocks', async () => {
    const res = await request(app)
      .get(`/api/lots/${lotId}/surveys`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const item = res.body.readiness[0];
    expect(item).toMatchObject({
      code: 'survey_not_accepted',
      severity: 'warning',
      area: 'survey',
      blocksAction: false,
    });
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

    it('locks the report metadata once the survey is accepted, and not before', async () => {
      const document = await createDocument(projectId, 'metadata-survey-report.pdf');
      const record = await prisma.surveyRecord.create({
        data: {
          projectId,
          lotId,
          kind: 'conformance',
          status: 'received',
          reportDocumentId: document.id,
        },
      });

      // `received` — a metadata edit is allowed.
      await request(app)
        .patch(`/api/documents/${document.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ caption: 'Conformance survey, rev A' })
        .expect(200);

      await prisma.surveyRecord.update({
        where: { id: record.id },
        data: {
          status: 'accepted',
          surveyorName: 'J. Smith',
          surveyorVerdict: 'conforms',
          acceptedById: adminUserId,
          acceptedAt: new Date(),
        },
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
