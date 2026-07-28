// Wave E1 — the awaiting-release predicate and the reminder that can finally
// fire. Acceptance tests AT-98, AT-99, AT-103 and AT-113 from
// `docs/plans/wave-e-approvals-spec-2026-07-28.md` §12.
//
// DB-backed on purpose. The whole finding this phase turns on is that the alert
// engine's status list did not match what the request-release route writes, and
// the only way to prove that is to drive the real route against a real database
// and then run the real scan over the row it produced — a fixture literal that
// says `status: 'notified'` proves nothing about production behaviour.
// `src/test/databaseSafety.ts` keeps this on the local disposable database.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../prisma.js';
import { AWAITING_RELEASE_HOLD_POINT_STATUSES } from '../readiness/predicates.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../../routes/auth.js';
import { holdpointsRouter } from '../../routes/holdpoints.js';
import { processSystemAlerts } from '../notificationAutomation.js';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const CANARY_ENV = 'WAVE_E_STALE_ALERT_PROJECT_IDS';
const DAY_MS = 24 * 60 * 60 * 1000;
const tag = `e1-await-${Date.now()}`;

let requesterToken: string;
let requesterId: string;
let companyId: string;
let projectId: string;
let otherProjectId: string;
let routeTemplateId: string;
let bulkTemplateId: string;
let otherTemplateId: string;
let routeLotId: string;
let bulkLotId: string;
let otherLotId: string;

let checklistSequence = 0;

async function createProjectFixture(suffix: string) {
  const project = await prisma.project.create({
    data: {
      name: `Project ${tag} ${suffix}`,
      projectNumber: `P-${tag}-${suffix}`,
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  await prisma.projectUser.create({
    data: { projectId: project.id, userId: requesterId, role: 'admin', status: 'active' },
  });
  const template = await prisma.iTPTemplate.create({
    data: { projectId: project.id, name: `Template ${tag} ${suffix}`, activityType: 'Earthworks' },
  });
  const lot = await prisma.lot.create({
    data: {
      projectId: project.id,
      lotNumber: `${tag}-${suffix}`,
      status: 'in_progress',
      lotType: 'chainage',
      activityType: 'Earthworks',
    },
  });
  await prisma.iTPInstance.create({
    data: { templateId: template.id, lotId: lot.id, status: 'in_progress' },
  });
  return { projectId: project.id, templateId: template.id, lotId: lot.id };
}

async function createChecklistItem(templateId: string, suffix: string) {
  checklistSequence += 1;
  return prisma.iTPChecklistItem.create({
    data: {
      templateId,
      description: `Awaiting release item ${suffix}`,
      pointType: 'hold_point',
      sequenceNumber: checklistSequence,
    },
  });
}

/** A hold point written directly — for the volume/isolation cases only. */
async function createAwaitingHoldPoint(
  lotId: string,
  templateId: string,
  suffix: string,
  scheduledDate: Date,
  status = 'notified',
) {
  const item = await createChecklistItem(templateId, suffix);
  return prisma.holdPoint.create({
    data: {
      lotId,
      itpChecklistItemId: item.id,
      pointType: 'hold_point',
      description: `Awaiting release hold point ${suffix}`,
      status,
      scheduledDate,
      notificationSentAt: new Date(),
      notificationSentTo: 'super@example.com',
    },
  });
}

async function activeStaleAlerts(targetProjectId = projectId) {
  return prisma.notificationAlert.findMany({
    where: { projectId: targetProjectId, type: 'stale_hold_point', resolvedAt: null },
  });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const requester = await registerTestUser(app, {
    emailPrefix: `${tag}-requester`,
    fullName: 'E1 Release Requester',
    companyId,
    roleInCompany: 'admin',
  });
  requesterToken = requester.token;
  requesterId = requester.userId;

  const main = await createProjectFixture('main');
  projectId = main.projectId;
  routeTemplateId = main.templateId;
  routeLotId = main.lotId;

  // A second lot on the SAME project, so bulk fixtures never collide with the
  // route-driven lot's preceding-item prerequisites.
  const bulkTemplate = await prisma.iTPTemplate.create({
    data: { projectId, name: `Template ${tag} bulk`, activityType: 'Earthworks' },
  });
  bulkTemplateId = bulkTemplate.id;
  const bulkLot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-bulk`,
      status: 'in_progress',
      lotType: 'chainage',
      activityType: 'Earthworks',
    },
  });
  bulkLotId = bulkLot.id;
  await prisma.iTPInstance.create({
    data: { templateId: bulkTemplateId, lotId: bulkLotId, status: 'in_progress' },
  });

  const other = await createProjectFixture('other');
  otherProjectId = other.projectId;
  otherTemplateId = other.templateId;
  otherLotId = other.lotId;
});

beforeEach(() => {
  process.env[CANARY_ENV] = projectId;
});

afterEach(async () => {
  delete process.env[CANARY_ENV];
  await prisma.notificationAlert.deleteMany({
    where: { projectId: { in: [projectId, otherProjectId] } },
  });
  await prisma.notification.deleteMany({
    where: { projectId: { in: [projectId, otherProjectId] } },
  });
  await prisma.auditLog.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  await prisma.holdPointReleaseToken.deleteMany({
    where: { holdPoint: { lotId: { in: [routeLotId, bulkLotId, otherLotId] } } },
  });
  await prisma.holdPoint.deleteMany({
    where: { lotId: { in: [routeLotId, bulkLotId, otherLotId] } },
  });
  await prisma.iTPCompletion.deleteMany({
    where: { itpInstance: { lotId: { in: [routeLotId, bulkLotId, otherLotId] } } },
  });
  await prisma.iTPChecklistItem.deleteMany({
    where: { templateId: { in: [routeTemplateId, bulkTemplateId, otherTemplateId] } },
  });
});

afterAll(async () => {
  const projectIds = [projectId, otherProjectId];
  const lotIds = [routeLotId, bulkLotId, otherLotId];
  await prisma.notificationAlert.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.notification.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.auditLog.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.holdPointReleaseToken.deleteMany({
    where: { holdPoint: { lotId: { in: lotIds } } },
  });
  await prisma.holdPoint.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lotId: { in: lotIds } } } });
  await prisma.iTPInstance.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.lot.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.iTPChecklistItem.deleteMany({
    where: { templateId: { in: [routeTemplateId, bulkTemplateId, otherTemplateId] } },
  });
  await prisma.iTPTemplate.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.projectUser.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId: requesterId } });
  await prisma.user.delete({ where: { id: requesterId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
});

/**
 * AT-98 — the signal matches what the code writes. `[E-B1]`.
 *
 * This is the test that would have caught the finding: the hold point is put
 * into the awaiting state by POST /api/holdpoints/request-release, not by a
 * fixture literal, and the same suite runs the PRE-E1 query against it.
 */
describe('AT-98 the alert fires for a hold point the real route created', () => {
  it('request-release writes the awaiting status, and the scan alerts on it once overdue', async () => {
    const item = await createChecklistItem(routeTemplateId, 'route');
    const scheduledDate = new Date(Date.now() + 10 * DAY_MS);

    const res = await request(app)
      .post('/api/holdpoints/request-release')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        lotId: routeLotId,
        itpChecklistItemId: item.id,
        scheduledDate: scheduledDate.toISOString().slice(0, 10),
        notificationSentTo: 'super@example.com',
      });

    expect(res.status).toBe(200);

    const holdPoint = await prisma.holdPoint.findFirstOrThrow({
      where: { lotId: routeLotId, itpChecklistItemId: item.id },
    });
    // The status the route actually writes — the whole premise of E1.
    expect(holdPoint.status).toBe('notified');
    expect([...AWAITING_RELEASE_HOLD_POINT_STATUSES]).toContain(holdPoint.status);
    expect(holdPoint.scheduledDate).not.toBeNull();

    // Two days past the scheduled date: more than the one-day threshold, well
    // inside the 30-day horizon.
    const now = new Date(holdPoint.scheduledDate!.getTime() + 2 * DAY_MS);

    // PROOF OF CATCH: the query this scan carried before E1 —
    // status IN ('requested','scheduled') — returns nothing for this row, so
    // the pre-E1 alert engine could not have fired for it.
    const preE1Matches = await prisma.holdPoint.findMany({
      where: {
        lot: { projectId },
        status: { in: ['requested', 'scheduled'] },
        scheduledDate: { lt: new Date(now.getTime() - DAY_MS) },
      },
    });
    expect(preE1Matches).toHaveLength(0);

    const result = await processSystemAlerts({ now, projectIds: [projectId] });

    expect(result.staleHoldPointAlerts).toBe(1);
    const alerts = await activeStaleAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.entityId).toBe(holdPoint.id);
    expect(alerts[0]!.entityType).toBe('holdpoint');
  });

  it('does not alert before the scheduled date is a day past, or outside the horizon', async () => {
    const now = new Date();
    // Due tomorrow: awaiting release, but not yet late.
    await createAwaitingHoldPoint(
      bulkLotId,
      bulkTemplateId,
      'not-yet-due',
      new Date(now.getTime() + DAY_MS),
    );
    // 45 days past: late, but older than STALE_HOLD_POINT_HORIZON_DAYS.
    await createAwaitingHoldPoint(
      bulkLotId,
      bulkTemplateId,
      'beyond-horizon',
      new Date(now.getTime() - 45 * DAY_MS),
    );

    const result = await processSystemAlerts({ now, projectIds: [projectId] });

    expect(result.staleHoldPointAlerts).toBe(0);
    expect(await activeStaleAlerts()).toHaveLength(0);
  });
});

/**
 * AT-99 — creator, resolver and provenance agree. The resolver used to carry a
 * private copy of the status list; if the two ever diverge again an alert can
 * be created that can never be closed, or closed the moment it is created.
 */
describe('AT-99 the resolver closes what the creator would no longer raise', () => {
  it('closes an alert whose hold point is no longer awaiting release', async () => {
    const now = new Date();
    const holdPoint = await createAwaitingHoldPoint(
      bulkLotId,
      bulkTemplateId,
      'resolve-released',
      new Date(now.getTime() - 3 * DAY_MS),
    );

    expect((await processSystemAlerts({ now, projectIds: [projectId] })).staleHoldPointAlerts).toBe(
      1,
    );

    await prisma.holdPoint.update({ where: { id: holdPoint.id }, data: { status: 'released' } });

    const second = await processSystemAlerts({
      now: new Date(now.getTime() + 60 * 60 * 1000),
      projectIds: [projectId],
    });

    expect(second.alertsResolved).toBe(1);
    expect(await activeStaleAlerts()).toHaveLength(0);
  });

  it('closes a legacy alert on a hold point the new predicate never matches', async () => {
    // PROOF OF CATCH for the repointed resolver: a `requested` hold point with
    // a past scheduled date is exactly what the PRE-E1 creator raised alerts
    // for. If the resolver had kept its private copy of the old status list,
    // this alert would stay open forever while the creator would never raise
    // it again — the two definitions drifting apart in production.
    const now = new Date();
    const holdPoint = await createAwaitingHoldPoint(
      bulkLotId,
      bulkTemplateId,
      'legacy-requested',
      new Date(now.getTime() - 3 * DAY_MS),
      'requested',
    );
    await prisma.notificationAlert.create({
      data: {
        id: `alert-${tag}-legacy`,
        type: 'stale_hold_point',
        severity: 'high',
        title: 'Hold Point stale (pre-E1)',
        message: 'Raised by the pre-E1 predicate',
        entityId: holdPoint.id,
        entityType: 'holdpoint',
        projectId,
        assignedToId: requesterId,
        escalationLevel: 0,
      },
    });

    const result = await processSystemAlerts({ now, projectIds: [projectId] });

    expect(result.alertsResolved).toBe(1);
    expect(await activeStaleAlerts()).toHaveLength(0);
    // And it is not re-raised: the new predicate does not match it either.
    expect(result.staleHoldPointAlerts).toBe(0);
  });

  it('neither automation file carries a second hold-point status list', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    for (const file of ['systemAutomation.ts', 'systemAlertResolution.ts']) {
      const source = readFileSync(path.join(here, file), 'utf8');
      expect(source).toContain('AWAITING_RELEASE_HOLD_POINT_STATUSES');
      // Both files still MENTION the old statuses in prose (that history is
      // the point of the comments); neither may build a list out of them, so
      // strip comments before looking for one.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .join('\n');
      expect(code).not.toMatch(/\[\s*'requested'\s*,\s*'scheduled'\s*\]/);
      expect(code).not.toMatch(/STALE_HOLD_POINT_STATUSES/);
    }
  });
});

/** AT-103 — the backlog does not detonate. */
describe('AT-103 the pass is globally bounded and resumes without duplicates', () => {
  it('creates exactly the per-pass cap, then finishes the backlog on the next pass', async () => {
    const now = new Date();
    const total = 55; // > STALE_HOLD_POINT_ALERTS_PER_PASS (50)
    for (let index = 0; index < total; index += 1) {
      await createAwaitingHoldPoint(
        bulkLotId,
        bulkTemplateId,
        `backlog-${index}`,
        new Date(now.getTime() - (2 * DAY_MS + index * 60_000)),
      );
    }

    const first = await processSystemAlerts({ now, projectIds: [projectId] });
    expect(first.staleHoldPointAlerts).toBe(50);
    expect(first.staleHoldPointsDeferred).toBe(5);
    expect(await activeStaleAlerts()).toHaveLength(50);

    const second = await processSystemAlerts({
      now: new Date(now.getTime() + 60 * 60 * 1000),
      projectIds: [projectId],
    });
    expect(second.staleHoldPointAlerts).toBe(5);
    expect(second.staleHoldPointsDeferred).toBe(0);

    const alerts = await activeStaleAlerts();
    expect(alerts).toHaveLength(total);
    // No duplicates: one active alert per hold point, which the partial unique
    // index on (type, entity_id) WHERE resolved_at IS NULL also guarantees.
    expect(new Set(alerts.map((alert) => alert.entityId)).size).toBe(total);
  }, 60_000);
});

/**
 * AT-113 — the canary gate holds. E.0 threat-model item 8c, `Mitigate before
 * E1`: with the allowlist unset, `findActiveProjects` would scan the whole
 * estate if the parser ever returned `undefined` instead of `[]`. Each case
 * below has a genuinely eligible hold point present, so a fail-open is visible
 * as a created alert rather than as an absence.
 */
describe('AT-113 the Wave E canary fails closed', () => {
  it.each([
    ['unset', undefined],
    ['empty string', ''],
    ['a bare separator', ','],
    ['separators and whitespace', ' , , '],
  ])('%s => zero alerts, with an eligible hold point present', async (_label, value) => {
    const now = new Date();
    await createAwaitingHoldPoint(
      bulkLotId,
      bulkTemplateId,
      'canary-eligible',
      new Date(now.getTime() - 3 * DAY_MS),
    );
    if (value === undefined) delete process.env[CANARY_ENV];
    else process.env[CANARY_ENV] = value;

    // Deliberately NO projectIds option: this is the hourly worker's own call
    // shape, the one that scans every active project.
    const result = await processSystemAlerts({ now });

    expect(result.staleHoldPointAlerts).toBe(0);
    expect(await activeStaleAlerts()).toHaveLength(0);
  });

  it('alerts only for the listed project, never a second eligible one', async () => {
    const now = new Date();
    await createAwaitingHoldPoint(
      bulkLotId,
      bulkTemplateId,
      'canary-listed',
      new Date(now.getTime() - 3 * DAY_MS),
    );
    await createAwaitingHoldPoint(
      otherLotId,
      otherTemplateId,
      'canary-unlisted',
      new Date(now.getTime() - 3 * DAY_MS),
    );
    process.env[CANARY_ENV] = projectId;

    const result = await processSystemAlerts({ now });

    expect(result.staleHoldPointAlerts).toBe(1);
    expect(await activeStaleAlerts(projectId)).toHaveLength(1);
    expect(await activeStaleAlerts(otherProjectId)).toHaveLength(0);
  });
});
