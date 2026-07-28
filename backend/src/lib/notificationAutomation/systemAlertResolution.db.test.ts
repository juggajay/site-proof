import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { processSystemAlerts, processSystemAlertsWithLock } from '../notificationAutomation.js';
import { prisma } from '../prisma.js';
import { NOTIFICATION_AUTOMATION_WORKER_LOCK_ID } from './runner.js';
import { resolveClearedSystemAlerts } from './systemAlertResolution.js';

// DB-backed proof of system-alert auto-resolution (increment A2). Runs only
// against the local disposable test DB (src/test/databaseSafety.ts refuses
// anything else). Each resolvable type is exercised for both directions:
// resolves when the underlying condition has cleared, persists while it holds.

const DAY_MS = 24 * 60 * 60 * 1000;
const tag = `alert-resolve-${Date.now()}`;

let companyId: string;
let userId: string;
let projectId: string;
let counter = 0;

function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${tag}-${counter}`;
}

async function createAlert(overrides: Record<string, unknown>): Promise<string> {
  const id = nextId('alert');
  await prisma.notificationAlert.create({
    data: {
      id,
      type: 'overdue_ncr',
      severity: 'high',
      title: 'Test alert',
      message: 'Test alert message',
      entityId: nextId('entity'),
      entityType: 'ncr',
      projectId,
      assignedToId: userId,
      escalationLevel: 0,
      ...overrides,
    },
  });
  return id;
}

async function isResolved(alertId: string): Promise<boolean> {
  const row = await prisma.notificationAlert.findUnique({
    where: { id: alertId },
    select: { resolvedAt: true },
  });
  return row?.resolvedAt != null;
}

function runResolve(now: Date, batchSize?: number) {
  return resolveClearedSystemAlerts(
    { now, projectIds: [projectId] },
    { prisma, dayMs: DAY_MS, batchSize },
  );
}

async function createNcr(status: string, dueDate: Date | null): Promise<string> {
  const ncr = await prisma.nCR.create({
    data: {
      projectId,
      ncrNumber: nextId('NCR'),
      description: 'Test NCR',
      category: 'workmanship',
      status,
      dueDate,
    },
    select: { id: true },
  });
  return ncr.id;
}

let checklistItemId: string;
async function createHoldPoint(status: string, scheduledDate: Date | null): Promise<string> {
  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: nextId('LOT'),
      lotType: 'standard',
      activityType: 'earthworks',
    },
    select: { id: true },
  });
  const hp = await prisma.holdPoint.create({
    data: {
      lotId: lot.id,
      itpChecklistItemId: checklistItemId,
      pointType: 'hold',
      status,
      scheduledDate,
    },
    select: { id: true },
  });
  return hp.id;
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;
  const user = await prisma.user.create({
    data: {
      email: `${tag}@example.com`,
      passwordHash: '$2a$12$test',
      fullName: 'Alert Resolve Tester',
      roleInCompany: 'admin',
      companyId,
      emailVerified: true,
    },
  });
  userId = user.id;
  const project = await prisma.project.create({
    data: {
      name: `Proj ${tag}`,
      projectNumber: `PN-${tag}`,
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
    select: { id: true },
  });
  projectId = project.id;
  const template = await prisma.iTPTemplate.create({
    data: { name: `Tpl ${tag}` },
    select: { id: true },
  });
  const item = await prisma.iTPChecklistItem.create({
    data: { templateId: template.id, sequenceNumber: 1, description: 'Item' },
    select: { id: true },
  });
  checklistItemId = item.id;
});

afterEach(async () => {
  await prisma.notificationAlert.deleteMany({ where: { projectId } });
});

afterAll(async () => {
  await prisma.notificationAlert.deleteMany({ where: { assignedToId: userId } });
  await prisma.holdPoint.deleteMany({ where: { lot: { projectId } } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.nCR.deleteMany({ where: { projectId } });
  await prisma.dailyDiary.deleteMany({ where: { projectId } });
  await prisma.iTPChecklistItem.deleteMany({ where: { id: checklistItemId } });
  await prisma.iTPTemplate.deleteMany({ where: { name: `Tpl ${tag}` } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.company.delete({ where: { id: companyId } });
});

describe('resolveClearedSystemAlerts — overdue_ncr', () => {
  const now = new Date('2026-06-20T12:00:00.000Z');
  const pastDue = new Date('2026-06-10T12:00:00.000Z');

  it('resolves when the NCR is closed', async () => {
    const ncrId = await createNcr('closed', pastDue);
    const alertId = await createAlert({ type: 'overdue_ncr', entityType: 'ncr', entityId: ncrId });

    expect(await runResolve(now)).toBe(1);
    expect(await isResolved(alertId)).toBe(true);
  });

  it('resolves when the NCR entity no longer exists', async () => {
    const alertId = await createAlert({ type: 'overdue_ncr', entityType: 'ncr' });

    expect(await runResolve(now)).toBe(1);
    expect(await isResolved(alertId)).toBe(true);
  });

  it('resolves when the due date was pushed into the future', async () => {
    const ncrId = await createNcr('open', new Date('2026-07-01T12:00:00.000Z'));
    const alertId = await createAlert({ type: 'overdue_ncr', entityType: 'ncr', entityId: ncrId });

    expect(await runResolve(now)).toBe(1);
    expect(await isResolved(alertId)).toBe(true);
  });

  it('does NOT resolve while the NCR is still open and overdue', async () => {
    const ncrId = await createNcr('open', pastDue);
    const alertId = await createAlert({ type: 'overdue_ncr', entityType: 'ncr', entityId: ncrId });

    expect(await runResolve(now)).toBe(0);
    expect(await isResolved(alertId)).toBe(false);
  });
});

describe('resolveClearedSystemAlerts — stale_hold_point', () => {
  const now = new Date('2026-06-20T12:00:00.000Z');
  const stale = new Date('2026-06-18T12:00:00.000Z'); // > 1 day before now

  it('resolves when the hold point has been released', async () => {
    const hpId = await createHoldPoint('released', stale);
    const alertId = await createAlert({
      type: 'stale_hold_point',
      entityType: 'holdpoint',
      entityId: hpId,
    });

    expect(await runResolve(now)).toBe(1);
    expect(await isResolved(alertId)).toBe(true);
  });

  it('resolves when the hold point was rescheduled inside the stale window', async () => {
    // 'notified' so the reschedule is the ONLY reason it resolves — Wave E1
    // makes 'requested' resolve on the status axis alone.
    const hpId = await createHoldPoint('notified', new Date('2026-06-20T06:00:00.000Z'));
    const alertId = await createAlert({
      type: 'stale_hold_point',
      entityType: 'holdpoint',
      entityId: hpId,
    });

    expect(await runResolve(now)).toBe(1);
    expect(await isResolved(alertId)).toBe(true);
  });

  it('does NOT resolve while the hold point is still awaiting release past the threshold', async () => {
    // Wave E1: "still awaiting release" is `notified` — the status the
    // request-release paths write — not the `requested` this used to assert.
    const hpId = await createHoldPoint('notified', stale);
    const alertId = await createAlert({
      type: 'stale_hold_point',
      entityType: 'holdpoint',
      entityId: hpId,
    });

    expect(await runResolve(now)).toBe(0);
    expect(await isResolved(alertId)).toBe(false);
  });

  it('resolves a pre-E1 alert whose hold point is `requested` — creator and resolver agree', async () => {
    // The resolver used to carry its own private copy of the status list
    // (['requested','scheduled']). E1 points both it and the creator at the
    // shared AWAITING_RELEASE_HOLD_POINT_STATUSES, so an alert the creator
    // would no longer raise is one the resolver now closes, instead of the two
    // definitions drifting apart in production.
    const hpId = await createHoldPoint('requested', stale);
    const alertId = await createAlert({
      type: 'stale_hold_point',
      entityType: 'holdpoint',
      entityId: hpId,
    });

    expect(await runResolve(now)).toBe(1);
    expect(await isResolved(alertId)).toBe(true);
  });
});

describe('resolveClearedSystemAlerts — missing diary (retired pending_approval/diary type is swept)', () => {
  const now = new Date('2026-06-20T12:00:00.000Z');
  const dateKey = '2026-06-19';

  // The missing-diary alert is retired: the sweep resolves EVERY active
  // pending_approval/diary row unconditionally — no diary lookup, no date
  // parsing, no age gate — so the standing prod backlog drains silently.

  it('resolves a recent diary alert even though no diary exists for that project+date', async () => {
    const alertId = await createAlert({
      type: 'pending_approval',
      entityType: 'diary',
      entityId: `diary-${projectId}-${dateKey}`,
    });

    expect(await runResolve(now)).toBe(1);
    expect(await isResolved(alertId)).toBe(true);
  });

  it('resolves a diary alert when a diary exists for that project+date', async () => {
    const alertId = await createAlert({
      type: 'pending_approval',
      entityType: 'diary',
      entityId: `diary-${projectId}-${dateKey}`,
    });
    await prisma.dailyDiary.create({
      data: { projectId, date: new Date(`${dateKey}T00:00:00.000Z`), status: 'submitted' },
    });

    expect(await runResolve(now)).toBe(1);
    expect(await isResolved(alertId)).toBe(true);
  });

  it('resolves a diary alert with an unparseable entityId (type retired, no date needed)', async () => {
    const alertId = await createAlert({
      type: 'pending_approval',
      entityType: 'diary',
      entityId: nextId('legacy-entity'), // does not match diary-<project>-<date>
      message: 'Missing diary for 2020-01-01',
    });

    expect(await runResolve(now)).toBe(1);
    expect(await isResolved(alertId)).toBe(true);
  });

  it('does NOT resolve a pending_approval alert whose entityType is not diary', async () => {
    const alertId = await createAlert({
      type: 'pending_approval',
      entityType: 'docket',
      entityId: nextId('docket-entity'),
    });

    expect(await runResolve(now)).toBe(0);
    expect(await isResolved(alertId)).toBe(false);
  });
});

describe('resolveClearedSystemAlerts — idempotency and pagination', () => {
  const now = new Date('2026-06-20T12:00:00.000Z');

  it('is a no-op on re-run (already-resolved rows are excluded)', async () => {
    const alertId = await createAlert({ type: 'overdue_ncr', entityType: 'ncr' }); // missing NCR

    expect(await runResolve(now)).toBe(1);
    expect(await isResolved(alertId)).toBe(true);
    expect(await runResolve(now)).toBe(0);
  });

  it('resolves across multiple pages with a small batch size', async () => {
    // 7 alerts pointing at non-existent NCRs => all resolvable; batchSize 3
    // forces 3 pages (3 + 3 + 1) proving cursor pagination advances correctly.
    for (let i = 0; i < 7; i += 1) {
      await createAlert({ type: 'overdue_ncr', entityType: 'ncr' });
    }

    expect(await runResolve(now, 3)).toBe(7);
    const remaining = await prisma.notificationAlert.count({
      where: { projectId, resolvedAt: null },
    });
    expect(remaining).toBe(0);
  });

  it('leaves a persisting alert active among resolvable ones across pages', async () => {
    const openNcrId = await createNcr('open', new Date('2026-06-10T12:00:00.000Z'));
    const persistId = await createAlert({
      type: 'overdue_ncr',
      entityType: 'ncr',
      entityId: openNcrId,
    });
    for (let i = 0; i < 5; i += 1) {
      await createAlert({ type: 'overdue_ncr', entityType: 'ncr' }); // missing => resolve
    }

    expect(await runResolve(now, 2)).toBe(5);
    expect(await isResolved(persistId)).toBe(false);
  });
});

describe('processSystemAlerts — resolution runs before creation (recurrence)', () => {
  it('resolves a cleared alert then creates a fresh one when the condition recurs', async () => {
    const now = new Date('2026-06-20T12:00:00.000Z');
    const ncrId = await createNcr('open', new Date('2026-06-10T12:00:00.000Z'));

    // First pass: overdue NCR -> one active alert created for it.
    await processSystemAlerts({ projectIds: [projectId], now });
    const first = await prisma.notificationAlert.findFirst({
      where: { entityId: ncrId, type: 'overdue_ncr' },
    });
    expect(first?.resolvedAt).toBeNull();

    // Condition clears: close the NCR. Next pass resolves the alert.
    await prisma.nCR.update({ where: { id: ncrId }, data: { status: 'closed' } });
    await processSystemAlerts({ projectIds: [projectId], now });
    expect(await isResolved(first!.id)).toBe(true);

    // Condition recurs: reopen the NCR (still overdue). Resolution runs BEFORE
    // creation in the same pass, so a clean new active row is written against
    // the partial unique index rather than colliding with the resolved one.
    await prisma.nCR.update({ where: { id: ncrId }, data: { status: 'open' } });
    await processSystemAlerts({ projectIds: [projectId], now });

    const active = await prisma.notificationAlert.findMany({
      where: { entityId: ncrId, type: 'overdue_ncr', resolvedAt: null },
    });
    expect(active).toHaveLength(1);
    expect(active[0]!.id).not.toBe(first!.id);
  });
});

describe('processSystemAlertsWithLock — resolution respects the advisory lock', () => {
  it('returns null (skips the whole pass, resolution included) while the lock is held', async () => {
    const now = new Date('2026-06-20T12:00:00.000Z');
    await prisma.$transaction(async (tx) => {
      const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${NOTIFICATION_AUTOMATION_WORKER_LOCK_ID}) AS locked
      `;
      expect(lockRows[0]?.locked).toBe(true);

      const result = await processSystemAlertsWithLock({ projectIds: [projectId], now });
      expect(result).toBeNull();
    });
  });
});
