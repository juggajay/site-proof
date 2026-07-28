/**
 * Wave B B1 — the runnable end-to-end self-check.
 *
 * Drives a real .xlsx fixture through the whole pipeline against the local test
 * database: upload → parse → map → dry-run → review → apply → reconciliation →
 * rollback, plus the permission matrix, the one-proposal-per-batch invariant and
 * the upload threat model. If the importer breaks, this fails.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../../../lib/prisma.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import { registerTestUser } from '../../../test/routeTestHarness.js';
import { buildAuItpWorkbook, buildWorkbook } from '../../../test/itpWorkbookFixture.js';
import { authRouter } from '../../auth.js';
import { copilotRouter } from '../index.js';
import { applyHandlers, createProposal } from '../proposalService.js';
import { sweepAbandonedImportBatches } from './importBatchGc.js';
import { applyRetentionPolicies } from '../../../lib/dataRetention.js';
import { IMPORT_ITP_TEMPLATES_STAGE } from './itpTemplateImportExecutor.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', copilotRouter);
app.use(errorHandler);

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// The reviewer's key for the ITP-03 template: `${sheetName}::${templateName}`.
const KERB_KEY = 'ITP-03 Kerbing::ITP-03 Kerbing';

describe('Wave B — Excel ITP import', () => {
  let companyId: string;
  let otherCompanyId: string;
  let projectId: string;
  let otherProjectId: string;
  let pmToken: string;
  let qmToken: string;
  let qmUserId: string;
  let smToken: string;
  let foremanToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let workbook: Buffer;

  async function upload(token: string, file: Buffer, filename = 'itps.xlsx', mime = XLSX_MIME) {
    return request(app)
      .post(`/api/projects/${projectId}/copilot/imports`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', file, { filename, contentType: mime });
  }

  async function dryRun(batchId: string, body: Record<string, unknown>) {
    return request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${batchId}/dry-run`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ profileId: 'generic_au_itp_excel', ...body });
  }

  /** Upload + map + resolve the blocked kerb row: a batch ready for review. */
  async function batchReadyForReview(): Promise<string> {
    const uploaded = await upload(pmToken, workbook);
    expect(uploaded.status).toBe(201);
    const batchId = uploaded.body.batch.id as string;
    const resolutions = { [KERB_KEY]: { activitySlug: 'kerb_channel' } };
    const dry = await dryRun(batchId, { resolutions });
    expect(dry.status).toBe(200);
    expect(dry.body.dryRun.canApply).toBe(true);
    return batchId;
  }

  async function sendToReview(batchId: string): Promise<string> {
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${batchId}/proposal`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ resolutions: { [KERB_KEY]: { activitySlug: 'kerb_channel' } } });
    expect(res.status).toBe(201);
    return res.body.proposalId as string;
  }

  async function decide(token: string, proposalId: string, action = 'accept') {
    return request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposalId}/decision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action });
  }

  async function cleanupImports() {
    await prisma.aiProposal.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    });
    await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPTemplate.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    });
    await prisma.importBatch.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    });
    await prisma.document.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
    await prisma.importMappingProfile.deleteMany({
      where: { OR: [{ projectId }, { companyId }] },
    });
  }

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `Imp Co ${stamp}` } })).id;
    otherCompanyId = (await prisma.company.create({ data: { name: `Imp Other ${stamp}` } })).id;
    workbook = await buildAuItpWorkbook();

    const make = async (prefix: string, role: string, company = companyId) =>
      registerTestUser(app, {
        emailPrefix: prefix,
        fullName: prefix,
        companyId: company,
        roleInCompany: role,
      });

    const pm = await make('imp-pm', 'project_manager');
    const qm = await make('imp-qm', 'quality_manager');
    const sm = await make('imp-sm', 'site_manager');
    const foreman = await make('imp-foreman', 'foreman');
    const viewer = await make('imp-viewer', 'viewer');
    const outsider = await make('imp-outsider', 'project_manager', otherCompanyId);
    pmToken = pm.token;
    qmToken = qm.token;
    qmUserId = qm.userId;
    smToken = sm.token;
    foremanToken = foreman.token;
    viewerToken = viewer.token;
    outsiderToken = outsider.token;

    projectId = (
      await prisma.project.create({
        data: {
          name: `Imp Project ${stamp}`,
          projectNumber: `IMP-${stamp}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      })
    ).id;
    otherProjectId = (
      await prisma.project.create({
        data: {
          name: `Imp Other Project ${stamp}`,
          projectNumber: `IMPO-${stamp}`,
          companyId: otherCompanyId,
          status: 'active',
          state: 'QLD',
          specificationSet: 'MRTS',
        },
      })
    ).id;

    for (const [userId, role] of [
      [pm.userId, 'project_manager'],
      [qm.userId, 'quality_manager'],
      [sm.userId, 'site_manager'],
      [foreman.userId, 'foreman'],
      [viewer.userId, 'viewer'],
    ] as const) {
      await prisma.projectUser.create({ data: { projectId, userId, role, status: 'active' } });
    }
    await prisma.projectUser.create({
      data: {
        projectId: otherProjectId,
        userId: outsider.userId,
        role: 'project_manager',
        status: 'active',
      },
    });
  });

  beforeEach(cleanupImports);

  afterAll(async () => {
    await cleanupImports();
    await prisma.projectUser.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.user.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  });

  // -------------------------------------------------------------------------

  it('round-trips upload → dry-run → apply → reconcile → rollback', async () => {
    // 1. Upload + parse. The source file is persisted for provenance.
    const uploaded = await upload(pmToken, workbook);
    expect(uploaded.status).toBe(201);
    const batchId = uploaded.body.batch.id as string;
    expect(uploaded.body.sheets.map((s: { name: string }) => s.name)).toEqual([
      'ITP-01 Subgrade',
      'ITP-02 Drainage',
      'ITP-03 Kerbing',
    ]);
    expect(uploaded.body.suggestedProfile.key).toBe('generic_au_itp_excel');

    const batchRow = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batchRow.status).toBe('parsed');
    const sourceDoc = await prisma.document.findUniqueOrThrow({
      where: { id: batchRow.sourceDocumentId! },
    });
    expect(sourceDoc.documentType).toBe('import_source');

    // 2. Dry run — counts BEFORE any write, with the kerb ITP blocked.
    const first = await dryRun(batchId, {});
    expect(first.status).toBe(200);
    expect(first.body.dryRun.counts).toMatchObject({
      willCreate: 1, // ITP-01, exact activity fold
      needsReview: 1, // ITP-02, family fold
      blocked: 1, // ITP-03, unresolvable activity
    });
    expect(first.body.dryRun.canApply).toBe(false);
    expect(await prisma.iTPTemplate.count({ where: { projectId } })).toBe(0);

    // 3. Re-run with the reviewer's resolution (the dry_run -> mapped -> dry_run loop).
    const resolved = await dryRun(batchId, {
      resolutions: { [KERB_KEY]: { activitySlug: 'kerb_channel' } },
    });
    expect(resolved.body.dryRun.counts.blocked).toBe(0);
    expect(resolved.body.dryRun.canApply).toBe(true);

    // 4. Send to review: exactly ONE proposal for the batch.
    const proposalId = await sendToReview(batchId);
    const proposals = await prisma.aiProposal.findMany({ where: { importBatchId: batchId } });
    expect(proposals).toHaveLength(1);
    expect(proposals[0].id).toBe(proposalId);
    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } })).status).toBe(
      'review',
    );
    // Still nothing written.
    expect(await prisma.iTPTemplate.count({ where: { projectId } })).toBe(0);

    // 5. Apply.
    const accepted = await decide(pmToken, proposalId);
    expect(accepted.status).toBe(200);
    expect(accepted.body.proposal.status).toBe('accepted');

    const templates = await prisma.iTPTemplate.findMany({
      where: { projectId },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    expect(templates.map((t) => t.name)).toEqual([
      'ITP-01 Subgrade',
      'ITP-02 Drainage',
      'ITP-03 Kerbing',
    ]);
    // Private-tenant, always: projectId set, never the global library scope.
    expect(templates.every((t) => t.projectId === projectId)).toBe(true);
    expect(templates.map((t) => t.activityType)).toEqual([
      'earthworks_general',
      'drainage',
      'kerb_channel',
    ]);
    // The AU columns landed in the right fields.
    const subgrade = templates[0];
    expect(subgrade.checklistItems).toHaveLength(3);
    expect(subgrade.checklistItems[0]).toMatchObject({
      description: 'Proof roll subgrade with loaded truck',
      acceptanceCriteria: 'No visible deflection or rutting under a loaded 3-axle truck',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      testType: 'Proof roll',
    });
    expect(subgrade.checklistItems[2].pointType).toBe('witness');
    // Unaffirmed on import: visible candidates, but never Tier-A auto-fill.
    expect(templates.every((t) => t.specAffirmedAt === null)).toBe(true);
    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } })).status).toBe(
      'applied',
    );

    // 6. Reconciliation — imported (with ids), skipped, blocked.
    const recon = await request(app)
      .get(`/api/projects/${projectId}/copilot/imports/${batchId}/reconciliation`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(recon.status).toBe(200);
    expect(recon.body.reconciliation.createdRecordIds).toHaveLength(3);
    expect(recon.body.reconciliation.sourceAvailable).toBe(true);
    expect(
      recon.body.reconciliation.entries.filter((e: { createdId?: string }) => e.createdId),
    ).toHaveLength(3);

    const csv = await request(app)
      .get(`/api/projects/${projectId}/copilot/imports/${batchId}/reconciliation?format=csv`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('ITP-01 Subgrade');

    // 7. Roll the whole batch back.
    const rolledBack = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposalId}/rollback`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send();
    expect(rolledBack.status).toBe(200);
    expect(await prisma.iTPTemplate.count({ where: { projectId } })).toBe(0);
    expect(await prisma.iTPChecklistItem.count({ where: { template: { projectId } } })).toBe(0);
    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } })).status).toBe(
      'rolled_back',
    );
  }, 120_000);

  it('escapes a formula-leading reconciliation cell so it cannot run in Excel', async () => {
    const hostile = await buildWorkbook([
      {
        name: '=cmd|calc',
        rows: [['Earthworks', 'Proof roll', 'No deflection', 'H', 'Contractor', 'Survey']],
      },
    ]);
    const uploaded = await upload(pmToken, hostile, 'hostile.xlsx');
    const batchId = uploaded.body.batch.id as string;
    await dryRun(batchId, {});

    const csv = await request(app)
      .get(`/api/projects/${projectId}/copilot/imports/${batchId}/reconciliation?format=csv`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(csv.text).toContain("'=cmd|calc");
    expect(csv.text).not.toMatch(/"=cmd\|calc/);
  }, 60_000);

  it('refuses to apply while a row is blocked', async () => {
    const uploaded = await upload(pmToken, workbook);
    const batchId = uploaded.body.batch.id as string;
    await dryRun(batchId, {});

    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${batchId}/proposal`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/must be resolved or skipped/);
    expect(await prisma.aiProposal.count({ where: { projectId } })).toBe(0);
  }, 60_000);

  it('keeps ONE proposal per batch, and a second batch supersedes the first', async () => {
    const firstBatch = await batchReadyForReview();
    const firstProposal = await sendToReview(firstBatch);

    // Same batch again: refused.
    const again = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${firstBatch}/proposal`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({});
    expect(again.status).toBe(400);

    // A second batch supersedes the first proposal, which can no longer be decided.
    const secondBatch = await batchReadyForReview();
    const secondProposal = await sendToReview(secondBatch);
    expect(secondProposal).not.toBe(firstProposal);

    const superseded = await prisma.aiProposal.findUniqueOrThrow({ where: { id: firstProposal } });
    expect(superseded.status).toBe('superseded');
    const denied = await decide(pmToken, firstProposal);
    expect(denied.status).toBe(400);
  }, 120_000);

  it('refuses rollback when an imported ITP is already in use, and names it', async () => {
    const batchId = await batchReadyForReview();
    const proposalId = await sendToReview(batchId);
    expect((await decide(pmToken, proposalId)).status).toBe(200);

    const template = await prisma.iTPTemplate.findFirstOrThrow({
      where: { projectId, name: 'ITP-01 Subgrade' },
    });
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'L-001',
        lotType: 'general',
        activityType: 'earthworks_general',
        description: 'In use',
        itpTemplateId: template.id,
      },
    });
    await prisma.iTPInstance.create({ data: { lotId: lot.id, templateId: template.id } });

    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposalId}/rollback`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('ITP-01 Subgrade');
    // A refused rollback rolls back nothing — all three templates survive.
    expect(await prisma.iTPTemplate.count({ where: { projectId } })).toBe(3);
  }, 120_000);

  // The reviewer can rewrite the payload on accept (`editedPayload`), so apply
  // receives untrusted input and RE-ASSERTS every dry-run safety rule. These
  // cases go straight at that boundary.
  describe('apply-time re-assertion of the dry-run rules', () => {
    let proposalId: string;

    async function acceptWith(templates: unknown[]) {
      return request(app)
        .post(`/api/projects/${projectId}/copilot/proposals/${proposalId}/decision`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ action: 'accept', editedPayload: { templates } });
    }

    const validTemplate = (overrides: Record<string, unknown> = {}) => ({
      key: 'edited::edited',
      name: 'Edited ITP',
      activityType: 'earthworks_general',
      specAffirmed: false,
      checklistItems: [{ description: 'An inspection item' }],
      ...overrides,
    });

    beforeEach(async () => {
      proposalId = await sendToReview(await batchReadyForReview());
    });

    it('accepts a well-formed edit', async () => {
      const res = await acceptWith([validTemplate()]);
      expect(res.status).toBe(200);
      const created = await prisma.iTPTemplate.findMany({ where: { projectId } });
      expect(created).toHaveLength(1);
      expect(created[0].name).toBe('Edited ITP');
      // The original payload is never mutated.
      const proposal = await prisma.aiProposal.findUniqueOrThrow({ where: { id: proposalId } });
      expect(proposal.status).toBe('edited');
      expect((proposal.payload as { templates: unknown[] }).templates).toHaveLength(3);
    }, 60_000);

    it('refuses an unresolvable activity smuggled in through the edit', async () => {
      const res = await acceptWith([validTemplate({ activityType: 'Kerb & Gutter Works' })]);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/no recognised activity/);
      expect(await prisma.iTPTemplate.count({ where: { projectId } })).toBe(0);
    }, 60_000);

    it('refuses an over-length checklist description rather than truncating it', async () => {
      const res = await acceptWith([
        validTemplate({ checklistItems: [{ description: 'x'.repeat(1200) }] }),
      ]);
      expect(res.status).toBe(400);
      expect(await prisma.iTPTemplate.count({ where: { projectId } })).toBe(0);
    }, 60_000);

    it('refuses an unaffirmed contradicting spec set', async () => {
      const res = await acceptWith([validTemplate({ stateSpec: 'MRTS' })]);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Affirm it or leave it out/);
    }, 60_000);

    it('stamps the DECIDING user on an affirmed template', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/copilot/proposals/${proposalId}/decision`)
        .set('Authorization', `Bearer ${qmToken}`)
        .send({
          action: 'accept',
          editedPayload: { templates: [validTemplate({ stateSpec: 'MRTS', specAffirmed: true })] },
        });
      expect(res.status).toBe(200);

      const created = await prisma.iTPTemplate.findFirstOrThrow({ where: { projectId } });
      expect(created.specAffirmedById).toBe(qmUserId);
      expect(created.specAffirmedAt).not.toBeNull();
      expect(created.stateSpec).toBe('MRTS');
    }, 60_000);

    it('refuses a duplicate that appeared between the dry run and the accept', async () => {
      await prisma.iTPTemplate.create({
        data: { projectId, name: 'Edited ITP', activityType: 'earthworks_general' },
      });
      const res = await acceptWith([validTemplate()]);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Re-run the dry run/);
    }, 60_000);

    it('refuses two templates in one edit that collide with each other', async () => {
      const res = await acceptWith([validTemplate(), validTemplate({ name: 'edited  itp' })]);
      expect(res.status).toBe(400);
      expect(await prisma.iTPTemplate.count({ where: { projectId } })).toBe(0);
    }, 60_000);

    // Driven at the handler rather than over HTTP: a payload big enough to
    // exceed the 5,000-item cap also exceeds the JSON body limit, which would
    // mask the cap behind a 413.
    it('refuses a batch past the checklist-item cap', async () => {
      const proposal = await prisma.aiProposal.findUniqueOrThrow({ where: { id: proposalId } });
      // 11 x 490 = 5,390 items: past the 5,000 BATCH cap while each template
      // stays under the 500 per-template schema cap, so the batch cap is what
      // actually fires.
      const templates = Array.from({ length: 11 }, (_, i) =>
        validTemplate({
          key: `k${i}`,
          name: `Bulk ${i}`,
          checklistItems: Array.from({ length: 490 }, (_, j) => ({ description: `Item ${j}` })),
        }),
      );

      await expect(
        prisma.$transaction((tx) =>
          applyHandlers[IMPORT_ITP_TEMPLATES_STAGE](
            tx,
            proposal,
            { templates },
            { userId: qmUserId },
          ),
        ),
      ).rejects.toThrow(/Split the file/);
      expect(await prisma.iTPTemplate.count({ where: { projectId } })).toBe(0);
    }, 60_000);
  });

  // ---------------------------------------------------------------- security

  describe('upload threat model', () => {
    it('refuses a macro-enabled workbook by extension', async () => {
      const res = await upload(pmToken, workbook, 'macros.xlsm', XLSX_MIME);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Macro-enabled Office files/);
    });

    it('refuses a macro MIME type even under an .xlsx name', async () => {
      const res = await upload(
        pmToken,
        workbook,
        'sneaky.xlsx',
        'application/vnd.ms-excel.sheet.macroEnabled.12',
      );
      expect(res.status).toBe(400);
    });

    it('refuses a non-spreadsheet extension', async () => {
      const res = await upload(pmToken, workbook, 'notes.txt', 'text/plain');
      expect(res.status).toBe(400);
    });

    it('fails the magic-byte check on a renamed executable with a spoofed MIME type', async () => {
      const fakeExe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(4096, 0x41)]);
      const res = await upload(pmToken, fakeExe, 'payload.xlsx', XLSX_MIME);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/does not match the declared file type/i);
      // Nothing persisted for a rejected upload.
      expect(await prisma.importBatch.count({ where: { projectId } })).toBe(0);
      expect(await prisma.document.count({ where: { projectId } })).toBe(0);
    });

    it('rejects an empty upload', async () => {
      const res = await upload(pmToken, Buffer.alloc(0), 'empty.xlsx', XLSX_MIME);
      expect(res.status).toBe(400);
    });
  });

  // ------------------------------------------------------------- permissions

  describe('[WBR2-2] stage-aware decide/rollback permissions', () => {
    let proposalId: string;
    let batchId: string;

    beforeEach(async () => {
      batchId = await batchReadyForReview();
      proposalId = await sendToReview(batchId);
    });

    it('lets a quality_manager decide AND roll back an ITP import', async () => {
      const accepted = await decide(qmToken, proposalId);
      expect(accepted.status).toBe(200);

      const rolledBack = await request(app)
        .post(`/api/projects/${projectId}/copilot/proposals/${proposalId}/rollback`)
        .set('Authorization', `Bearer ${qmToken}`)
        .send();
      expect(rolledBack.status).toBe(200);
    }, 60_000);

    it('lets a site_manager decide it', async () => {
      expect((await decide(smToken, proposalId)).status).toBe(200);
    }, 60_000);

    it('lets a project_manager decide it', async () => {
      expect((await decide(pmToken, proposalId)).status).toBe(200);
    }, 60_000);

    it('refuses a foreman and a viewer', async () => {
      expect((await decide(foremanToken, proposalId)).status).toBe(403);
      expect((await decide(viewerToken, proposalId)).status).toBe(403);
      expect(await prisma.iTPTemplate.count({ where: { projectId } })).toBe(0);
    });

    it('KEEPS quality_manager OUT of lot_breakdown — Wave-1 stages are unchanged', async () => {
      const lotBreakdown = await createProposal({
        projectId,
        stage: 'lot_breakdown',
        requestedById: qmUserId,
        model: 'deterministic',
        sourceRefs: [],
        payload: {},
      });

      const res = await decide(qmToken, lotBreakdown.id);
      expect(res.status).toBe(403);
      // ...while a site_manager still can reach the stage (it fails later, on
      // the payload, not on permission).
      const smRes = await decide(smToken, lotBreakdown.id);
      expect(smRes.status).toBe(400);
    });

    it('gives a non-member 403 on the project, never a proposal-shaped 404/403 split', async () => {
      const res = await decide(outsiderToken, proposalId);
      expect(res.status).toBe(403);
    });

    it('404s an unknown proposal id for a member', async () => {
      const res = await decide(pmToken, '00000000-0000-4000-8000-000000000000');
      expect(res.status).toBe(404);
    });

    it('refuses the import endpoints to a foreman', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/copilot/imports`)
        .set('Authorization', `Bearer ${foremanToken}`);
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------- bounded artefacts

  it('[WBR2-9] returns no payload from the LIST route, but does from the detail route', async () => {
    const proposalId = await sendToReview(await batchReadyForReview());

    const list = await request(app)
      .get(`/api/projects/${projectId}/copilot/proposals`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(list.status).toBe(200);
    const listed = list.body.proposals.find((p: { id: string }) => p.id === proposalId);
    expect(listed).toBeDefined();
    expect(listed.payload).toBeUndefined();
    expect(listed.editedPayload).toBeUndefined();
    expect(listed.appliedRecordIds).toBeUndefined();
    expect(listed.importBatchId).toBeDefined();

    const detail = await request(app)
      .get(`/api/projects/${projectId}/copilot/proposals/${proposalId}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(detail.body.proposal.payload.templates).toHaveLength(3);
  }, 60_000);

  // ------------------------------------------------------------- lifecycle

  it('cancels an abandoned batch and drops its stored artefacts, keeping the source file', async () => {
    const uploaded = await upload(pmToken, workbook);
    const batchId = uploaded.body.batch.id as string;

    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${batchId}/cancel`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send();
    expect(res.status).toBe(200);

    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch.status).toBe('cancelled');
    expect(batch.parseResult).toBeNull();
    // The source Document is KEPT — the contractor uploaded it.
    expect(batch.sourceDocumentId).not.toBeNull();

    // Terminal: no transition out.
    const again = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${batchId}/cancel`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send();
    expect(again.status).toBe(400);
  }, 60_000);

  it('sweeps a 30-day-stale non-terminal batch to cancelled, nulling its artefacts', async () => {
    const uploaded = await upload(pmToken, workbook);
    const batchId = uploaded.body.batch.id as string;
    const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await prisma.$executeRaw`UPDATE import_batches SET updated_at = ${stale} WHERE id = ${batchId}`;

    const swept = await sweepAbandonedImportBatches();
    expect(swept).toBeGreaterThanOrEqual(1);

    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch.status).toBe('cancelled');
    expect(batch.parseResult).toBeNull();
    expect(batch.dryRun).toBeNull();
    expect(batch.sourceDocumentId).not.toBeNull();
  }, 60_000);

  it('the RETENTION RUN sweeps it — the sweep had no invoker at all (review §4b)', async () => {
    // `sweepAbandonedImportBatches` was written, indexed and tested, then never
    // called from anywhere but its own test, while `dataRetentionWorker` ran live
    // in production. That made the spec's retention claim false. This asserts the
    // WIRING, against real rows, through the entry point the worker uses.
    const abandoned = (await upload(pmToken, workbook)).body.batch.id as string;
    const fresh = (await upload(pmToken, workbook)).body.batch.id as string;
    const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await prisma.$executeRaw`UPDATE import_batches SET updated_at = ${stale} WHERE id = ${abandoned}`;

    const result = await applyRetentionPolicies(prisma);
    expect(result.abandonedImportBatches).toBeGreaterThanOrEqual(1);

    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id: abandoned } })).status).toBe(
      'cancelled',
    );
    // The one inside the window is untouched — a sweep that cancels live work is
    // worse than no sweep.
    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id: fresh } })).status).not.toBe(
      'cancelled',
    );
  }, 120_000);

  it('leaves an APPLIED batch alone when the sweep runs', async () => {
    const batchId = await batchReadyForReview();
    const proposalId = await sendToReview(batchId);
    await decide(pmToken, proposalId);
    await prisma.$executeRaw`UPDATE import_batches SET updated_at = ${new Date(0)} WHERE id = ${batchId}`;

    await sweepAbandonedImportBatches();

    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } })).status).toBe(
      'applied',
    );
  }, 120_000);

  // -------------------------------------------------------- tenant isolation

  it('never writes outside the importing project, and never to the global library', async () => {
    const batchId = await batchReadyForReview();
    await decide(pmToken, await sendToReview(batchId));

    expect(await prisma.iTPTemplate.count({ where: { projectId: otherProjectId } })).toBe(0);
    const globals = await prisma.iTPTemplate.count({
      where: {
        projectId: null,
        name: { in: ['ITP-01 Subgrade', 'ITP-02 Drainage', 'ITP-03 Kerbing'] },
      },
    });
    expect(globals).toBe(0);
  }, 120_000);

  it('404s a batch belonging to another project', async () => {
    const uploaded = await upload(pmToken, workbook);
    const batchId = uploaded.body.batch.id as string;

    const res = await request(app)
      .get(`/api/projects/${otherProjectId}/copilot/imports/${batchId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(404);
  }, 60_000);

  // ------------------------------------------------------- mapping profiles

  it('saves a company-scoped profile and re-applies it to a later import', async () => {
    const first = await upload(pmToken, workbook);
    const firstBatch = first.body.batch.id as string;
    const saved = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${firstBatch}/dry-run`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        profileId: 'generic_au_itp_excel',
        saveProfileName: 'Our standard ITP sheet',
        saveProfileScope: 'company',
      });
    expect(saved.status).toBe(200);

    const profiles = await request(app)
      .get(`/api/projects/${projectId}/copilot/imports-profiles`)
      .set('Authorization', `Bearer ${pmToken}`);
    const savedProfile = profiles.body.saved.find(
      (p: { name: string }) => p.name === 'Our standard ITP sheet',
    );
    expect(savedProfile).toBeDefined();

    const second = await upload(pmToken, workbook);
    const reused = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${second.body.batch.id}/dry-run`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ profileId: savedProfile.id });
    expect(reused.status).toBe(200);
    expect(reused.body.dryRun.counts.willCreate).toBe(1);
  }, 120_000);

  it('rejects a saved profile whose fieldMap targets a field outside the allow-list AT APPLY', async () => {
    const rogue = await prisma.importMappingProfile.create({
      data: {
        name: 'Rogue',
        kind: 'itp_template',
        sourceFormat: 'excel',
        projectId,
        // Saved directly, bypassing the save-time check — exactly the
        // time-of-check/time-of-use gap the apply-time gate closes.
        fieldMap: [{ target: 'projectId', source: { header: 'Activity' } }],
      },
    });

    const uploaded = await upload(pmToken, workbook);
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${uploaded.body.batch.id}/dry-run`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ profileId: rogue.id });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not a field this import can write/);
  }, 60_000);
});
