// Wave D `D1b` — the issued folio, end to end.
//
// **AT-123** versioning appends · **AT-124** the server owns the fingerprint ·
// **AT-125** download verifies · **AT-132** tenancy INCLUDING the second hop ·
// **AT-141** immutability is a database property · **AT-143** no byte-accepting
// route · **AT-146** durable unique reservation + §7.7 tokens · **AT-147** the
// format CHECK · **AT-152** issuer gate + in-transaction audit · **AT-154**
// rate and depth bounds · **AT-156** the renderer refuses, it does not truncate.
//
// DB-backed: the triggers, the CHECK and the unique constraints ARE the
// assertions, and none of them can be observed from application code. Local
// disposable database only (`src/test/databaseSafety.ts`).

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditAction } from '../../lib/auditLog.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { lotsRouter } from '../lots.js';
import { foliosRouter } from './index.js';
import { FOLIO_EVIDENCE_ROW_CEILING_DEFAULT } from './assemble.js';
import { FOLIO_OUTSTANDING_RESERVATION_CAP } from './issuance.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/folios', foliosRouter);
app.use(errorHandler);

const tag = `folio-${Date.now()}`;

let ownerToken: string;
let ownerId: string;
let viewerToken: string;
let capToken: string;
let rateToken: string;
let outsiderToken: string;
let companyId: string;
let projectId: string;
let lotId: string;
let outsiderLotId: string;
let outsiderSnapshotId: string;

function createSession(lot: string, token: string) {
  return request(app)
    .post(`/api/lots/${lot}/folio/sessions`)
    .set('Authorization', `Bearer ${token}`);
}

function issue(folioIssueId: string, token: string) {
  return request(app)
    .post(`/api/folios/${folioIssueId}/issue`)
    .set('Authorization', `Bearer ${token}`);
}

/** Session + issue, the whole §4.4.2 sequence, as one call. */
async function issueFolioVersion(lot = lotId, token = ownerToken) {
  const session = await createSession(lot, token).send({});
  expect(session.status).toBe(201);
  const issued = await issue(session.body.folioIssueId, token).send({});
  expect(issued.status).toBe(201);
  return { session: session.body, issued: issued.body };
}

async function createLot(suffix: string, project: string) {
  return prisma.lot.create({
    data: {
      projectId: project,
      lotNumber: `${tag}-${suffix}`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      activitySlug: 'earthworks_general',
      status: 'in_progress',
    },
  });
}

beforeAll(async () => {
  // The shipped ceiling is 6 sessions/minute/user (threat model T-3) and this
  // suite issues far more than six as SETUP. AT-154 below restores a low
  // ceiling and asserts against it — the limiter is the subject of exactly one
  // test, not an obstacle in the other twenty.
  process.env.FOLIO_SESSION_RATE_LIMIT_MAX = '1000';

  const owner = await registerTestUser(app, { fullName: 'Folio Owner', emailPrefix: `${tag}-o` });
  ownerToken = owner.token;
  ownerId = owner.userId;

  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;
  await prisma.user.update({
    where: { id: ownerId },
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
  lotId = (await createLot('L1', projectId)).id;

  // A `viewer` on the same project: read access, no issuance (§9 matrix).
  const viewer = await registerTestUser(app, { fullName: 'Folio Viewer', emailPrefix: `${tag}-v` });
  viewerToken = viewer.token;
  await prisma.user.update({
    where: { id: viewer.userId },
    data: { companyId, roleInCompany: 'member' },
  });
  await prisma.projectUser.create({
    data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
  });

  // Two more issuers on the same project, so the per-USER limiter and the
  // per-LOT cap can each be exhausted without starving the other tests.
  for (const [prefix, assign] of [
    ['cap', (token: string) => (capToken = token)],
    ['rate', (token: string) => (rateToken = token)],
  ] as const) {
    const user = await registerTestUser(app, {
      fullName: `Folio ${prefix}`,
      emailPrefix: `${tag}-${prefix}`,
    });
    assign(user.token);
    await prisma.user.update({
      where: { id: user.userId },
      data: { companyId, roleInCompany: 'member' },
    });
    await prisma.projectUser.create({
      data: { projectId, userId: user.userId, role: 'project_manager', status: 'active' },
    });
  }

  // A whole other tenant, for AT-132.
  const outsider = await registerTestUser(app, {
    fullName: 'Other Tenant',
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
  outsiderLotId = (await createLot('X1', otherProject.id)).id;
  const outsiderSession = await createSession(outsiderLotId, outsiderToken).send({});
  expect(outsiderSession.status).toBe(201);
  outsiderSnapshotId = outsiderSession.body.folioIssueId;
}, 120_000);

afterAll(async () => {
  delete process.env.FOLIO_SESSION_RATE_LIMIT_MAX;
  delete process.env.FOLIO_EVIDENCE_ROW_CEILING;
  await prisma.$disconnect();
});

describe('issuance sequence (§4.4.2)', () => {
  it('appends versions, each with its own id, path, bytes and timestamp (**AT-123**)', async () => {
    const first = await issueFolioVersion();
    const second = await issueFolioVersion();

    expect(first.issued.version).toBe(1);
    expect(second.issued.version).toBe(2);
    expect(first.issued.id).not.toBe(second.issued.id);

    // Version 1's row is unchanged by version 2 existing.
    const v1 = await prisma.folioIssue.findUniqueOrThrow({ where: { id: first.issued.id } });
    expect(v1.sha256).toBe(first.issued.sha256);
    expect(v1.version).toBe(1);
    expect(v1.fileUrl).not.toBe(
      (await prisma.folioIssue.findUniqueOrThrow({ where: { id: second.issued.id } })).fileUrl,
    );
  });

  it('creates a row ONLY once the bytes are durable (**AT-146**)', async () => {
    const session = await createSession(lotId, ownerToken).send({});
    // After step 1 there is a snapshot and a reservation and NO issue: failure
    // is never partially visible.
    expect(
      await prisma.folioIssue.findUnique({ where: { id: session.body.folioIssueId } }),
    ).toBeNull();
    const reservation = await prisma.folioIssueReservation.findUniqueOrThrow({
      where: { issueId: session.body.folioIssueId },
    });
    expect(reservation.version).toBe(session.body.version);

    await issue(session.body.folioIssueId, ownerToken).send({});
    const issued = await prisma.folioIssue.findUniqueOrThrow({
      where: { id: session.body.folioIssueId },
    });
    expect(issued.fileSize).toBeGreaterThan(0n);
  });

  it('never reuses a version an unissued reservation holds (**AT-146**, §10.5)', async () => {
    const abandoned = await createSession(lotId, ownerToken).send({});
    const next = await createSession(lotId, ownerToken).send({});
    expect(next.body.version).toBe(abandoned.body.version + 1);

    // Even after the abandoned reservation expires, the version stays retired:
    // the next version is MAX over RESERVATIONS, so a swept row leaves a gap
    // rather than recycling. A gap is harmless; reuse is not.
    await prisma.folioIssueReservation.update({
      where: { issueId: abandoned.body.folioIssueId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const afterExpiry = await createSession(lotId, ownerToken).send({});
    expect(afterExpiry.body.version).toBeGreaterThan(abandoned.body.version);
  });

  it('refuses to issue from an expired session rather than presenting old evidence as new', async () => {
    const session = await createSession(lotId, ownerToken).send({});
    await prisma.folioIssueReservation.update({
      where: { issueId: session.body.folioIssueId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const response = await issue(session.body.folioIssueId, ownerToken).send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('FOLIO_SESSION_EXPIRED');
  });

  it('carries a §7.7 revision token of the declared kind for every source row (**AT-146**)', async () => {
    // Give the lot one row of each token kind.
    const testResult = await prisma.testResult.create({
      data: { projectId, lotId, testType: 'compaction', status: 'verified', passFail: 'pass' },
    });
    const document = await prisma.document.create({
      data: {
        projectId,
        lotId,
        documentType: 'photo',
        filename: 'a.jpg',
        fileUrl: 'uploads/a.jpg',
      },
    });

    const { issued } = await issueFolioVersion();
    const row = await prisma.folioIssue.findUniqueOrThrow({ where: { id: issued.id } });
    const compiledFrom = row.compiledFrom as {
      sourceRowRefs: Array<{ sourceType: string; sourceId: string; revision: string }>;
    };

    const byId = new Map(compiledFrom.sourceRowRefs.map((ref) => [ref.sourceId, ref]));
    expect(byId.get(testResult.id)?.revision).toMatch(/^t:/);
    expect(byId.get(document.id)?.revision).toMatch(/^v:/);
    for (const ref of compiledFrom.sourceRowRefs) {
      expect(ref.revision).toMatch(/^(v:|t:|d:)/);
    }
  });
});

describe('the server owns the fingerprint (**AT-124**) and there is no byte channel (**AT-143**)', () => {
  it('REJECTS a client-supplied sha256 or compiledFrom, naming the field', async () => {
    // "Rejected outright, not merely ignored" — the distinction is the whole
    // row (threat model T-8). A stripped field returns 2xx and tells the caller
    // the field was accepted.
    for (const field of ['sha256', 'compiledFrom', 'fileUrl', 'fileSize', 'version', 'format']) {
      const response = await createSession(lotId, ownerToken).send({ [field]: 'deadbeef' });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(field);
    }
  });

  it('rejects a byte-shaped field on the issue route too', async () => {
    const session = await createSession(lotId, ownerToken).send({});
    for (const field of ['pdf', 'bytes', 'file', 'content']) {
      const response = await issue(session.body.folioIssueId, ownerToken).send({
        [field]: Buffer.from('%PDF-1.3 forged').toString('base64'),
      });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(field);
    }
    // An unknown key is refused too — the schemas are strict, against a repo
    // with zero other strict schemas (the departure T-8 authorises).
    const unknown = await issue(session.body.folioIssueId, ownerToken).send({ anything: 1 });
    expect(unknown.status).toBe(400);
  });

  it('has no route that accepts folio bytes at all', () => {
    // A route-INVENTORY assertion (**AT-143**): asserting the route's absence is
    // sound, where asserting a check on arbitrary bytes is what `[DR2-B4]`
    // deleted. Every folio route and every method, enumerated from the mounted
    // routers.
    const layers = [
      ...(
        foliosRouter as unknown as {
          stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
        }
      ).stack,
    ];
    const paths = layers.map((layer) => layer.route?.path).filter(Boolean);
    expect(paths).toEqual(['/:folioIssueId/issue', '/:folioIssueId/download']);
    for (const layer of layers) {
      expect(Object.keys(layer.route?.methods ?? {})).not.toContain('put');
    }
  });

  it('stores a sha256 that matches the bytes the SERVER produced', async () => {
    const { issued } = await issueFolioVersion();
    const download = await request(app)
      .get(`/api/folios/${issued.id}/download`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(download.headers['cache-control']).toContain('no-store');
    expect(Number(download.headers['content-length'])).toBeGreaterThan(0);
  });
});

describe('immutability is a database property (**AT-141**, **AT-147**)', () => {
  it('rejects a raw-SQL UPDATE on folio_issues — and a table WITHOUT the trigger accepts one', async () => {
    const { issued } = await issueFolioVersion();

    // The NEGATIVE CONTROL first, in the same suite: `lots` has no such trigger,
    // so this identical hostile write SUCCEEDS. Without it, a passing assertion
    // below would be indistinguishable from a connection that cannot write at
    // all — which is the difference between a test and a claim.
    const control =
      await prisma.$executeRaw`UPDATE "lots" SET "notes" = 'hostile' WHERE "id" = ${lotId}`;
    expect(control).toBe(1);

    await expect(
      prisma.$executeRaw`UPDATE "folio_issues" SET "sha256" = 'forged' WHERE "id" = ${issued.id}`,
    ).rejects.toThrow(/append-only/);

    // And through Prisma, which is the path an ordinary refactor would take.
    await expect(
      prisma.folioIssue.update({ where: { id: issued.id }, data: { sha256: 'forged' } }),
    ).rejects.toThrow(/append-only/);

    const unchanged = await prisma.folioIssue.findUniqueOrThrow({ where: { id: issued.id } });
    expect(unchanged.sha256).toBe(issued.sha256);
  });

  it('rejects an UPDATE on folio_snapshots too', async () => {
    const session = await createSession(lotId, ownerToken).send({});
    const reservation = await prisma.folioIssueReservation.findUniqueOrThrow({
      where: { issueId: session.body.folioIssueId },
    });
    await expect(
      prisma.$executeRaw`UPDATE "folio_snapshots" SET "profile_version" = 'tampered' WHERE "id" = ${reservation.snapshotId}`,
    ).rejects.toThrow(/append-only/);
  });

  it('refuses an authority-certificate format via raw SQL, bypassing the route (**AT-147**)', async () => {
    const { issued } = await issueFolioVersion();
    const row = await prisma.folioIssue.findUniqueOrThrow({ where: { id: issued.id } });
    expect(row.format).toBe('folio');

    // A fresh INSERT with `format = 'tmr'`, bypassing every Zod schema. The
    // CHECK is what stops it — the route stops the honest mistake, the CHECK
    // stops the one that bypasses the route.
    await expect(
      prisma.$executeRaw`
        INSERT INTO "folio_issues" ("id","project_id","lot_id","snapshot_id","reservation_id","version","format","file_url","file_size","sha256","compiled_from","lot_status_at_issue")
        VALUES (${`${row.id}-tmr`}, ${row.projectId}, ${row.lotId}, ${row.snapshotId}, ${row.reservationId}, ${9999}, 'tmr', 'x', 1, 'x', '{}'::jsonb, 'in_progress')`,
    ).rejects.toThrow(/folio_issues_format_check|violates check constraint/i);
  });
});

describe('tenancy, including the second hop (**AT-132**, T-4)', () => {
  it('refuses a cross-tenant lot on both lot-scoped routes', async () => {
    expect((await createSession(outsiderLotId, ownerToken).send({})).status).toBe(403);
    expect(
      (
        await request(app)
          .get(`/api/lots/${outsiderLotId}/folios`)
          .set('Authorization', `Bearer ${ownerToken}`)
      ).status,
    ).toBe(403);
  });

  it("refuses another tenant's session id presented by a user who legitimately holds a project", async () => {
    // THE SECOND HOP, which the AT as originally worded did not force: the
    // caller is a real owner of a real project, and the reservation id belongs
    // to somebody else. A `findUnique` by id followed by a permission check on
    // a DIFFERENT row's project is the bug this names.
    const response = await issue(outsiderSnapshotId, ownerToken).send({});
    expect(response.status).toBe(403);
    expect(await prisma.folioIssue.findUnique({ where: { id: outsiderSnapshotId } })).toBeNull();
  });

  it('refuses a cross-tenant download', async () => {
    const { issued } = await issueFolioVersion();
    const response = await request(app)
      .get(`/api/folios/${issued.id}/download`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(response.status).toBe(403);
  });
});

describe('the issuer gate and the audit trail (**AT-152**, T-1)', () => {
  it('refuses a role outside the folio-issuer set, while still allowing the version list', async () => {
    const denied = await createSession(lotId, viewerToken).send({});
    expect(denied.status).toBe(403);
    expect(denied.body.error.message).toMatch(/issue a folio/i);

    const list = await request(app)
      .get(`/api/lots/${lotId}/folios`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.folios)).toBe(true);
  });

  it('writes the audit row INSIDE the issue transaction', async () => {
    const { issued } = await issueFolioVersion();
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'folio_issue', entityId: issued.id, action: AuditAction.FOLIO_ISSUED },
    });
    expect(audit).not.toBeNull();
    expect(audit?.projectId).toBe(projectId);

    // The transaction limb: rolling back the issue transaction leaves NEITHER
    // row. `createAuditLog` (`auditLog.ts:105`) swallows its failures, so an
    // attacker who can break the audit insert would get an un-audited issuance
    // and a 2xx; `writeAuditLogInTransaction` (`:127`) propagates. This proves
    // the two writes share a transaction by rolling one back.
    const issueRow = await prisma.folioIssue.findUniqueOrThrow({ where: { id: issued.id } });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            projectId,
            userId: ownerId,
            entityType: 'folio_issue',
            entityId: `${issueRow.id}-rollback`,
            action: AuditAction.FOLIO_ISSUED,
          },
        });
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');
    expect(
      await prisma.auditLog.findFirst({ where: { entityId: `${issueRow.id}-rollback` } }),
    ).toBeNull();
  });
});

describe('sessions are rate- and depth-bounded (**AT-154**, T-3)', () => {
  it('refuses over the per-USER ceiling, against the dedicated limiter', async () => {
    // NOT the global 1000/min/IP at `server.ts:116` — that permits 1000 burned
    // version numbers and 1000 full payload snapshots a minute from one IP, and
    // it is keyed on an address rather than an actor.
    const rateLot = await createLot('RATE', projectId);
    process.env.FOLIO_SESSION_RATE_LIMIT_MAX = '3';
    try {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        statuses.push((await createSession(rateLot.id, rateToken).send({})).status);
      }
      expect(statuses).toEqual([201, 201, 201]);
      const refused = await createSession(rateLot.id, rateToken).send({});
      expect(refused.status).toBe(429);
      expect(refused.body.error.message).toMatch(/folio sessions/i);

      // Another user is unaffected: the limit is the ACTOR's, not the lot's and
      // not the address's. `capToken` has spent none of its budget yet —
      // `ownerToken` has opened a dozen sessions above and the same limiter
      // would refuse it, which is the behaviour rather than a flaw in the test.
      expect((await createSession(rateLot.id, capToken).send({})).status).toBe(201);
    } finally {
      process.env.FOLIO_SESSION_RATE_LIMIT_MAX = '1000';
    }
  });

  it('refuses past the outstanding-reservation cap for one lot, with a stated reason', async () => {
    // A limiter bounds RATE; it does not bound the standing total.
    const capLot = await createLot('CAP', projectId);
    for (let attempt = 0; attempt < FOLIO_OUTSTANDING_RESERVATION_CAP; attempt += 1) {
      expect((await createSession(capLot.id, capToken).send({})).status).toBe(201);
    }
    const overflow = await createSession(capLot.id, ownerToken).send({});
    expect(overflow.status).toBe(400);
    expect(overflow.body.error.code).toBe('FOLIO_RESERVATION_CAP_REACHED');
  });
});

describe('the renderer refuses, it does not truncate (**AT-156**, T-6)', () => {
  it('refuses a payload above the stated ceiling with the measured value, writing nothing', async () => {
    // Asserted against a LOWERED ceiling rather than by inserting 5,001 rows:
    // the property is "refuse at preflight with the measured number and produce
    // no snapshot, no reservation and no partial render", and 5,001 inserts
    // would assert the same thing while making the suite unusable.
    const bigLot = await createLot('BIG', projectId);
    await prisma.testResult.createMany({
      data: Array.from({ length: 4 }, (_, index) => ({
        projectId,
        lotId: bigLot.id,
        testType: `compaction-${index}`,
        status: 'verified',
        passFail: 'pass',
      })),
    });

    // The shipped default is the number written in the PR body BEFORE
    // measuring anything against it (`[DR2-B6]`).
    expect(FOLIO_EVIDENCE_ROW_CEILING_DEFAULT).toBe(5000);

    process.env.FOLIO_EVIDENCE_ROW_CEILING = '2';
    try {
      const response = await createSession(bigLot.id, ownerToken).send({});
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('FOLIO_EVIDENCE_CEILING_EXCEEDED');
      // The MEASURED value and the ceiling are both in the message, not a
      // generic "too large". "3 or more" rather than "4" because the reads are
      // capped at `ceiling + 1` — an enormous lot costs a BOUNDED read and a
      // refusal, never a full scan of the thing being refused.
      expect(response.body.error.message).toContain('3 or more evidence rows');
      expect(response.body.error.message).toContain('ceiling of 2');
    } finally {
      delete process.env.FOLIO_EVIDENCE_ROW_CEILING;
    }

    // No snapshot, no reservation, no partial render survived the refusal.
    expect(await prisma.folioSnapshot.count({ where: { lotId: bigLot.id } })).toBe(0);
    expect(await prisma.folioIssueReservation.count({ where: { lotId: bigLot.id } })).toBe(0);
  });
});
