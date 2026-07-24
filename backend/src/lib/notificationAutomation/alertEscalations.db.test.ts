import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  processAlertEscalations,
  processNotificationAutomation,
} from '../notificationAutomation.js';
import { clearEmailQueue, getQueuedEmails } from '../email.js';
import { prisma } from '../prisma.js';
import * as serverLogger from '../serverLogger.js';
import { NOTIFICATION_AUTOMATION_WORKER_LOCK_ID } from './runner.js';

// DB-backed proof of bounded, paginated, idempotent alert escalation (the
// second half of the alert-hygiene increment). Runs only against the local
// disposable test DB (src/test/databaseSafety.ts refuses anything else).
//
// All alerts here are overdue_ncr (firstEscalationAfterHours = 24) created 25h
// before `now` at escalationLevel 0, so every one is eligible for a 0 -> 1
// escalation. findEscalationUsers finds no project-role users, falls back to the
// company owner/admin (our admin user), so each escalation notifies exactly one
// recipient and queues exactly one email.

const tag = `alert-escalate-${Date.now()}`;
const now = new Date('2026-06-20T12:00:00.000Z');
const CREATED_25H_AGO = new Date(now.getTime() - 25 * 60 * 60 * 1000);

let companyId: string;
let userId: string;
let projectId: string;
let counter = 0;

function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${tag}-${counter}`;
}

async function createEligibleAlert(): Promise<string> {
  const id = nextId('alert');
  await prisma.notificationAlert.create({
    data: {
      id,
      type: 'overdue_ncr',
      severity: 'high',
      title: 'NCR overdue',
      message: 'NCR has not been closed.',
      entityId: nextId('ncr'),
      entityType: 'ncr',
      projectId,
      assignedToId: userId,
      createdAt: CREATED_25H_AGO,
      escalationLevel: 0,
    },
  });
  return id;
}

async function levelCounts(): Promise<{ level0: number; escalated: number }> {
  const [level0, escalated] = await Promise.all([
    prisma.notificationAlert.count({ where: { projectId, escalationLevel: 0 } }),
    prisma.notificationAlert.count({ where: { projectId, escalationLevel: { gt: 0 } } }),
  ]);
  return { level0, escalated };
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;
  const user = await prisma.user.create({
    data: {
      email: `${tag}@example.com`,
      passwordHash: '$2a$12$test',
      fullName: 'Escalation Tester',
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
});

afterEach(async () => {
  vi.restoreAllMocks();
  clearEmailQueue();
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.notificationAlert.deleteMany({ where: { projectId } });
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.notificationAlert.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
});

describe('processAlertEscalations — full-backlog pagination', () => {
  it('escalates every eligible alert across multiple pages (past the old 100 cap semantics)', async () => {
    for (let i = 0; i < 7; i += 1) await createEligibleAlert();

    // batchSize 3 forces 3 pages (3 + 3 + 1); sendCap high so nothing is capped.
    const result = await processAlertEscalations({
      now,
      projectIds: [projectId],
      batchSize: 3,
      sendCap: 100,
    });

    expect(result.escalated).toBe(7);
    expect(result.alertsChecked).toBe(7);
    expect(getQueuedEmails()).toHaveLength(7);
    const counts = await levelCounts();
    expect(counts).toEqual({ level0: 0, escalated: 7 });
  });
});

describe('processAlertEscalations — idempotent re-run', () => {
  it('sends nothing on a second pass over already-escalated alerts', async () => {
    for (let i = 0; i < 5; i += 1) await createEligibleAlert();

    const first = await processAlertEscalations({ now, projectIds: [projectId], batchSize: 2 });
    expect(first.escalated).toBe(5);
    expect(getQueuedEmails()).toHaveLength(5);

    clearEmailQueue();
    const second = await processAlertEscalations({ now, projectIds: [projectId], batchSize: 2 });
    expect(second.escalated).toBe(0);
    expect(second.usersNotified).toBe(0);
    expect(getQueuedEmails()).toHaveLength(0);
    const notifications = await prisma.notification.count({
      where: { projectId, type: 'alert_escalation' },
    });
    expect(notifications).toBe(5); // only the first run created these
  });
});

describe('processAlertEscalations — send cap with backpressure logging', () => {
  it('caps escalate-and-notify at sendCap, leaves the rest eligible, and logs how many remain', async () => {
    const logSpy = vi.spyOn(serverLogger, 'logInfo').mockImplementation(() => {});
    for (let i = 0; i < 5; i += 1) await createEligibleAlert();

    const result = await processAlertEscalations({
      now,
      projectIds: [projectId],
      batchSize: 2,
      sendCap: 2,
    });

    expect(result.escalated).toBe(2);
    expect(getQueuedEmails()).toHaveLength(2);
    const counts = await levelCounts();
    expect(counts).toEqual({ level0: 3, escalated: 2 }); // 3 deferred, still level 0

    const capLog = logSpy.mock.calls.find(
      (call) => call[0] === '[Notification Automation] Escalation send cap reached',
    );
    expect(capLog).toBeDefined();
    expect(capLog?.[1]).toMatchObject({
      sendCap: 2,
      escalated: 2,
      remainingEligibleUpperBound: 3,
    });
  });
});

describe('processAlertEscalations — advisory lock', () => {
  it('does not escalate while the automation advisory lock is held elsewhere', async () => {
    await createEligibleAlert();

    await prisma.$transaction(async (tx) => {
      const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${NOTIFICATION_AUTOMATION_WORKER_LOCK_ID}) AS locked
      `;
      expect(lockRows[0]?.locked).toBe(true);

      const result = await processNotificationAutomation({ now, projectIds: [projectId] });
      expect(result.alertEscalations.escalated).toBe(0);
    });

    // Alert stayed eligible (untouched) because the whole pass was skipped.
    const counts = await levelCounts();
    expect(counts).toEqual({ level0: 1, escalated: 0 });
    expect(getQueuedEmails()).toHaveLength(0);
  });
});
