// Wave D `D1c.1` — the lease, the fencing token and legal hold.
//
// **AT-135** (cannot publish, cannot finalize, cannot cancel — `[DR2-B7]`) and
// the hold half of **AT-148**.
//
// DB-BACKED, and it has to be: every assertion here is about how many rows a
// conditional `UPDATE` matched, which is a property of the database and not
// observable from application code. Local disposable database only
// (`src/test/databaseSafety.ts`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../prisma.js';
import {
  cancelExport,
  claimExport,
  failExport,
  heartbeatExport,
  leaseObjectKey,
  LEASE_TTL_MS,
  publishExport,
} from './exportLease.js';
import {
  assertNotOnHold,
  filterHeldArtifactIds,
  isOnHold,
  latestLegalHoldEvent,
  placeLegalHold,
  releaseLegalHold,
} from './legalHold.js';

const tag = `hx-lease-${Date.now()}`;
let projectId: string;

async function createExport(status = 'processing'): Promise<string> {
  const row = await prisma.handoverExport.create({
    data: { projectId, scope: { kind: 'project' }, status },
    select: { id: true },
  });
  return row.id;
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `${tag}-P1`,
      companyId: company.id,
      state: 'QLD',
      specificationSet: 'TMR',
    },
  });
  projectId = project.id;
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the lease-token-specific storage key (§4.6.2)', () => {
  it('puts the token IN the path, so two workers cannot collide', () => {
    const a = leaseObjectKey('p1', 'e1', 'token-a');
    const b = leaseObjectKey('p1', 'e1', 'token-b');
    expect(a).toBe('handover-exports/p1/e1/token-a.zip');
    expect(a).not.toBe(b);
  });

  it('refuses a traversal in any segment', () => {
    expect(() => leaseObjectKey('../p', 'e1', 't')).toThrow(/projectId is invalid/);
    expect(() => leaseObjectKey('p', 'e/1', 't')).toThrow(/exportId is invalid/);
    expect(() => leaseObjectKey('p', 'e', '../t')).toThrow(/leaseToken is invalid/);
  });
});

describe('claiming and renewing', () => {
  it('claims a free job, and refuses a second claim while the lease is live', async () => {
    const exportId = await createExport('queued');

    const first = await claimExport({ exportId, leaseOwner: 'worker-1' });
    expect(first).not.toBeNull();
    expect(first!.leaseExpiresAt.getTime()).toBeGreaterThan(Date.now());

    const second = await claimExport({ exportId, leaseOwner: 'worker-2' });
    expect(second).toBeNull();
  });

  it('lets a second worker take over an EXPIRED lease, with a NEW token', async () => {
    const exportId = await createExport('queued');
    const stale = await claimExport({
      exportId,
      leaseOwner: 'worker-1',
      now: new Date(Date.now() - LEASE_TTL_MS * 2),
    });
    expect(stale).not.toBeNull();

    const fresh = await claimExport({ exportId, leaseOwner: 'worker-2' });
    expect(fresh).not.toBeNull();
    // A NEW token, not the old one. Reusing it would let the merely-slow
    // previous worker resume and publish — the case fencing exists for.
    expect(fresh!.leaseToken).not.toBe(stale!.leaseToken);
  });

  it('never claims a finished job', async () => {
    for (const status of ['complete', 'failed', 'cancelled']) {
      const exportId = await createExport(status);
      expect(await claimExport({ exportId, leaseOwner: 'w' })).toBeNull();
    }
  });

  it('renews on the live token and refuses the stale one', async () => {
    const exportId = await createExport();
    const live = await claimExport({ exportId, leaseOwner: 'w1' });
    expect(await heartbeatExport({ exportId, leaseToken: live!.leaseToken })).toBe(true);
    expect(await heartbeatExport({ exportId, leaseToken: 'some-other-token' })).toBe(false);
  });
});

describe('**AT-135** — a fenced-out worker cannot publish, finalize or cancel', () => {
  /** The scenario the AT names: two competing workers, an expired lease, and
   * the first one still alive and mid-upload. */
  async function fenceOut() {
    const exportId = await createExport();
    const superseded = await claimExport({
      exportId,
      leaseOwner: 'worker-1',
      now: new Date(Date.now() - LEASE_TTL_MS * 2),
    });
    const live = await claimExport({ exportId, leaseOwner: 'worker-2' });
    return { exportId, superseded: superseded!, live: live! };
  }

  it('CANNOT PUBLISH — the compare-and-swap matches zero rows', async () => {
    const { exportId, superseded, live } = await fenceOut();

    const published = await publishExport({
      exportId,
      leaseToken: superseded.leaseToken,
      fileUrl: 'supabase://documents/handover-exports/stale.zip',
      sha256: 'a'.repeat(64),
      fileSize: 123n,
    });
    expect(published).toBe(false);

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.status).toBe('processing');
    expect(row.fileUrl).toBeNull();
    // And the live worker's publish DOES land — the assertion has to fail for
    // the fenced token and succeed for the live one, or it proves nothing.
    expect(
      await publishExport({
        exportId,
        leaseToken: live.leaseToken,
        fileUrl: 'supabase://documents/handover-exports/live.zip',
        sha256: 'b'.repeat(64),
        fileSize: 456n,
      }),
    ).toBe(true);

    const published_row = await prisma.handoverExport.findUniqueOrThrow({
      where: { id: exportId },
    });
    expect(published_row.status).toBe('complete');
    expect(published_row.fileUrl).toContain('live.zip');
    expect(published_row.fileSize).toBe(456n);
    // "the published artefact is written exactly once": the lease is cleared,
    // so nothing — including the live worker — can publish over it again.
    expect(published_row.leaseToken).toBeNull();
    expect(
      await publishExport({
        exportId,
        leaseToken: live.leaseToken,
        fileUrl: 'supabase://documents/handover-exports/again.zip',
        sha256: 'c'.repeat(64),
        fileSize: 789n,
      }),
    ).toBe(false);
  });

  it('CANNOT FINALIZE — a stale failure does not land either', async () => {
    const { exportId, superseded } = await fenceOut();
    expect(await failExport({ exportId, leaseToken: superseded.leaseToken, reason: 'stale' })).toBe(
      false,
    );

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.status).toBe('processing');
    expect(row.failureCount).toBe(0);
    expect(row.lastFailureReason).toBeNull();
  });

  it('CANNOT CANCEL — cancellation is fenced by the same CAS', async () => {
    const { exportId, superseded, live } = await fenceOut();
    expect(
      await cancelExport({ exportId, leaseToken: superseded.leaseToken, reason: 'stale cancel' }),
    ).toBe(false);
    expect(
      (await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } })).status,
    ).toBe('processing');

    expect(await cancelExport({ exportId, leaseToken: live.leaseToken, reason: 'user' })).toBe(
      true,
    );
    expect(
      (await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } })).status,
    ).toBe('cancelled');
  });

  it('CAN have written its unreachable object — and that is fine (`[DR2-B7]`)', async () => {
    const { exportId, superseded, live } = await fenceOut();

    // The honest invariant. No database predicate can un-send bytes already in
    // flight to object storage, so the superseded worker's object EXISTS. It is
    // simply at a key nothing points at, because the token is in the path.
    const staleKey = leaseObjectKey(projectId, exportId, superseded.leaseToken);
    const liveKey = leaseObjectKey(projectId, exportId, live.leaseToken);
    expect(staleKey).not.toBe(liveKey);

    await publishExport({
      exportId,
      leaseToken: live.leaseToken,
      fileUrl: `supabase://documents/${liveKey}`,
      sha256: 'd'.repeat(64),
      fileSize: 1n,
    });

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.fileUrl).toContain(live.leaseToken);
    expect(row.fileUrl).not.toContain(superseded.leaseToken);
  });

  it('PROOF OF CATCH — the same scenario with an UNFENCED write lands, and would pass a weaker test', async () => {
    const { exportId, superseded } = await fenceOut();

    // This is what `publishExport` would be if the `leaseToken` condition were
    // dropped: `update({ where: { id } })`. It is unconditional, it succeeds,
    // and the superseded worker publishes over the live one. Every `toBe(false)`
    // above becomes `toBe(true)` the moment the CAS is written this way — which
    // is the whole point of asserting on the matched-row count rather than on
    // "the worker did not try".
    await prisma.handoverExport.update({
      where: { id: exportId },
      data: { status: 'complete', fileUrl: 'supabase://documents/UNFENCED.zip' },
    });

    const row = await prisma.handoverExport.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.fileUrl).toBe('supabase://documents/UNFENCED.zip');
    expect(row.status).toBe('complete');
    // And the fenced call still refuses on the same row, for the same reason.
    expect(
      await publishExport({
        exportId,
        leaseToken: superseded.leaseToken,
        fileUrl: 'x',
        sha256: 'e'.repeat(64),
        fileSize: 1n,
      }),
    ).toBe(false);
  });
});

describe('**AT-148** (hold half) — legal hold is an append-only sequence (§7.6)', () => {
  it('is held after `placed` and released after `released`, latest row winning', async () => {
    const exportId = await createExport();
    // Explicit, distinct instants: `createdAt` is millisecond-precision, and a
    // real hold and its release are days apart, not microseconds.
    const day = (n: number) => new Date(`2026-04-0${n}T00:00:00.000Z`);

    expect(await isOnHold('handover_export', exportId)).toBe(false);
    expect(await latestLegalHoldEvent('handover_export', exportId)).toBeNull();

    await placeLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: exportId,
      reason: 'Subpoena 2026/114',
      actorId: null,
      at: day(1),
    });
    expect(await isOnHold('handover_export', exportId)).toBe(true);

    await releaseLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: exportId,
      reason: 'Matter closed',
      actorId: null,
      at: day(2),
    });
    expect(await isOnHold('handover_export', exportId)).toBe(false);

    // Held again — the sequence, not a boolean, is the record.
    await placeLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: exportId,
      reason: 'Reopened',
      actorId: null,
      at: day(3),
    });
    expect(await isOnHold('handover_export', exportId)).toBe(true);

    // Every event survives: "who put this on hold, when, and why", answerable
    // two years later.
    const rows = await prisma.artifactLegalHold.findMany({
      where: { artifactType: 'handover_export', artifactId: exportId },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.action)).toEqual(['placed', 'released', 'placed']);
    expect(rows.map((r) => r.reason)).toEqual(['Subpoena 2026/114', 'Matter closed', 'Reopened']);
  });

  it('requires a stated reason — an empty one defeats the only question it answers', async () => {
    const exportId = await createExport();
    await expect(
      placeLegalHold({
        projectId,
        artifactType: 'handover_export',
        artifactId: exportId,
        reason: '   ',
        actorId: null,
      }),
    ).rejects.toThrow(/stated reason/);
  });

  it('§10.4 / §10.5 — deletion and the sweep REFUSE while a hold stands', async () => {
    const exportId = await createExport();
    await expect(assertNotOnHold('handover_export', exportId)).resolves.toBeUndefined();

    await placeLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: exportId,
      reason: 'Litigation hold',
      actorId: null,
      at: new Date('2026-04-10T00:00:00.000Z'),
    });

    await expect(assertNotOnHold('handover_export', exportId)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ARTIFACT_ON_LEGAL_HOLD',
    });

    await releaseLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: exportId,
      reason: 'Released',
      actorId: null,
      at: new Date('2026-04-11T00:00:00.000Z'),
    });
    await expect(assertNotOnHold('handover_export', exportId)).resolves.toBeUndefined();
  });

  it('scopes holds by artefact TYPE — a folio id does not hold an export with the same id', async () => {
    const exportId = await createExport();
    await placeLegalHold({
      projectId,
      artifactType: 'folio_issue',
      artifactId: exportId,
      reason: 'Folio hold',
      actorId: null,
    });
    expect(await isOnHold('folio_issue', exportId)).toBe(true);
    expect(await isOnHold('handover_export', exportId)).toBe(false);
  });

  it('reads a same-millisecond place/release as HELD — the tiebreak fails safe', async () => {
    // `createdAt` is `TIMESTAMP(3)`: two events in one millisecond carry an
    // order the table cannot recover. Reading "held" refuses a deletion that
    // may have been legal; the other choice permits one that may not have been.
    const exportId = await createExport();
    const instant = new Date('2026-06-01T00:00:00.000Z');
    await placeLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: exportId,
      reason: 'placed',
      actorId: null,
      at: instant,
    });
    await releaseLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: exportId,
      reason: 'released',
      actorId: null,
      at: instant,
    });

    expect(await isOnHold('handover_export', exportId)).toBe(true);

    // A genuinely later release resolves it, because it is genuinely later.
    await releaseLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: exportId,
      reason: 'released later',
      actorId: null,
      at: new Date(instant.getTime() + 1),
    });
    expect(await isOnHold('handover_export', exportId)).toBe(false);
  });

  it('the sweeper bulk read agrees with the single read, in one query', async () => {
    const held = await createExport();
    const free = await createExport();
    const releasedAgain = await createExport();
    const t0 = new Date('2026-05-01T00:00:00.000Z');

    await placeLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: held,
      reason: 'r',
      actorId: null,
      at: t0,
    });
    await placeLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: releasedAgain,
      reason: 'r',
      actorId: null,
      at: t0,
    });
    await releaseLegalHold({
      projectId,
      artifactType: 'handover_export',
      artifactId: releasedAgain,
      reason: 'r',
      actorId: null,
      at: new Date(t0.getTime() + 1000),
    });

    const heldIds = await filterHeldArtifactIds('handover_export', [held, free, releasedAgain]);
    expect([...heldIds]).toEqual([held]);
    for (const id of [held, free, releasedAgain]) {
      expect(heldIds.has(id)).toBe(await isOnHold('handover_export', id));
    }
  });
});
