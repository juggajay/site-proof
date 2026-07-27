/**
 * Wave B B3 §4.5 / AT12 — corporate master → project-controlled copy.
 *
 * An ITP set applied on one project is rolled out to two more, each getting its
 * OWN copy through the shipped review path, and a re-import of an updated master
 * surfaces a diff against the project's copy instead of overwriting it.
 *
 * If the corporate-master flow breaks, this fails.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../../../lib/prisma.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import { buildWorkbook } from '../../../test/itpWorkbookFixture.js';
import { registerTestUser } from '../../../test/routeTestHarness.js';
import { authRouter } from '../../auth.js';
import { copilotRouter } from '../index.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', copilotRouter);
app.use(errorHandler);

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The company's standard ITP set. `criteria` is what a revision changes. */
async function masterWorkbook(criteria = 'No visible deformation under a loaded truck') {
  return buildWorkbook([
    {
      name: 'ITP-01 Subgrade',
      rows: [
        [
          'Earthworks',
          'Proof roll the prepared subgrade',
          criteria,
          'H',
          'Contractor',
          'Proof roll',
        ],
        [
          'Earthworks',
          'Survey the subgrade surface level',
          'Within +0 / -25 mm of design',
          'W',
          'Contractor',
          'Level survey',
        ],
      ],
    },
  ]);
}

describe('Wave B B3 §4.5 — corporate master', () => {
  let companyId: string;
  let otherCompanyId: string;
  let masterProjectId: string;
  let projectBId: string;
  let projectCId: string;
  let outsiderProjectId: string;
  let pmToken: string;
  let outsiderToken: string;

  async function importAndApply(projectId: string, file: Buffer): Promise<string> {
    const uploaded = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports`)
      .set('Authorization', `Bearer ${pmToken}`)
      .attach('file', file, { filename: 'company-itps.xlsx', contentType: XLSX_MIME });
    expect(uploaded.status).toBe(201);
    return applyBatch(projectId, uploaded.body.batch.id as string);
  }

  async function applyBatch(projectId: string, batchId: string): Promise<string> {
    const dry = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${batchId}/dry-run`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ profileId: 'generic_au_itp_excel' });
    expect(dry.status).toBe(200);

    const review = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${batchId}/proposal`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({});
    expect(review.status).toBe(201);

    const decided = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${review.body.proposalId}/decision`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ action: 'accept' });
    expect(decided.status).toBe(200);
    return batchId;
  }

  async function useMaster(projectId: string, masterBatchId: string, token = pmToken) {
    return request(app)
      .post(`/api/projects/${projectId}/copilot/imports/from-master?kind=itp_template`)
      .set('Authorization', `Bearer ${token}`)
      .send({ masterBatchId });
  }

  const allProjects = () => [masterProjectId, projectBId, projectCId, outsiderProjectId];

  async function cleanup() {
    await prisma.aiProposal.deleteMany({ where: { projectId: { in: allProjects() } } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId: { in: allProjects() } } });
    await prisma.importBatch.deleteMany({ where: { projectId: { in: allProjects() } } });
    await prisma.document.deleteMany({ where: { projectId: { in: allProjects() } } });
  }

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `Master Co ${stamp}` } })).id;
    otherCompanyId = (await prisma.company.create({ data: { name: `Master Other ${stamp}` } })).id;

    const pm = await registerTestUser(app, {
      emailPrefix: 'master-pm',
      fullName: 'master-pm',
      companyId,
      roleInCompany: 'project_manager',
    });
    const outsider = await registerTestUser(app, {
      emailPrefix: 'master-outsider',
      fullName: 'master-outsider',
      companyId: otherCompanyId,
      roleInCompany: 'project_manager',
    });
    pmToken = pm.token;
    outsiderToken = outsider.token;

    const makeProject = async (label: string, company: string) =>
      (
        await prisma.project.create({
          data: {
            name: `Master ${label} ${stamp}`,
            projectNumber: `MST-${label}-${stamp}`,
            companyId: company,
            status: 'active',
            state: 'NSW',
            specificationSet: 'TfNSW',
          },
        })
      ).id;

    masterProjectId = await makeProject('A', companyId);
    projectBId = await makeProject('B', companyId);
    projectCId = await makeProject('C', companyId);
    outsiderProjectId = await makeProject('X', otherCompanyId);

    for (const projectId of [masterProjectId, projectBId, projectCId]) {
      await prisma.projectUser.create({
        data: { projectId, userId: pm.userId, role: 'project_manager', status: 'active' },
      });
    }
    await prisma.projectUser.create({
      data: {
        projectId: outsiderProjectId,
        userId: outsider.userId,
        role: 'project_manager',
        status: 'active',
      },
    });
  });

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma.projectUser.deleteMany({ where: { projectId: { in: allProjects() } } });
    await prisma.project.deleteMany({ where: { id: { in: allProjects() } } });
    await prisma.user.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  });

  it('AT12: applies to two more projects as controlled copies, each with its own provenance', async () => {
    const masterBatchId = await importAndApply(masterProjectId, await masterWorkbook());

    const listed = await request(app)
      .get(`/api/projects/${projectBId}/copilot/import-masters?kind=itp_template`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.masters).toHaveLength(1);
    expect(listed.body.masters[0]).toMatchObject({
      id: masterBatchId,
      projectId: masterProjectId,
      templateCount: 1,
    });

    for (const projectId of [projectBId, projectCId]) {
      const opened = await useMaster(projectId, masterBatchId);
      expect(opened.status).toBe(201);
      await applyBatch(projectId, opened.body.batch.id as string);

      const templates = await prisma.iTPTemplate.findMany({
        where: { projectId },
        include: { checklistItems: true },
      });
      // A COPY: project-scoped, never a shared row and never the master's own.
      expect(templates).toHaveLength(1);
      expect(templates[0].projectId).toBe(projectId);
      expect(templates[0].checklistItems).toHaveLength(2);

      // Provenance travels: this project gets its own import_source document,
      // not a pointer at another project's row.
      const batch = await prisma.importBatch.findUniqueOrThrow({
        where: { id: opened.body.batch.id as string },
        include: { sourceDocument: true },
      });
      expect(batch.status).toBe('applied');
      expect(batch.sourceDocument?.projectId).toBe(projectId);
      expect(batch.sourceDocument?.documentType).toBe('import_source');
    }

    // The master's own project still has exactly its one template.
    expect(await prisma.iTPTemplate.count({ where: { projectId: masterProjectId } })).toBe(1);
  }, 30_000);

  it('AT12: a re-imported, updated master SURFACES a diff and never overwrites the copy', async () => {
    const firstMaster = await importAndApply(masterProjectId, await masterWorkbook());
    const opened = await useMaster(projectBId, firstMaster);
    await applyBatch(projectBId, opened.body.batch.id as string);

    // The company revises the master: one criterion tightened, one item added.
    const revised = await buildWorkbook([
      {
        name: 'ITP-01 Subgrade',
        rows: [
          [
            'Earthworks',
            'Proof roll the prepared subgrade',
            'No deformation and no rutting under a loaded 3-axle truck',
            'H',
            'Contractor',
            'Proof roll',
          ],
          [
            'Earthworks',
            'Survey the subgrade surface level',
            'Within +0 / -25 mm of design',
            'W',
            'Contractor',
            'Level survey',
          ],
          [
            'Earthworks',
            'Record the moisture content before sealing',
            'Within 2% of optimum',
            'S',
            'Contractor',
            'Moisture test',
          ],
        ],
      },
    ]);
    await prisma.iTPTemplate.deleteMany({ where: { projectId: masterProjectId } });
    const revisedMaster = await importAndApply(masterProjectId, revised);

    const reopened = await useMaster(projectBId, revisedMaster);
    expect(reopened.status).toBe(201);
    const dry = await request(app)
      .post(`/api/projects/${projectBId}/copilot/imports/${reopened.body.batch.id}/dry-run`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ profileId: 'generic_au_itp_excel' });
    expect(dry.status).toBe(200);

    const row = dry.body.dryRun.rows[0];
    expect(row.reason).toBe('duplicate');
    // A visible difference, not a silent skip and not an overwrite.
    expect(row.outcome).toBe('needs_review');
    expect(row.diff).toMatchObject({ added: 1, changed: 1, removed: 0 });
    expect(row.diff.items).toEqual(
      expect.arrayContaining([
        { change: 'added', description: 'Record the moisture content before sealing' },
        { change: 'changed', description: 'Proof roll the prepared subgrade' },
      ]),
    );
    // Nothing to write: the project's copy is controlled and stays as it is.
    expect(dry.body.dryRun.canApply).toBe(false);

    const templates = await prisma.iTPTemplate.findMany({
      where: { projectId: projectBId },
      include: { checklistItems: true },
    });
    expect(templates).toHaveLength(1);
    expect(templates[0].checklistItems).toHaveLength(2);
    expect(templates[0].checklistItems.map((item) => item.acceptanceCriteria)).toContain(
      'No visible deformation under a loaded truck',
    );
  }, 30_000);

  it('an identical re-import still SKIPS, with no diff to look at', async () => {
    const masterBatchId = await importAndApply(masterProjectId, await masterWorkbook());
    const opened = await useMaster(projectBId, masterBatchId);
    await applyBatch(projectBId, opened.body.batch.id as string);

    const again = await useMaster(projectBId, masterBatchId);
    const dry = await request(app)
      .post(`/api/projects/${projectBId}/copilot/imports/${again.body.batch.id}/dry-run`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ profileId: 'generic_au_itp_excel' });
    expect(dry.body.dryRun.rows[0]).toMatchObject({ outcome: 'skip', reason: 'duplicate' });
    expect(dry.body.dryRun.rows[0].diff).toBeUndefined();
  }, 30_000);

  it('AT20: a master in a project the caller cannot read is not listed and cannot be used', async () => {
    const masterBatchId = await importAndApply(masterProjectId, await masterWorkbook());

    const listed = await request(app)
      .get(`/api/projects/${outsiderProjectId}/copilot/import-masters?kind=itp_template`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.masters).toEqual([]);

    // 404, not 403: the two replies would otherwise tell an outsider which
    // batch ids exist (§4.9's existence-leak rule).
    const used = await useMaster(outsiderProjectId, masterBatchId, outsiderToken);
    expect(used.status).toBe(404);
    expect(await prisma.importBatch.count({ where: { projectId: outsiderProjectId } })).toBe(0);
  }, 30_000);

  it('a lot register is not a corporate master', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectBId}/copilot/import-masters?kind=lot_register`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Only ITP imports can be used as a corporate master/);
  });
});
