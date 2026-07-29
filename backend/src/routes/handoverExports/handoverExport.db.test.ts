// Wave D `D1c.1` — the export request route, the preflight and THE FREEZE.
//
// **AT-130** the cap refuses and stores nothing · **AT-132** tenancy · the
// version-pinning half of **AT-127** (a reissue after the freeze does not move
// the ledger) · §9's permission matrix.
//
// DB-backed: the freeze is a transaction over two tables with a unique
// constraint on `(export_id, archive_path)`, and "no row was written" is the
// assertion AT-130 actually makes. Local disposable database only.

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { ADMISSION_CAP_BYTES } from '../../lib/handover/exportPreflight.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { handoverExportsRouter, projectHandoverExportsRouter } from './index.js';
import { resolveScopeLots } from './scope.js';
import { enumerateMembers } from './snapshot.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', projectHandoverExportsRouter);
app.use('/api/handover-exports', handoverExportsRouter);
app.use(errorHandler);

const tag = `hx-${Date.now()}`;

let ownerToken: string;
let viewerToken: string;
let outsiderToken: string;
let companyId: string;
let projectId: string;
let lotId: string;
let capProjectId: string;
let outsiderProjectId: string;
let outsiderLotId: string;
let folioV1Id: string;

function createExport(project: string, token: string, scope: unknown) {
  return request(app)
    .post(`/api/projects/${project}/handover-exports`)
    .set('Authorization', `Bearer ${token}`)
    .send({ scope });
}

async function createLot(suffix: string, project: string, chainage: [number, number] | null) {
  return prisma.lot.create({
    data: {
      projectId: project,
      lotNumber: `${tag}-${suffix}`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      status: 'in_progress',
      chainageStart: chainage?.[0] ?? null,
      chainageEnd: chainage?.[1] ?? null,
    },
  });
}

/** A `FolioIssue` row and the snapshot + reservation its foreign keys need.
 * Inserted directly: `D1b`'s issuance route is exercised by its own suite, and
 * what this file needs is a versioned row to freeze against. */
async function issueFolio(lot: string, version: number): Promise<string> {
  const snapshot = await prisma.folioSnapshot.create({
    data: {
      projectId,
      lotId: lot,
      payload: {},
      payloadSchemaVersion: 1,
      profileVersion: 'test',
      sourceRowRefs: [],
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  const reservation = await prisma.folioIssueReservation.create({
    data: {
      issueId: crypto.randomUUID(),
      projectId,
      lotId: lot,
      snapshotId: snapshot.id,
      version,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  const issue = await prisma.folioIssue.create({
    data: {
      id: reservation.issueId,
      projectId,
      lotId: lot,
      snapshotId: snapshot.id,
      reservationId: reservation.issueId,
      version,
      fileUrl: `supabase://documents/folios/${projectId}/${lot}/${reservation.issueId}.pdf`,
      fileSize: 1024n,
      sha256: String(version).repeat(64).slice(0, 64),
      compiledFrom: [],
      lotStatusAtIssue: 'in_progress',
    },
  });
  return issue.id;
}

beforeAll(async () => {
  const owner = await registerTestUser(app, { fullName: 'HX Owner', emailPrefix: `${tag}-o` });
  ownerToken = owner.token;

  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;
  await prisma.user.update({
    where: { id: owner.userId },
    data: { companyId, roleInCompany: 'owner' },
  });

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
  lotId = (await createLot('L1', projectId, [1250.4, 1310])).id;

  // One photo (measured), one hold-point signature (UNMEASURED — §4.5.4), one
  // folio at version 1.
  await prisma.document.create({
    data: {
      projectId,
      lotId,
      documentType: 'photo',
      filename: 'pipe bedding north.jpg',
      fileUrl: `supabase://documents/projects/${projectId}/a.jpg`,
      fileSize: 2048,
      mimeType: 'image/jpeg',
    },
  });
  const template = await prisma.iTPTemplate.create({
    data: { projectId, name: `T ${tag}`, activityType: 'Earthworks' },
  });
  const checklistItem = await prisma.iTPChecklistItem.create({
    data: { templateId: template.id, sequenceNumber: 1, description: 'Compaction' },
  });
  await prisma.holdPoint.create({
    data: {
      lotId,
      itpChecklistItemId: checklistItem.id,
      pointType: 'hold',
      status: 'released',
      releasedAt: new Date('2026-03-01T00:00:00.000Z'),
      releaseSignatureUrl: 'data:image/png;base64,iVBORw0KGgo=',
    },
  });
  folioV1Id = await issueFolio(lotId, 1);

  // A `viewer` — project read access, NOT a requester (§9 matrix).
  const viewer = await registerTestUser(app, { fullName: 'HX Viewer', emailPrefix: `${tag}-v` });
  viewerToken = viewer.token;
  await prisma.user.update({
    where: { id: viewer.userId },
    data: { companyId, roleInCompany: 'member' },
  });
  await prisma.projectUser.create({
    data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
  });

  // A project whose documents total more than the admission cap. `fileSize` is
  // `Int`, so 5 × 2 GiB−1 is the cheapest way to exceed 7.92 GiB without
  // storing a byte.
  const capProject = await prisma.project.create({
    data: {
      name: `Cap ${tag}`,
      projectNumber: `${tag}-P3`,
      companyId,
      state: 'QLD',
      specificationSet: 'TMR',
    },
  });
  capProjectId = capProject.id;
  const capLot = await createLot('CAP', capProjectId, null);
  for (let i = 0; i < 5; i += 1) {
    await prisma.document.create({
      data: {
        projectId: capProjectId,
        lotId: capLot.id,
        documentType: 'photo',
        filename: `huge-${i}.bin`,
        fileUrl: `supabase://documents/projects/${capProjectId}/huge-${i}.bin`,
        fileSize: 2_147_483_647,
        mimeType: 'application/octet-stream',
      },
    });
  }

  // A whole other tenant, for **AT-132**.
  const outsider = await registerTestUser(app, {
    fullName: 'HX Outsider',
    emailPrefix: `${tag}-x`,
  });
  outsiderToken = outsider.token;
  const otherCompany = await prisma.company.create({ data: { name: `OtherCo ${tag}` } });
  await prisma.user.update({
    where: { id: outsider.userId },
    data: { companyId: otherCompany.id, roleInCompany: 'owner' },
  });
  const otherProject = await prisma.project.create({
    data: {
      name: `Other ${tag}`,
      projectNumber: `${tag}-P2`,
      companyId: otherCompany.id,
      state: 'QLD',
      specificationSet: 'TMR',
    },
  });
  outsiderProjectId = otherProject.id;
  outsiderLotId = (await createLot('X1', outsiderProjectId, null)).id;
}, 180_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the freeze (§4.6.1)', () => {
  it('creates the export and freezes one ledger row per member, with tokens and paths', async () => {
    const response = await createExport(projectId, ownerToken, { kind: 'project' });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('queued');
    expect(response.body.snapshotCutoffAt).toBeTruthy();

    // §4.5.4: the estimate, the unmeasured count and the assumption, on the
    // response the UI renders.
    expect(response.body.preflight.unmeasuredMemberCount).toBe(1);
    expect(String(response.body.preflight.unmeasuredAssumption)).toMatch(/conservative ceiling/);
    expect(response.body.preflight.memberCount).toBe(3);
    expect(response.body.preflight.archivesImpliedAtCap).toBe(1);

    const members = await prisma.handoverExportMember.findMany({
      where: { exportId: response.body.id },
      orderBy: { orderKey: 'asc' },
    });
    expect(members.map((m) => m.sourceType)).toEqual(['folio', 'holdpoint_signature', 'document']);
    expect(members.every((m) => m.state === 'pending')).toBe(true);

    const folio = members.find((m) => m.sourceType === 'folio')!;
    expect(folio.sourceId).toBe(folioV1Id);
    expect(folio.sourceRevision).toBe('v:1');
    expect(folio.byteSize).toBe(1024n);
    expect(folio.sourceChecksum).toBe('1'.repeat(64));

    // §4.7.3: sanitized, chainage-prefixed, under `{lot}/{category}/`.
    const photo = members.find((m) => m.sourceType === 'document')!;
    expect(photo.archivePath).toBe(`${tag}-L1/documents/CH1250-1310_pipe bedding north.jpg`);
    expect(photo.sourceRevision).toBe('v:1');

    // §4.5.4's unmeasured set: a null byte size, and a §7.7 row digest rather
    // than a version the table does not have.
    const signature = members.find((m) => m.sourceType === 'holdpoint_signature')!;
    expect(signature.byteSize).toBeNull();
    expect(signature.sourceRevision).toMatch(/^d:[0-9a-f]{64}$/);
    // The locator names the row and field — the inline `data:` URL is NOT
    // copied into the ledger.
    expect(signature.storageLocator).toMatch(/^holdpoint:\/\/.+\/releaseSignatureUrl$/);
    expect(signature.storageLocator).not.toContain('base64');
  });

  it('pins the version: a folio reissued AFTER the freeze does not move the ledger', async () => {
    const frozen = await createExport(projectId, ownerToken, { kind: 'project' });
    expect(frozen.status).toBe(201);

    const before = await prisma.handoverExportMember.findFirstOrThrow({
      where: { exportId: frozen.body.id, sourceType: 'folio' },
    });
    expect(before.sourceRevision).toBe('v:1');

    // The evidence moves underneath the frozen job — exactly §4.6.1's case.
    const folioV2Id = await issueFolio(lotId, 2);

    const after = await prisma.handoverExportMember.findFirstOrThrow({
      where: { exportId: frozen.body.id, sourceType: 'folio' },
    });
    expect(after.sourceId).toBe(before.sourceId);
    expect(after.sourceId).not.toBe(folioV2Id);
    expect(after.sourceRevision).toBe('v:1');
    expect(after.storageLocator).toBe(before.storageLocator);

    // PROOF OF CATCH, in the same test: a FRESH enumeration of the same scope
    // now returns version 2. So the assertion above is not passing because
    // nothing changed — it is passing because the LEDGER is what the archive
    // reads, and re-enumerating at write time (the bug §4.6.1 names) would have
    // switched versions halfway through.
    const lots = await resolveScopeLots(projectId, { kind: 'project' });
    const fresh = await enumerateMembers(lots);
    const freshFolio = fresh.find((m) => m.sourceType === 'folio')!;
    expect(freshFolio.sourceRevision).toBe('v:2');
    expect(freshFolio.sourceId).toBe(folioV2Id);
  });

  it('freezes ONE folio per lot — the latest version, not every version', async () => {
    const response = await createExport(projectId, ownerToken, { kind: 'project' });
    const folios = await prisma.handoverExportMember.findMany({
      where: { exportId: response.body.id, sourceType: 'folio' },
    });
    expect(folios).toHaveLength(1);
    expect(folios[0]!.sourceRevision).toBe('v:2');
  });
});

describe('**AT-130** — the cap refuses, and stores nothing', () => {
  it('refuses a scope over the admission cap with the estimate and the unmeasured count', async () => {
    const response = await createExport(capProjectId, ownerToken, { kind: 'project' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('HANDOVER_EXPORT_OVER_CAP');
    expect(response.body.error.message).toMatch(/over the 7\.9 GiB limit/);
    expect(response.body.error.message).toMatch(/archives/);

    // NOTHING was produced or stored — no export row, so no ledger either.
    expect(await prisma.handoverExport.count({ where: { projectId: capProjectId } })).toBe(0);
  });

  it('the refusal is not a truncation — the members that would not fit are still all there', async () => {
    // The scope is unchanged by the refusal: nothing was dropped to make it fit.
    const lots = await resolveScopeLots(capProjectId, { kind: 'project' });
    const members = await enumerateMembers(lots);
    expect(members).toHaveLength(5);
    const total = members.reduce((sum, m) => sum + (m.byteSize ?? 0n), 0n);
    expect(total > BigInt(ADMISSION_CAP_BYTES)).toBe(true);
  });
});

describe('scope resolution (§7.4, §4.7.6)', () => {
  it('accepts an explicit lot list and refuses one from another project (**AT-132**)', async () => {
    const ok = await createExport(projectId, ownerToken, { kind: 'lots', lotIds: [lotId] });
    expect(ok.status).toBe(201);

    const crossTenant = await createExport(projectId, ownerToken, {
      kind: 'lots',
      lotIds: [lotId, outsiderLotId],
    });
    expect(crossTenant.status).toBe(404);
    expect(
      await prisma.handoverExport.count({
        where: { projectId, scope: { equals: { kind: 'lots', lotIds: [lotId, outsiderLotId] } } },
      }),
    ).toBe(0);
  });

  it('refuses a scope that selects no lots rather than queueing an empty archive', async () => {
    const emptyProject = await prisma.project.create({
      data: {
        name: `Empty ${tag}`,
        projectNumber: `${tag}-P4`,
        companyId,
        state: 'QLD',
        specificationSet: 'TMR',
      },
    });
    const response = await createExport(emptyProject.id, ownerToken, { kind: 'project' });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/nothing to export/);
  });

  it('rejects a malformed scope outright', async () => {
    expect((await createExport(projectId, ownerToken, { kind: 'area' })).status).toBe(400);
    expect((await createExport(projectId, ownerToken, { kind: 'nope' })).status).toBe(400);
    expect(
      (
        await request(app)
          .post(`/api/projects/${projectId}/handover-exports`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ scope: { kind: 'project' }, status: 'complete' })
      ).status,
    ).toBe(400);
  });
});

describe('§9 permission matrix, and §10.1 tenancy (**AT-132**)', () => {
  it('lets the four requester roles request, and refuses a viewer', async () => {
    expect((await createExport(projectId, ownerToken, { kind: 'project' })).status).toBe(201);

    const viewer = await createExport(projectId, viewerToken, { kind: 'project' });
    expect(viewer.status).toBe(403);
    expect(viewer.body.error.message).toMatch(/Only owners, admins, project managers/);
  });

  it('refuses a cross-tenant project id on every route', async () => {
    expect((await createExport(projectId, outsiderToken, { kind: 'project' })).status).toBe(403);

    const list = await request(app)
      .get(`/api/projects/${projectId}/handover-exports`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(list.status).toBe(403);
  });

  it('resolves the detail route guard from the ROW, not from the caller', async () => {
    const created = await createExport(projectId, ownerToken, { kind: 'project' });
    const id = created.body.id;

    const mine = await request(app)
      .get(`/api/handover-exports/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.memberStates).toEqual({ pending: mine.body.totalMembers });

    const theirs = await request(app)
      .get(`/api/handover-exports/${id}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(theirs.status).toBe(403);
  });

  it('requires authentication', async () => {
    expect((await request(app).get(`/api/projects/${projectId}/handover-exports`)).status).toBe(
      401,
    );
  });
});

describe('the list and detail shapes (§9)', () => {
  it('lists the project newest first, with BigInt byte counts as strings', async () => {
    const response = await request(app)
      .get(`/api/projects/${projectId}/handover-exports`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.exports.length).toBeGreaterThan(0);
    const first = response.body.exports[0];
    expect(typeof first.totalBytes).toBe('string');
    expect(first.status).toBe('queued');
    expect(first.processedMembers).toBe(0);

    const times = response.body.exports.map((e: { requestedAt: string }) =>
      new Date(e.requestedAt).getTime(),
    );
    expect([...times].sort((a: number, b: number) => b - a)).toEqual(times);

    // Another tenant's exports are not in this project's list.
    expect(
      response.body.exports.every((e: { projectId: string }) => e.projectId === projectId),
    ).toBe(true);
  });

  it('404s an unknown export id', async () => {
    const response = await request(app)
      .get(`/api/handover-exports/${crypto.randomUUID()}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(404);
  });
});

describe('the freeze does not advance a job', () => {
  // The "has no download route" assertion was `D1c.1`'s and is RETIRED by
  // `D1c.2`, which ships §4.7.4's streamed route. Its replacement asserts the
  // property that still holds and that a regression could break: a queued
  // export has nothing to download, and the route says so with a stated code
  // rather than serving a partial. Covered in `exportWorker.db.test.ts`.
  it('leaves a freshly frozen export with no archive to download', async () => {
    const created = await createExport(projectId, ownerToken, { kind: 'project' });
    const response = await request(app)
      .get(`/api/handover-exports/${created.body.id}/download`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('HANDOVER_EXPORT_NOT_READY');
  });

  it('never advances a job — the FREEZE builds the ledger, the worker runs it', async () => {
    const rows = await prisma.handoverExport.findMany({ where: { projectId } });
    expect(rows.every((r) => r.status === 'queued')).toBe(true);
    expect(rows.every((r) => r.leaseToken === null)).toBe(true);
    expect(rows.every((r) => r.fileUrl === null && r.processedMembers === 0)).toBe(true);
    // `[DH-k]`: no entitlement, no billing check, nothing that reads as a
    // paywall. The only gate is the project-role guard.
    expect(rows.every((r) => r.uploadState === null)).toBe(true);
  });
});
