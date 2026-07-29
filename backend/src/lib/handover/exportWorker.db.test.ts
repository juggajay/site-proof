// Wave D `D1c.2` — the worker end to end: claim, assemble, publish, cancel,
// sweep, download.
//
// **AT-126** the archive renders nothing · **AT-127** historical folio bytes ·
// **AT-129** omissions · **AT-135** a fenced-out worker cannot publish ·
// **AT-140** the manifest records the rule · **AT-148** expiry and legal hold ·
// §4.5.3's hard output cap, with its proof-of-catch.
//
// DB-backed against the LOCAL DISPOSABLE POSTGRES, and storage is the LOCAL
// filesystem store — no Supabase, no S3, no network. The archive is written
// under `uploads/handover-exports/…` and read straight back off disk.

import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { handoverExportsRouter } from '../../routes/handoverExports/index.js';
import { createFrozenExport } from '../../routes/handoverExports/snapshot.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../../routes/auth.js';
import { getUploadsRoot } from '../uploadPaths.js';
import { createLocalArchiveObjectStore } from './archiveObjectStore.js';
import { OutputCapExceededError } from './exportAssembly.js';
import { claimExport, publishExport, requestExportCancellation } from './exportLease.js';
import { findNextExportJob, runExportJob } from './exportRunner.js';
import { sweepHandoverArtifacts } from './exportSweeper.js';
import { runWorkerTick, startHandoverExportWorker } from './exportWorkerLoop.js';
import { placeLegalHold, releaseLegalHold } from './legalHold.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/handover-exports', handoverExportsRouter);
app.use(errorHandler);

const store = createLocalArchiveObjectStore();
const tag = `hw-${Date.now()}`;

let companyId: string;
let projectId: string;
let ownerId: string;
let ownerToken: string;
let outsiderToken: string;
let lotId: string;
let photoDocumentId: string;

/** Every member this suite freezes points at a real file on the local disk. */
function writeUpload(relative: string, contents: string): string {
  const target = path.join(getUploadsRoot(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  return `uploads/${relative}`;
}

async function freeze(scope: { kind: 'project' } | { kind: 'lots'; lotIds: string[] }) {
  const frozen = await createFrozenExport({
    projectId,
    scope,
    requestedById: ownerId,
    now: new Date('2026-07-20T04:00:00.000Z'),
  });
  return frozen.exportId;
}

function archivePathOf(fileUrl: string): string {
  return path.join(getUploadsRoot(), fileUrl.replace(/^uploads\//, ''));
}

/** A Prisma client that runs `hook` the moment the worker reads the frozen
 * ledger — the seam where an interfering cancel or lease steal lands. */
function withLedgerReadHook(hook: () => Promise<void>): typeof prisma {
  return Object.assign({}, prisma, {
    handoverExportMember: Object.assign({}, prisma.handoverExportMember, {
      findMany: async (args: Parameters<typeof prisma.handoverExportMember.findMany>[0]) => {
        const rows = await prisma.handoverExportMember.findMany(args);
        await hook();
        return rows;
      },
    }),
  }) as unknown as typeof prisma;
}

beforeAll(async () => {
  const owner = await registerTestUser(app, { fullName: 'HW Owner', emailPrefix: `${tag}-o` });
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

  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-L1`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      status: 'in_progress',
      chainageStart: 1250.4,
      chainageEnd: 1310,
    },
  });
  lotId = lot.id;

  // A photo whose sanitized name gets the chainage prefix (**AT-140**), and a
  // PDF that does not.
  const photo = await prisma.document.create({
    data: {
      projectId,
      lotId,
      documentType: 'photo',
      filename: 'pipe bedding north.jpg',
      fileUrl: writeUpload(`documents/${tag}/pipe.jpg`, 'PHOTOBYTES'),
      fileSize: 10,
      mimeType: 'image/jpeg',
      uploadedById: ownerId,
    },
  });
  photoDocumentId = photo.id;

  await prisma.document.create({
    data: {
      projectId,
      lotId,
      documentType: 'test_certificate',
      filename: 'lab report.pdf',
      fileUrl: writeUpload(`documents/${tag}/report.pdf`, 'PDFBYTES'),
      fileSize: 8,
      mimeType: 'application/pdf',
      uploadedById: ownerId,
    },
  });

  const outsider = await registerTestUser(app, {
    fullName: 'HW Outsider',
    emailPrefix: `${tag}-x`,
  });
  outsiderToken = outsider.token;
  const otherCompany = await prisma.company.create({ data: { name: `OtherCo ${tag}` } });
  await prisma.user.update({
    where: { id: outsider.userId },
    data: { companyId: otherCompany.id, roleInCompany: 'owner' },
  });
}, 180_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the worker publishes a complete archive (§4.6.2, §4.7.2)', () => {
  let exportId: string;
  let fileUrl: string;

  it('claims, assembles, and CAS-publishes', async () => {
    exportId = await freeze({ kind: 'project' });

    const outcome = await runExportJob({ exportId, leaseOwner: 'w1', store });
    expect(outcome).toBe('published');

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.status).toBe('complete');
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row.fileSize).toBeGreaterThan(0n);
    expect(row.processedMembers).toBe(row.totalMembers);
    // The lease is RELEASED by the publish, so a finished job holds nothing a
    // second worker could fence.
    expect(row.leaseToken).toBeNull();
    expect(row.expiresAt).not.toBeNull();

    fileUrl = row.fileUrl!;
    expect(fs.existsSync(archivePathOf(fileUrl))).toBe(true);
  });

  it('**AT-126** — no folio is issued, so every lot is `folio: none` and nothing is rendered', async () => {
    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    const summary = row.manifestSummary as { lotsWithoutFolio: number };
    expect(summary.lotsWithoutFolio).toBe(1);
    // The two documents are the only members; no PDF was produced by the job.
    expect(row.totalMembers).toBe(2);
  });

  it('**AT-140** — the ledger carries the chainage-prefixed path for the photo only', async () => {
    const members = await prisma.handoverExportMember.findMany({
      where: { exportId },
      orderBy: { orderKey: 'asc' },
      select: { archivePath: true, sourceId: true, state: true },
    });

    const photo = members.find((member) => member.sourceId === photoDocumentId)!;
    expect(photo.archivePath).toContain('/CH1250-1310_pipe bedding north.jpg');
    expect(members.every((member) => member.state === 'written')).toBe(true);
    expect(members.some((member) => member.archivePath.endsWith('/lab report.pdf'))).toBe(true);
  });
});

describe('§4.5.3 — the HARD OUTPUT CAP aborts, and the partial is removed', () => {
  it('fails the job with a stated reason and leaves NO object', async () => {
    const exportId = await freeze({ kind: 'lots', lotIds: [lotId] });

    const outcome = await runExportJob({
      exportId,
      leaseOwner: 'w-cap',
      store,
      // 32 bytes — smaller than one ZIP local header, so the cap trips during
      // the write rather than at the end.
      outputCapBytes: 32,
    });
    expect(outcome).toBe('failed');

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.status).toBe('failed');
    expect(row.fileUrl).toBeNull();
    expect(row.lastFailureReason).toContain('hard output cap');
    // TERMINAL: the ledger is frozen, so a retry would reproduce the same
    // bytes and trip the same cap.
    expect(row.nextAttemptAt).toBeNull();

    const directory = path.join(getUploadsRoot(), 'handover-exports', projectId, exportId);
    const leftovers = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
    expect(leftovers).toEqual([]);
  });

  // PROOF OF CATCH. Identical job, identical data — with the cap raised out of
  // the way. It COMPLETES and the object SURVIVES on disk. An archive that
  // large-and-published over an input the cap was set to refuse is exactly the
  // bug the test above catches: a job that reports success on bytes the product
  // has never been measured able to produce correctly.
  it('WITHOUT the cap the identical job completes and the object survives', async () => {
    const exportId = await freeze({ kind: 'lots', lotIds: [lotId] });

    const outcome = await runExportJob({
      exportId,
      leaseOwner: 'w-nocap',
      store,
      outputCapBytes: Number.MAX_SAFE_INTEGER,
    });
    expect(outcome).toBe('published');

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.status).toBe('complete');
    expect(Number(row.fileSize)).toBeGreaterThan(32);
    expect(fs.existsSync(archivePathOf(row.fileUrl!))).toBe(true);
  });

  it('the cap error names both numbers', () => {
    const error = new OutputCapExceededError(32, 33n);
    expect(error.message).toContain('32-byte hard output cap');
    expect(error.message).toContain('33 bytes produced');
  });
});

describe('**AT-135** — a fenced-out worker cannot publish, finalize or cancel', () => {
  it('the superseded worker CAS fails and its object is unreachable', async () => {
    const exportId = await freeze({ kind: 'lots', lotIds: [lotId] });

    // Worker A claims. Worker B then claims after the lease lapses, taking a
    // NEW token — A is fenced out but does not know it yet.
    const a = await claimExport({ exportId, leaseOwner: 'A', ttlMs: -1 });
    const b = await claimExport({ exportId, leaseOwner: 'B' });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b!.leaseToken).not.toBe(a!.leaseToken);

    // A finishes its upload and tries to publish. The compare-and-swap is the
    // whole invariant, and it REFUSES.
    const published = await publishExport({
      exportId,
      leaseToken: a!.leaseToken,
      fileUrl: 'uploads/handover-exports/stale.zip',
      sha256: 'f'.repeat(64),
      fileSize: 1n,
    });
    expect(published).toBe(false);

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.fileUrl).toBeNull();
    expect(row.status).not.toBe('complete');
    expect(row.leaseToken).toBe(b!.leaseToken);
  });

  it('a run whose lease is STOLEN mid-flight aborts and removes its own object', async () => {
    const exportId = await freeze({ kind: 'lots', lotIds: [lotId] });

    // A second worker takes the lease the instant the ledger is read. The
    // victim's next heartbeat carries a token that no longer matches, so the
    // assembly aborts before anything can be published.
    const outcome = await runExportJob({
      exportId,
      leaseOwner: 'w-victim',
      store,
      tickMs: 0,
      client: withLedgerReadHook(async () => {
        await prisma.handoverExport.update({
          where: { id: exportId },
          data: { leaseOwner: 'thief', leaseToken: 'stolen-token' },
        });
      }),
    });

    expect(outcome).toBe('cancelled');

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.status).not.toBe('complete');
    expect(row.fileUrl).toBeNull();

    const directory = path.join(getUploadsRoot(), 'handover-exports', projectId, exportId);
    const leftovers = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
    expect(leftovers).toEqual([]);
  });
});

describe('§4.7.5 — the user-facing cancel', () => {
  it('cancels a queued job through the route, and the CAS releases the lease', async () => {
    const exportId = await freeze({ kind: 'lots', lotIds: [lotId] });

    const response = await request(app)
      .post(`/api/handover-exports/${exportId}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.status).toBe('cancelled');
    expect(row.leaseToken).toBeNull();

    // And a cancelled job is not claimable — the worker never starts it.
    expect(await runExportJob({ exportId, leaseOwner: 'w2', store })).toBe('not_claimed');
  });

  it('a cancel arriving mid-assembly aborts the run and removes the partial (fixture F4)', async () => {
    const exportId = await freeze({ kind: 'lots', lotIds: [lotId] });
    const startedAt = Date.now();

    const outcome = await runExportJob({
      exportId,
      leaseOwner: 'w-cancel',
      store,
      // Heartbeat on every member, so the cancel is observed at the first one.
      tickMs: 0,
      // The requester hits cancel exactly as the ledger is read.
      client: withLedgerReadHook(async () => {
        await requestExportCancellation({ exportId, reason: 'Cancelled by the requester' });
      }),
    });

    expect(outcome).toBe('cancelled');
    // F4's cleanup bar is 30 s; this is the same assertion at test scale.
    expect(Date.now() - startedAt).toBeLessThan(30_000);

    const directory = path.join(getUploadsRoot(), 'handover-exports', projectId, exportId);
    const leftovers = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
    expect(leftovers).toEqual([]);

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.status).toBe('cancelled');
    expect(row.fileUrl).toBeNull();
  });
});

/** A download that collects the raw body rather than superagent's JSON guess. */
function rawDownload(token: string, id: string) {
  return request(app)
    .get(`/api/handover-exports/${id}/download`)
    .set('Authorization', `Bearer ${token}`)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
      res.on('error', () => callback(null, Buffer.concat(chunks)));
    });
}

async function downloadBytes(token: string, id: string): Promise<Buffer> {
  const response = await rawDownload(token, id);
  return Buffer.isBuffer(response.body) ? response.body : Buffer.alloc(0);
}

describe('§4.7.4 — the streamed download', () => {
  let exportId: string;

  beforeAll(async () => {
    exportId = await freeze({ kind: 'lots', lotIds: [lotId] });
    expect(await runExportJob({ exportId, leaseOwner: 'w-dl', store })).toBe('published');
  }, 60_000);

  it('streams the archive to the requester with `no-store`', async () => {
    const response = await rawDownload(ownerToken, exportId);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/zip');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-disposition']).toContain('.zip');
    // A real ZIP: the local file header signature is the first four bytes.
    expect((response.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  it('refuses a caller from another tenant (**AT-132**)', async () => {
    const response = await request(app)
      .get(`/api/handover-exports/${exportId}/download`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(response.status).toBe(403);
  });

  it('requires authentication', async () => {
    const response = await request(app).get(`/api/handover-exports/${exportId}/download`);
    expect(response.status).toBe(401);
  });

  it('**AT-125**-shaped: a SAME-LENGTH mutated object is never delivered as an openable archive', async () => {
    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    const onDisk = archivePathOf(row.fileUrl!);
    const original = fs.readFileSync(onDisk);

    // The clean download first, as the control: the whole archive arrives and
    // ends with the End Of Central Directory signature.
    const clean = await downloadBytes(ownerToken, exportId);
    expect(clean.length).toBe(Number(row.fileSize));
    expect(clean.subarray(clean.length - 22, clean.length - 18)).toEqual(
      Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    );

    // Now flip ONE byte in the middle — SAME LENGTH, so `Content-Length` still
    // matches and only the SHA differs. This is the case a verify-at-flush
    // implementation cannot catch in time, and the withheld tail is what makes
    // it catchable.
    const tampered = Buffer.from(original);
    tampered[Math.floor(tampered.length / 2)] ^= 0xff;
    fs.writeFileSync(onDisk, tampered);

    const served = await downloadBytes(ownerToken, exportId).catch(() => Buffer.alloc(0));

    // Short by the withheld tail (or empty, if the client aborted first) — and
    // critically, WITHOUT the central directory, so no reader will open it.
    expect(served.length).toBeLessThan(clean.length);
    expect(served.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(false);

    fs.writeFileSync(onDisk, original);
  });

  it('refuses to download a job that has not completed', async () => {
    const queued = await freeze({ kind: 'lots', lotIds: [lotId] });
    const response = await request(app)
      .get(`/api/handover-exports/${queued}/download`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('HANDOVER_EXPORT_NOT_READY');
  });
});

describe('§4.6.3 — what the worker picks up, and what it leaves alone', () => {
  it('claims a queued job, skips a completed one, and honours the retry backoff', async () => {
    const queued = await freeze({ kind: 'lots', lotIds: [lotId] });
    await prisma.handoverExport.updateMany({
      where: { projectId, id: { not: queued } },
      data: { status: 'complete' },
    });

    expect(await findNextExportJob(new Date())).toBe(queued);

    // A failed attempt that is waiting out its backoff is not picked up yet…
    await prisma.handoverExport.update({
      where: { id: queued },
      data: { nextAttemptAt: new Date(Date.now() + 60_000) },
    });
    expect(await findNextExportJob(new Date())).toBeNull();

    // …and is once the window passes. This is §4.6.3's restart path: a job left
    // behind is reclaimed and rebuilt from the frozen ledger.
    expect(await findNextExportJob(new Date(Date.now() + 120_000))).toBe(queued);

    await prisma.handoverExport.update({
      where: { id: queued },
      data: { status: 'complete', nextAttemptAt: null },
    });
  });

  it('reclaims a `processing` job whose lease has LAPSED (§4.6.3)', async () => {
    const abandoned = await freeze({ kind: 'lots', lotIds: [lotId] });
    await prisma.handoverExport.update({
      where: { id: abandoned },
      data: {
        status: 'processing',
        leaseOwner: 'dead-worker',
        leaseToken: 'dead-token',
        leaseExpiresAt: new Date(Date.now() - 1000),
        processedMembers: 1,
      },
    });

    expect(await findNextExportJob(new Date())).toBe(abandoned);
    expect(await runExportJob({ exportId: abandoned, leaseOwner: 'w-restart', store })).toBe(
      'published',
    );

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: abandoned } });
    // Rebuilt from the ledger, not resumed from `processedMembers` — Rev 1's
    // implication that a counter constitutes resume is what §4.6.3 forbids.
    expect(row.processedMembers).toBe(row.totalMembers);
    expect(row.status).toBe('complete');
  });
});

describe('§4.7.7 — the worker LOOP, the thing the separate process runs', () => {
  it('picks a queued job up and publishes it without anyone calling `runExportJob`', async () => {
    const exportId = await freeze({ kind: 'lots', lotIds: [lotId] });

    const worker = startHandoverExportWorker({
      store,
      leaseOwner: 'loop-worker',
      pollIntervalMs: 10,
      // The sweep is exercised on its own above; here it would only add noise.
      sweepIntervalMs: 24 * 60 * 60_000,
    });

    try {
      const deadline = Date.now() + 30_000;
      let status = 'queued';
      while (status !== 'complete' && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        status = (await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } }))
          .status;
      }
      expect(status).toBe('complete');
    } finally {
      await worker.stop();
    }
  }, 60_000);

  it('runs one tick with nothing queued and reports no work', async () => {
    await prisma.handoverExport.updateMany({
      where: { projectId, status: { in: ['queued', 'snapshotting', 'processing'] } },
      data: { status: 'complete' },
    });

    const tick = await runWorkerTick({
      store,
      leaseOwner: 'idle-worker',
      at: new Date(),
      sweepDue: false,
    });
    expect(tick).toEqual({ exportId: null, outcome: null, swept: false });
  });
});

describe('**AT-148** — expiry, the surviving row, and legal hold (§10.5)', () => {
  it('sweeps an expired archive: object gone, ROW SURVIVES with a null fileUrl', async () => {
    const exportId = await freeze({ kind: 'lots', lotIds: [lotId] });
    expect(await runExportJob({ exportId, leaseOwner: 'w-exp', store })).toBe('published');

    const before = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    await prisma.handoverExport.update({
      where: { id: exportId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await sweepHandoverArtifacts({ store });

    const after = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(after.fileUrl).toBeNull();
    expect(after.status).toBe('complete');
    expect(after.sha256).toBe(before.sha256);
    expect(fs.existsSync(archivePathOf(before.fileUrl!))).toBe(false);
  });

  it('REFUSES to sweep an artefact under legal hold, and sweeps it once released', async () => {
    const exportId = await freeze({ kind: 'lots', lotIds: [lotId] });
    expect(await runExportJob({ exportId, leaseOwner: 'w-hold', store })).toBe('published');
    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });

    await placeLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: exportId,
      reason: 'Dispute over lot 3 compaction',
      actorId: ownerId,
    });
    await prisma.handoverExport.update({
      where: { id: exportId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await sweepHandoverArtifacts({ store });
    expect(
      (await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } })).fileUrl,
    ).not.toBeNull();
    expect(fs.existsSync(archivePathOf(row.fileUrl!))).toBe(true);

    await releaseLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: exportId,
      reason: 'Dispute settled',
      actorId: ownerId,
      at: new Date(Date.now() + 1000),
    });

    await sweepHandoverArtifacts({ store });
    expect(
      (await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } })).fileUrl,
    ).toBeNull();
  });

  it('removes a superseded lease-keyed object (§4.6.2) and keeps the published one', async () => {
    const exportId = await freeze({ kind: 'lots', lotIds: [lotId] });
    expect(await runExportJob({ exportId, leaseOwner: 'w-orphan', store })).toBe('published');
    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });

    // A fenced-out worker's object: same prefix, a different token.
    const orphanKey = `handover-exports/${projectId}/${exportId}/stale-token.zip`;
    fs.writeFileSync(path.join(getUploadsRoot(), orphanKey), 'STALE');

    // Backdate past the orphan grace window.
    await prisma.handoverExport.update({
      where: { id: exportId },
      data: { requestedAt: new Date(Date.now() - 60 * 60_000) },
    });

    await sweepHandoverArtifacts({ store });

    expect(fs.existsSync(path.join(getUploadsRoot(), orphanKey))).toBe(false);
    expect(fs.existsSync(archivePathOf(row.fileUrl!))).toBe(true);
  });
});
