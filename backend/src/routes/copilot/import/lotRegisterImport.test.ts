/**
 * Wave B B2 — the runnable end-to-end self-check for the lot-register importer.
 *
 * Drives a real .xlsx register through the whole pipeline against the local test
 * database: upload → parse → map → dry-run → review → apply → reconciliation →
 * rollback, plus the permission split against the ITP import and the apply-time
 * re-assertion of the rules the dry run enforced. If the importer breaks, this
 * fails.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildCsv, buildCsvBrandingRows } from '../../../lib/csvSafe.js';
import { prisma } from '../../../lib/prisma.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import { registerTestUser } from '../../../test/routeTestHarness.js';
import { buildLotRegisterWorkbook } from '../../../test/itpWorkbookFixture.js';
import { authRouter } from '../../auth.js';
import { copilotRouter } from '../index.js';
import { applyHandlers } from '../proposalService.js';
import { IMPORT_LOT_REGISTER_STAGE } from './lotRegisterImportExecutor.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', copilotRouter);
app.use(errorHandler);

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PROFILE = 'generic_au_lot_register_excel';
// The reviewer's key for the activity-less L-003 row (sheet row 4).
const L003_KEY = 'lot:Lot Register#4';
const RESOLVE_L003 = { [L003_KEY]: { activitySlug: 'culverts' } };

describe('Wave B — lot register import', () => {
  let companyId: string;
  let projectId: string;
  let pmToken: string;
  let qmToken: string;
  let foremanToken: string;
  let register: Buffer;

  async function upload(token: string, file: Buffer, filename = 'lots.xlsx') {
    return request(app)
      .post(`/api/projects/${projectId}/copilot/imports?kind=lot_register`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', file, { filename, contentType: XLSX_MIME });
  }

  async function dryRun(batchId: string, body: Record<string, unknown> = {}) {
    return request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${batchId}/dry-run`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ profileId: PROFILE, ...body });
  }

  /** Upload + map + resolve the blocked row: a batch ready for review. */
  async function batchReadyForReview(): Promise<string> {
    const uploaded = await upload(pmToken, register);
    expect(uploaded.status).toBe(201);
    const batchId = uploaded.body.batch.id as string;
    const dry = await dryRun(batchId, { resolutions: RESOLVE_L003 });
    expect(dry.status).toBe(200);
    expect(dry.body.dryRun.canApply).toBe(true);
    return batchId;
  }

  async function sendToReview(batchId: string): Promise<string> {
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${batchId}/proposal`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ resolutions: RESOLVE_L003 });
    expect(res.status).toBe(201);
    return res.body.proposalId as string;
  }

  async function decide(token: string, proposalId: string, action = 'accept') {
    return request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposalId}/decision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action });
  }

  async function cleanup() {
    await prisma.aiProposal.deleteMany({ where: { projectId } });
    await prisma.comment.deleteMany({
      where: {
        entityType: 'Lot',
        entityId: {
          in: (await prisma.lot.findMany({ where: { projectId }, select: { id: true } })).map(
            (lot) => lot.id,
          ),
        },
      },
    });
    await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.importBatch.deleteMany({ where: { projectId } });
    await prisma.document.deleteMany({ where: { projectId } });
  }

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `LotImp Co ${stamp}` } })).id;
    register = await buildLotRegisterWorkbook();

    const make = (prefix: string, role: string) =>
      registerTestUser(app, {
        emailPrefix: prefix,
        fullName: prefix,
        companyId,
        roleInCompany: role,
      });

    const pm = await make('lotimp-pm', 'project_manager');
    const qm = await make('lotimp-qm', 'quality_manager');
    const foreman = await make('lotimp-foreman', 'foreman');
    pmToken = pm.token;
    qmToken = qm.token;
    foremanToken = foreman.token;

    projectId = (
      await prisma.project.create({
        data: {
          name: `LotImp Project ${stamp}`,
          projectNumber: `LOTIMP-${stamp}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      })
    ).id;

    for (const [userId, role] of [
      [pm.userId, 'project_manager'],
      [qm.userId, 'quality_manager'],
      [foreman.userId, 'foreman'],
    ] as const) {
      await prisma.projectUser.create({ data: { projectId, userId, role, status: 'active' } });
    }
  });

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  // -------------------------------------------------------------------------

  it('round-trips upload → dry-run → apply → reconcile → rollback', async () => {
    const template = await prisma.iTPTemplate.create({
      data: { projectId, name: 'ITP-01 Subgrade', activityType: 'earthworks_general' },
    });

    // 1. Upload + parse. The source file is persisted for provenance, and is
    //    kept OUT of the client-visible register.
    const uploaded = await upload(pmToken, register);
    expect(uploaded.status).toBe(201);
    const batchId = uploaded.body.batch.id as string;
    expect(uploaded.body.batch.kind).toBe('lot_register');
    expect(uploaded.body.suggestedProfile.key).toBe(PROFILE);

    const source = await prisma.document.findFirst({ where: { projectId } });
    expect(source?.documentType).toBe('import_source');

    // 2. Dry run: counts BEFORE any write, and the activity-less row blocked.
    const first = await dryRun(batchId);
    expect(first.status).toBe(200);
    expect(first.body.dryRun.canApply).toBe(false);
    expect(first.body.dryRun.counts).toMatchObject({ willCreate: 1, needsReview: 1, blocked: 1 });
    expect(await prisma.lot.count({ where: { projectId } })).toBe(0);

    // 3. Re-map loop: the reviewer resolves the blocked activity and looks again.
    const second = await dryRun(batchId, { resolutions: RESOLVE_L003 });
    expect(second.body.dryRun.canApply).toBe(true);
    expect(second.body.dryRun.counts.blocked).toBe(0);

    // 4. One proposal for the batch.
    const proposalId = await sendToReview(batchId);
    const batchAfterReview = await prisma.importBatch.findUnique({ where: { id: batchId } });
    expect(batchAfterReview?.status).toBe('review');
    const proposal = await prisma.aiProposal.findUnique({ where: { id: proposalId } });
    expect(proposal?.stage).toBe(IMPORT_LOT_REGISTER_STAGE);
    expect(proposal?.importBatchId).toBe(batchId);

    // 5. Apply through the ordinary decision route.
    const accepted = await decide(pmToken, proposalId);
    expect(accepted.status).toBe(200);

    const lots = await prisma.lot.findMany({
      where: { projectId },
      orderBy: { lotNumber: 'asc' },
      include: { itpInstance: true },
    });
    expect(lots.map((lot) => lot.lotNumber)).toEqual(['L-001', 'L-002', 'L-003']);
    expect(lots[0].activityType).toBe('earthworks_general');
    expect(Number(lots[0].chainageStart)).toBe(0);
    expect(Number(lots[0].chainageEnd)).toBe(100);
    // The register named an ITP this project has, so the lot is born with it.
    expect(lots[0].itpTemplateId).toBe(template.id);
    expect(lots[0].itpInstance).not.toBeNull();
    expect(lots[1].itpTemplateId).toBeNull();
    expect(lots[2].activityType).toBe('culverts');

    expect((await prisma.importBatch.findUnique({ where: { id: batchId } }))?.status).toBe(
      'applied',
    );

    // 6. Reconciliation: what imported, with ids, and what was skipped and why.
    const report = await request(app)
      .get(`/api/projects/${projectId}/copilot/imports/${batchId}/reconciliation`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(report.status).toBe(200);
    expect(report.body.reconciliation.createdRecordIds).toHaveLength(3);
    const created = report.body.reconciliation.entries.find(
      (entry: { label: string }) => entry.label === 'L-001',
    );
    expect(created.createdId).toBe(lots[0].id);

    const csv = await request(app)
      .get(`/api/projects/${projectId}/copilot/imports/${batchId}/reconciliation?format=csv`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(csv.text).toContain('Lot register import reconciliation');

    // 7. Roll the whole batch back.
    const rolledBack = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposalId}/rollback`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({});
    expect(rolledBack.status).toBe(200);
    expect(await prisma.lot.count({ where: { projectId } })).toBe(0);
    expect((await prisma.importBatch.findUnique({ where: { id: batchId } }))?.status).toBe(
      'rolled_back',
    );
  });

  it('refuses rollback when an imported lot already has work, and names it', async () => {
    const proposalId = await sendToReview(await batchReadyForReview());
    expect((await decide(pmToken, proposalId)).status).toBe(200);

    const lot = await prisma.lot.findFirstOrThrow({ where: { projectId, lotNumber: 'L-001' } });
    // Comments key off (entityType, entityId) rather than an FK, so they are the
    // cheapest real "this lot has accumulated work" signal the guard counts.
    await prisma.comment.create({
      data: { entityType: 'Lot', entityId: lot.id, content: 'Subgrade released on site.' },
    });

    const rollback = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposalId}/rollback`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({});
    expect(rollback.status).toBe(400);
    expect(rollback.body.error.message).toMatch(/Cannot undo — 1 lot\(s\)/);
    // The refusal rolls nothing back — one transaction.
    expect(await prisma.lot.count({ where: { projectId } })).toBe(3);
  });

  it('auto-skips a lot number the project already has rather than colliding', async () => {
    await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'L-001',
        activityType: 'earthworks_general',
        lotType: 'chainage',
      },
    });

    const uploaded = await upload(pmToken, register);
    const dry = await dryRun(uploaded.body.batch.id, { resolutions: RESOLVE_L003 });
    const skipped = dry.body.dryRun.rows.find((row: { label: string }) => row.label === 'L-001');
    expect(skipped).toMatchObject({ outcome: 'skip', reason: 'duplicate' });

    const proposalId = await sendToReview(uploaded.body.batch.id);
    expect((await decide(pmToken, proposalId)).status).toBe(200);
    expect(await prisma.lot.count({ where: { projectId, lotNumber: 'L-001' } })).toBe(1);
  });

  it('refuses to send a batch with blocked rows to review', async () => {
    const uploaded = await upload(pmToken, register);
    await dryRun(uploaded.body.batch.id);
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${uploaded.body.batch.id}/proposal`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/must be resolved or skipped/);
    expect(await prisma.aiProposal.count({ where: { projectId } })).toBe(0);
  });

  describe('apply-time re-assertion', () => {
    async function applyPayload(payload: unknown) {
      return prisma.$transaction((tx) =>
        applyHandlers[IMPORT_LOT_REGISTER_STAGE](
          tx,
          { id: 'p', projectId, importBatchId: null } as never,
          payload,
          { userId: 'u' },
        ),
      );
    }

    it('accepts a well-formed edit', async () => {
      const groups = await applyPayload({
        lots: [{ lotNumber: 'E-1', activityType: 'earthworks_general' }],
      });
      expect(groups[0]).toMatchObject({ model: 'Lot' });
    });

    it('refuses an unrecognised activity smuggled in through the edit', async () => {
      await expect(
        applyPayload({ lots: [{ lotNumber: 'E-2', activityType: 'Tunnelling' }] }),
      ).rejects.toThrow(/no recognised activity/);
    });

    it('refuses an EMPTY activity rather than defaulting it to Earthworks', async () => {
      await expect(applyPayload({ lots: [{ lotNumber: 'E-3' }] })).rejects.toThrow(
        /no recognised activity/,
      );
    });

    it('refuses a lot number that became taken between the dry run and the accept', async () => {
      await prisma.lot.create({
        data: {
          projectId,
          lotNumber: 'E-4',
          activityType: 'earthworks_general',
          lotType: 'chainage',
        },
      });
      await expect(
        applyPayload({ lots: [{ lotNumber: 'E-4', activityType: 'earthworks_general' }] }),
      ).rejects.toThrow(/already exist in this project/);
    });

    it('refuses a testScale the project spec does not use', async () => {
      await expect(
        applyPayload({
          lots: [{ lotNumber: 'E-5', activityType: 'earthworks_general', testScale: 'Z' }],
        }),
      ).rejects.toThrow(/testing scale/i);
    });
  });

  describe('permissions', () => {
    it('lets a project_manager decide a lot-register import', async () => {
      const proposalId = await sendToReview(await batchReadyForReview());
      expect((await decide(pmToken, proposalId)).status).toBe(200);
    });

    it('KEEPS a quality_manager out — a QM is not a lot setup manager', async () => {
      const proposalId = await sendToReview(await batchReadyForReview());
      expect((await decide(qmToken, proposalId)).status).toBe(403);
    });

    it('refuses the import endpoints to a foreman', async () => {
      expect((await upload(foremanToken, register)).status).toBe(403);
      const batchId = await batchReadyForReview();
      const res = await request(app)
        .get(`/api/projects/${projectId}/copilot/imports/${batchId}`)
        .set('Authorization', `Bearer ${foremanToken}`);
      expect(res.status).toBe(403);
    });

    it('refuses a QM the lot-register endpoints, while ITP imports stay open to them', async () => {
      expect((await upload(qmToken, register)).status).toBe(403);
      const itp = await request(app)
        .post(`/api/projects/${projectId}/copilot/imports?kind=itp_template`)
        .set('Authorization', `Bearer ${qmToken}`)
        .attach('file', register, { filename: 'x.xlsx', contentType: XLSX_MIME });
      expect(itp.status).toBe(201);
    });
  });

  it('keeps the two kinds apart: a lot batch is not listed as an ITP batch', async () => {
    await upload(pmToken, register);
    const lotList = await request(app)
      .get(`/api/projects/${projectId}/copilot/imports?kind=lot_register`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(lotList.body.batches).toHaveLength(1);

    const itpList = await request(app)
      .get(`/api/projects/${projectId}/copilot/imports?kind=itp_template`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(itpList.body.batches).toHaveLength(0);
  });

  /**
   * M10: SiteProof's own "Export Lots to CSV" is the ONLY export format the lot
   * register has, and for a while the importer refused `.csv` outright — a PM
   * who exported a register for a subcontractor could not re-import the marked-up
   * file they got back. This drives the real round trip through the real upload
   * route: branded export shape in, proposed lots out.
   */
  it('re-imports SiteProof’s own branded CSV register export', async () => {
    const exported = buildCsv([
      ...buildCsvBrandingRows('Lot Register', {
        companyName: 'Acme Civil',
        abn: '12 345 678 901',
        projectName: 'Pacific Hwy Upgrade',
      }),
      // The export's own column labels, and its own cell values.
      ['Lot Number', 'Description', 'Chainage Start', 'Chainage End', 'Activity Type', 'Status'],
      ['L-101', 'Subgrade, north bound', '1020', '1250', 'Earthworks', 'pending'],
      ['L-102', 'Pipe run', '1250', '1400', 'Earthworks', 'pending'],
    ]);

    const uploaded = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports?kind=lot_register`)
      .set('Authorization', `Bearer ${pmToken}`)
      .attach('file', Buffer.from(exported, 'utf8'), {
        filename: 'lot-register-pacific-hwy-2026-07-29.csv',
        contentType: 'text/csv',
      });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.sheets[0].headers).toContain('Lot Number');

    const dry = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${uploaded.body.batch.id}/dry-run`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ fieldMap: uploaded.body.suggestedFieldMap });
    expect(dry.status).toBe(200);
    expect(dry.body.dryRun.canApply).toBe(true);
    expect(dry.body.dryRun.counts).toMatchObject({ willCreate: 2, blocked: 0 });
    // The provenance block is stripped, not read as a lot.
    expect(dry.body.dryRun.rows.map((row: { label: string }) => row.label)).toEqual([
      'L-101',
      'L-102',
    ]);
  });

  // A CSV has no magic bytes, so the content gate that catches a renamed .exe
  // behind a .xlsx name passes it through. Text is the check that replaces it.
  it('refuses a binary file wearing a .csv name', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports?kind=lot_register`)
      .set('Authorization', `Bearer ${pmToken}`)
      .attach('file', Buffer.from([0x4d, 0x5a, 0x00, 0x01, 0x02]), {
        filename: 'register.csv',
        contentType: 'text/csv',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not readable text/);
  });

  it('rejects a mapping profile that targets a field the lot import may not write', async () => {
    const uploaded = await upload(pmToken, register);
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/imports/${uploaded.body.batch.id}/dry-run`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        fieldMap: [
          { target: 'lotNumber', source: { header: 'Lot Number' } },
          { target: 'status', source: { header: 'Activity' } },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not a field this import can write/);
  });
});
