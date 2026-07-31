// Wave E2 — the automated chase, digest-shaped and canary-bound. Acceptance
// tests AT-101, AT-102, AT-109, AT-114, AT-115, AT-116, AT-117 and AT-118 from
// `docs/plans/wave-e-approvals-spec-2026-07-28.md` §12, plus the four
// termination-event cases E.0 item 11 requires.
//
// DB-backed on purpose. Every control this phase ships is a property of real
// rows under real concurrency: an atomic reservation cannot be proven with a
// mock that returns whatever it is told, and a "digest" that consolidates N
// items into one email is only meaningful when N real hold points exist.
// `src/test/databaseSafety.ts` keeps this on the local disposable database.

import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../prisma.js';
import { clearEmailQueue, getQueuedEmails } from '../email.js';
import {
  isEmailSuppressed,
  recordEmailSuppression,
  resetEmailSuppressionForTests,
} from '../emailSuppression.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../../routes/auth.js';
import { holdpointsRouter } from '../../routes/holdpoints.js';
import {
  MAX_CHASES_PER_REQUEST,
  loadHoldPointChaseTargets,
  loadLiveTokenChaseTargets,
  reserveHoldPointChase,
} from '../../routes/holdpoints/chaseCore.js';
import { hashHoldPointReleaseToken } from '../../routes/holdpoints/tokens.js';
import { parseNotificationEmailList } from '../../routes/holdpoints/validation.js';
import { normalizeRecipientEmail } from '../emailSuppression.js';
import {
  parseHoldPointUnsubscribeToken,
  recordHoldPointMailUnsubscribe,
} from '../holdPointMailConsent.js';
import { processHoldPointChaseReminders } from '../notificationAutomation.js';
// The failed-send arm needs a transport that rejects, so it calls the job with
// injected deps rather than the default-deps wrapper above. Same function.
import {
  buildHoldPointChaseAutomationDependencies,
  processHoldPointChaseReminders as runChaseJob,
} from './holdPointChaseAutomation.js';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const CANARY_ENV = 'WAVE_E_STALE_ALERT_PROJECT_IDS';
const DAY_MS = 24 * 60 * 60 * 1000;
const SUPER_EMAIL = 'external.super@example.com';
const tag = `e2-chase-${Date.now()}`;

let requesterToken: string;
let requesterId: string;
let companyId: string;
let projectId: string;
let otherProjectId: string;
let templateId: string;
let otherTemplateId: string;
let lotId: string;
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
      // Mon-Fri, so the working-day arithmetic has something to disagree with.
      workingDays: '1,2,3,4,5',
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

async function createChecklistItem(targetTemplateId: string, suffix: string) {
  checklistSequence += 1;
  return prisma.iTPChecklistItem.create({
    data: {
      templateId: targetTemplateId,
      description: `Chase item ${suffix}`,
      pointType: 'hold_point',
      sequenceNumber: checklistSequence,
    },
  });
}

/**
 * A hold point in the awaiting-release state, written directly so each test can
 * pin `scheduledDate`, `chaseCount` and `lastChasedAt` exactly. AT-101's
 * requester assertions use the ROUTE instead (see `requestReleaseViaRoute`).
 */
async function createAwaitingHoldPoint(options: {
  lotId?: string;
  templateId?: string;
  suffix: string;
  scheduledDate: Date;
  notificationSentTo?: string | null;
  notificationSentAt?: Date;
  chaseCount?: number;
  lastChasedAt?: Date | null;
  status?: string;
}) {
  const item = await createChecklistItem(options.templateId ?? templateId, options.suffix);
  const holdPoint = await prisma.holdPoint.create({
    data: {
      lotId: options.lotId ?? lotId,
      itpChecklistItemId: item.id,
      pointType: 'hold_point',
      description: `Hold point ${options.suffix}`,
      status: options.status ?? 'notified',
      scheduledDate: options.scheduledDate,
      notificationSentAt: options.notificationSentAt ?? new Date(Date.now() - 5 * DAY_MS),
      notificationSentTo:
        options.notificationSentTo === undefined ? SUPER_EMAIL : options.notificationSentTo,
      chaseCount: options.chaseCount ?? 0,
      lastChasedAt: options.lastChasedAt ?? null,
    },
  });

  // Wave E2.1. Every test in this file predates the consent gate and asserts
  // some control OTHER than consent, so the fixture grants it: without a
  // recorded link open the gate withholds the digest and every one of those
  // assertions would be measuring the new gate instead of the control it names.
  // The gate itself is tested in `holdPointMailConsent.db.test.ts`, including
  // the case this helper deliberately never produces — no consent at all.
  await grantConsent(
    holdPoint.lotId === otherLotId ? otherProjectId : projectId,
    holdPoint.notificationSentTo,
  );

  return holdPoint;
}

async function grantConsent(targetProjectId: string, notificationSentTo: string | null) {
  for (const email of parseNotificationEmailList(notificationSentTo)) {
    const normalized = normalizeRecipientEmail(email);
    if (!normalized) continue;
    await prisma.holdPointMailConsent.upsert({
      where: { projectId_email: { projectId: targetProjectId, email: normalized } },
      update: {},
      create: { projectId: targetProjectId, email: normalized, firstOpenedAt: new Date() },
    });
  }
}

async function chaseAudits(holdPointId: string) {
  return prisma.auditLog.findMany({
    where: { entityType: 'hold_point', entityId: holdPointId, action: 'hp_chased' },
    orderBy: { createdAt: 'asc' },
  });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const requester = await registerTestUser(app, {
    emailPrefix: `${tag}-requester`,
    fullName: 'Rita Requester',
    companyId,
    roleInCompany: 'admin',
  });
  requesterToken = requester.token;
  requesterId = requester.userId;

  const main = await createProjectFixture('main');
  projectId = main.projectId;
  templateId = main.templateId;
  lotId = main.lotId;

  const other = await createProjectFixture('other');
  otherProjectId = other.projectId;
  otherTemplateId = other.templateId;
  otherLotId = other.lotId;
});

beforeEach(() => {
  process.env[CANARY_ENV] = projectId;
  clearEmailQueue();
  resetEmailSuppressionForTests();
});

afterEach(async () => {
  delete process.env[CANARY_ENV];
  await prisma.project.update({ where: { id: projectId }, data: { status: 'active' } });
  await prisma.auditLog.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  await prisma.holdPointReleaseToken.deleteMany({
    where: { holdPoint: { lotId: { in: [lotId, otherLotId] } } },
  });
  await prisma.holdPointReleaseBatch.deleteMany({ where: { lotId: { in: [lotId, otherLotId] } } });
  await prisma.holdPointMailConsent.deleteMany({
    where: { projectId: { in: [projectId, otherProjectId] } },
  });
  await prisma.holdPoint.deleteMany({ where: { lotId: { in: [lotId, otherLotId] } } });
  await prisma.iTPCompletion.deleteMany({
    where: { itpInstance: { lotId: { in: [lotId, otherLotId] } } },
  });
  await prisma.iTPChecklistItem.deleteMany({
    where: { templateId: { in: [templateId, otherTemplateId] } },
  });
});

afterAll(async () => {
  const projectIds = [projectId, otherProjectId];
  await prisma.auditLog.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.holdPointReleaseToken.deleteMany({
    where: { holdPoint: { lot: { projectId: { in: projectIds } } } },
  });
  await prisma.holdPointReleaseBatch.deleteMany({
    where: { lot: { projectId: { in: projectIds } } },
  });
  await prisma.holdPointMailConsent.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.holdPoint.deleteMany({ where: { lot: { projectId: { in: projectIds } } } });
  await prisma.iTPCompletion.deleteMany({
    where: { itpInstance: { lot: { projectId: { in: projectIds } } } },
  });
  await prisma.iTPChecklistItem.deleteMany({
    where: { template: { projectId: { in: projectIds } } },
  });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId: { in: projectIds } } } });
  await prisma.lot.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.projectUser.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.user.deleteMany({ where: { id: requesterId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

// ---------------------------------------------------------------------------

describe('AT-113(E2) the canary gate fails CLOSED for the chase arm', () => {
  // E.0 item 8c. `process.env.X?.split(',')` yields `undefined` when unset, and
  // `undefined` is the branch that scans the whole estate. The fail-closed
  // parser is the difference between an inert deploy and mailing every external
  // superintendent CIVOS has.
  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['separator only', ','],
    ['separators and spaces', ' , , '],
  ])(
    'sends NOTHING when the allowlist is %s, with an eligible hold point present',
    async (_label, value) => {
      await createAwaitingHoldPoint({
        suffix: `closed-${_label}`,
        scheduledDate: new Date(Date.now() - 2 * DAY_MS),
      });

      if (value === undefined) delete process.env[CANARY_ENV];
      else process.env[CANARY_ENV] = value;

      const result = await processHoldPointChaseReminders({ now: new Date() });

      expect(result.canaryProjects).toBe(0);
      expect(result.digestsSent).toBe(0);
      expect(getQueuedEmails()).toHaveLength(0);
      // PROOF OF CATCH: with the allowlist naming the project, the same row DOES
      // produce a digest — so the zero above is the gate, not an empty fixture.
      process.env[CANARY_ENV] = projectId;
      const enabled = await processHoldPointChaseReminders({ now: new Date() });
      expect(enabled.digestsSent).toBe(1);
    },
  );

  it('never crosses a project boundary', async () => {
    await createAwaitingHoldPoint({
      suffix: 'in-canary',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });
    await createAwaitingHoldPoint({
      suffix: 'out-canary',
      lotId: otherLotId,
      templateId: otherTemplateId,
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.digestsSent).toBe(1);
    expect(result.holdPointsReminded).toBe(1);
    const otherHoldPoints = await prisma.holdPoint.findMany({ where: { lotId: otherLotId } });
    expect(otherHoldPoints.every((hp) => hp.chaseCount === 0)).toBe(true);
  });

  // Jay's decision of 2026-07-31: after the canary passed, widen from three
  // named projects to the whole estate. `*` is the only value that does it.
  it.each([
    ['the bare sentinel', '*'],
    ['a padded sentinel', ' * '],
  ])('%s reaches BOTH projects, including the one never named', async (_label, value) => {
    await createAwaitingHoldPoint({
      suffix: 'star-in',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });
    await createAwaitingHoldPoint({
      suffix: 'star-out',
      lotId: otherLotId,
      templateId: otherTemplateId,
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    process.env[CANARY_ENV] = value;
    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.canaryProjects).toBe(2);
    expect(result.digestsSent).toBe(2);
    expect(result.holdPointsReminded).toBe(2);
    const otherHoldPoints = await prisma.holdPoint.findMany({ where: { lotId: otherLotId } });
    expect(otherHoldPoints.every((hp) => hp.chaseCount === 1)).toBe(true);
  });

  it('a sentinel inside a list does not widen — only the named project sends', async () => {
    await createAwaitingHoldPoint({
      suffix: 'mixed-in',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });
    await createAwaitingHoldPoint({
      suffix: 'mixed-out',
      lotId: otherLotId,
      templateId: otherTemplateId,
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    process.env[CANARY_ENV] = `${projectId},*`;
    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.canaryProjects).toBe(1);
    expect(result.digestsSent).toBe(1);
    const otherHoldPoints = await prisma.holdPoint.findMany({ where: { lotId: otherLotId } });
    expect(otherHoldPoints.every((hp) => hp.chaseCount === 0)).toBe(true);
  });

  // `*` widens the ENV gate only. An explicit projectIds (a targeted manual run)
  // still narrows the pass — the two scopes intersect, they do not override.
  it('still honours an explicit projectIds under the sentinel', async () => {
    await createAwaitingHoldPoint({
      suffix: 'star-scoped-in',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });
    await createAwaitingHoldPoint({
      suffix: 'star-scoped-out',
      lotId: otherLotId,
      templateId: otherTemplateId,
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    process.env[CANARY_ENV] = '*';
    const result = await processHoldPointChaseReminders({
      now: new Date(),
      projectIds: [projectId],
    });

    expect(result.digestsSent).toBe(1);
    const otherHoldPoints = await prisma.holdPoint.findMany({ where: { lotId: otherLotId } });
    expect(otherHoldPoints.every((hp) => hp.chaseCount === 0)).toBe(true);
  });
});

describe('AT-116 mail is bounded — the digest, the daily limit, casing, suppression', () => {
  it('consolidates N due hold points into ONE email with N distinct links', async () => {
    const scheduledDate = new Date(Date.now() - 2 * DAY_MS);
    await createAwaitingHoldPoint({ suffix: 'digest-a', scheduledDate });
    await createAwaitingHoldPoint({ suffix: 'digest-b', scheduledDate });
    await createAwaitingHoldPoint({ suffix: 'digest-c', scheduledDate });

    const result = await processHoldPointChaseReminders({ now: new Date() });

    // PROOF OF CATCH: three eligible items, ONE message. The pre-digest shape
    // would have been three.
    expect(result.holdPointsReminded).toBe(3);
    expect(result.digestsSent).toBe(1);
    const queued = getQueuedEmails();
    expect(queued).toHaveLength(1);
    expect(queued[0]!.to).toBe(SUPER_EMAIL);

    const links = [...(queued[0]!.text ?? '').matchAll(/\/hp-release\/([a-f0-9]{64})/g)].map(
      (match) => match[1],
    );
    expect(new Set(links).size).toBe(3);

    // Each link is a real, live, single-hold-point capability.
    for (const link of links) {
      const token = await prisma.holdPointReleaseToken.findUniqueOrThrow({
        where: { token: hashHoldPointReleaseToken(link!) },
      });
      expect(token.holdPointId).toBeTruthy();
      expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('sends nothing on a second pass the same day (the daily limit)', async () => {
    await createAwaitingHoldPoint({
      suffix: 'daily-a',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    const first = await processHoldPointChaseReminders({ now: new Date() });
    expect(first.digestsSent).toBe(1);

    clearEmailQueue();
    // One hour later — the next hourly pass.
    const second = await processHoldPointChaseReminders({
      now: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(second.digestsSent).toBe(0);
    expect(second.dailyLimitSkipped).toBe(1);
    expect(getQueuedEmails()).toHaveLength(0);
  });

  it('a hold point that becomes due LATER the same day does not earn a second email', async () => {
    await createAwaitingHoldPoint({
      suffix: 'daily-first',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });
    const first = await processHoldPointChaseReminders({ now: new Date() });
    expect(first.digestsSent).toBe(1);

    clearEmailQueue();
    // A brand-new, never-chased, already-overdue item for the same recipient.
    await createAwaitingHoldPoint({
      suffix: 'daily-second',
      scheduledDate: new Date(Date.now() - 3 * DAY_MS),
    });

    const second = await processHoldPointChaseReminders({
      now: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    // PROOF OF CATCH: a per-ITEM counter would have let this through — the new
    // item has chaseCount 0 and no cooldown. The per-recipient daily limit is
    // what stops it.
    expect(second.digestsSent).toBe(0);
    expect(second.dailyLimitSkipped).toBe(1);
    expect(getQueuedEmails()).toHaveLength(0);
  });

  it('counts casing variants of one address as ONE recipient (E.0 item 12a)', async () => {
    const scheduledDate = new Date(Date.now() - 2 * DAY_MS);
    await createAwaitingHoldPoint({
      suffix: 'case-lower',
      scheduledDate,
      notificationSentTo: 'sam@example.com',
    });
    await createAwaitingHoldPoint({
      suffix: 'case-upper',
      scheduledDate,
      notificationSentTo: 'Sam@example.com',
    });

    const result = await processHoldPointChaseReminders({ now: new Date() });

    // PROOF OF CATCH: grouping on the stored (first-seen) casing would produce
    // two groups and two emails to the same human.
    expect(result.recipientGroups).toBe(1);
    expect(result.digestsSent).toBe(1);
    expect(getQueuedEmails()).toHaveLength(1);
  });

  // Wave E2.1 — Jay's decision of 2026-07-31, at the level that matters: the
  // JOB, not the helper. The unit coverage lives in
  // `src/lib/holdPointMailConsent.db.test.ts`; these two prove the job consults
  // it before it reaches for the transport.
  it('sends nothing to a recipient with no recorded link open, and mints no token', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'no-consent',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });
    // Undo the fixture's grant — this is the one test that wants the gate shut.
    await prisma.holdPointMailConsent.deleteMany({ where: { projectId } });

    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.noConsentSkipped).toBe(1);
    expect(result.digestsSent).toBe(0);
    expect(getQueuedEmails()).toHaveLength(0);
    // Unlike a suppressed send, an ineligible one consumes NOTHING: no attempt,
    // no fresh capability token nobody holds.
    const after = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPoint.id } });
    expect(after.chaseCount).toBe(0);
    expect(after.lastChasedAt).toBeNull();
    expect(await prisma.holdPointReleaseToken.count({ where: { holdPointId: holdPoint.id } })).toBe(
      0,
    );

    // PROOF OF CATCH: grant consent and the same row DOES produce a digest, so
    // the zero above is the gate and not an inert fixture.
    await grantConsent(projectId, SUPER_EMAIL);
    const granted = await processHoldPointChaseReminders({ now: new Date() });
    expect(granted.digestsSent).toBe(1);
  });

  it('sends nothing to a recipient who unsubscribed, even with consent on file', async () => {
    await createAwaitingHoldPoint({
      suffix: 'unsubscribed',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });
    // Unsubscribed on ANOTHER project: the opt-out is honoured globally.
    await recordHoldPointMailUnsubscribe(otherProjectId, SUPER_EMAIL.toUpperCase());

    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.unsubscribedSkipped).toBe(1);
    expect(result.noConsentSkipped).toBe(0);
    expect(result.digestsSent).toBe(0);
    expect(getQueuedEmails()).toHaveLength(0);
  });

  it('every automated digest carries an unsubscribe link', async () => {
    await createAwaitingHoldPoint({
      suffix: 'unsub-line',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    const result = await processHoldPointChaseReminders({ now: new Date() });
    expect(result.digestsSent).toBe(1);

    const queued = getQueuedEmails()[0]!;
    expect(queued.text).toContain('/api/holdpoints/public/unsubscribe/');
    expect(queued.html).toContain('/api/holdpoints/public/unsubscribe/');
    // The link must actually work, and must resolve to THIS recipient.
    const token = /public\/unsubscribe\/([^\s"'<]+)/.exec(queued.text!)![1]!;
    expect(parseHoldPointUnsubscribeToken(token)).toEqual({
      projectId,
      email: SUPER_EMAIL,
    });
  });

  it('sends nothing to a suppressed address, and audits the skip', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'suppressed',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });
    recordEmailSuppression(SUPER_EMAIL, 'hard_bounce');
    expect(isEmailSuppressed('EXTERNAL.SUPER@example.com')).toBe(true);

    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.digestsSent).toBe(0);
    expect(getQueuedEmails()).toHaveLength(0);

    const audits = await chaseAudits(holdPoint.id);
    expect(audits).toHaveLength(1);
    const changes = JSON.parse(audits[0]!.changes!);
    expect(changes.sendResult).toBe('suppressed');
    // A suppressed send CONSUMES the attempt (`[E-j]`).
    const after = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPoint.id } });
    expect(after.chaseCount).toBe(1);
  });
});

describe('AT-102 timing and the guards hold', () => {
  it('a far-future scheduledDate with minimumNoticeDays = 1 produces NO reminder', async () => {
    // The Rev 1 bug: `minimumNoticeDays` as a backward reminder age would have
    // chased this 13 days before it was due.
    await createAwaitingHoldPoint({
      suffix: 'far-future',
      scheduledDate: new Date(Date.now() + 14 * DAY_MS),
    });

    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.digestsSent).toBe(0);
    expect(getQueuedEmails()).toHaveLength(0);
  });

  it('reminds once the scheduled date is within one working day', async () => {
    // A Thursday, with the due date the following Friday.
    const thursday = new Date('2026-06-04T02:00:00.000Z');
    await createAwaitingHoldPoint({
      suffix: 'lead',
      scheduledDate: new Date('2026-06-05T00:00:00.000Z'),
      notificationSentAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    const result = await processHoldPointChaseReminders({ now: thursday });

    expect(result.digestsSent).toBe(1);
  });

  it('a weekend-adjacent due date reminds on the working day, not the weekend', async () => {
    // Monday 8 June 2026 is due; the Friday before (5 June) is one WORKING day
    // away, the Saturday is zero. Both are within the lead time; the Wednesday
    // before is not.
    await createAwaitingHoldPoint({
      suffix: 'weekend',
      scheduledDate: new Date('2026-06-08T00:00:00.000Z'),
      notificationSentAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    const wednesday = await processHoldPointChaseReminders({
      now: new Date('2026-06-03T02:00:00.000Z'),
    });
    expect(wednesday.digestsSent).toBe(0);

    const friday = await processHoldPointChaseReminders({
      now: new Date('2026-06-05T02:00:00.000Z'),
    });
    expect(friday.digestsSent).toBe(1);
  });

  it('a non-default project workingDays string shifts the threshold', async () => {
    // Saturday is a working day on this project, so the Friday before a Monday
    // due date is TWO working days away and must not remind yet.
    await prisma.project.update({
      where: { id: projectId },
      data: { workingDays: '1,2,3,4,5,6' },
    });
    await createAwaitingHoldPoint({
      suffix: 'workingdays',
      scheduledDate: new Date('2026-06-08T00:00:00.000Z'),
      notificationSentAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    const friday = await processHoldPointChaseReminders({
      now: new Date('2026-06-05T02:00:00.000Z'),
    });
    expect(friday.digestsSent).toBe(0);

    await prisma.project.update({
      where: { id: projectId },
      data: { workingDays: '1,2,3,4,5' },
    });
  });

  it('a near-midnight value lands on the intended day in APP_TIMEZONE', async () => {
    // 23:30 UTC on the due date. The suite pins APP_TIMEZONE=UTC, so this is
    // still the due DAY and the reminder fires; a raw-timestamp comparison
    // against `now` would have called it "not yet due".
    await createAwaitingHoldPoint({
      suffix: 'midnight',
      scheduledDate: new Date('2026-06-04T23:30:00.000Z'),
      notificationSentAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    const result = await processHoldPointChaseReminders({
      now: new Date('2026-06-04T01:00:00.000Z'),
    });
    expect(result.digestsSent).toBe(1);
  });

  it('produces no reminder for a null scheduledDate, a released or a completed hold point', async () => {
    await createAwaitingHoldPoint({
      suffix: 'released',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
      status: 'released',
    });
    await createAwaitingHoldPoint({
      suffix: 'completed',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
      status: 'completed',
    });
    const nullScheduled = await createChecklistItem(templateId, 'null-scheduled');
    await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: nullScheduled.id,
        pointType: 'hold_point',
        status: 'notified',
        scheduledDate: null,
        notificationSentAt: new Date(),
        notificationSentTo: SUPER_EMAIL,
      },
    });

    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.eligibleHoldPoints).toBe(0);
    expect(result.digestsSent).toBe(0);
  });

  it('respects the cooldown and the per-generation cap', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'cooldown',
      scheduledDate: new Date(Date.now() - 5 * DAY_MS),
      chaseCount: 1,
      lastChasedAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const cooled = await processHoldPointChaseReminders({ now: new Date() });
    expect(cooled.digestsSent).toBe(0);

    await prisma.holdPoint.update({
      where: { id: holdPoint.id },
      data: { chaseCount: MAX_CHASES_PER_REQUEST, lastChasedAt: new Date(Date.now() - 5 * DAY_MS) },
    });
    const capped = await processHoldPointChaseReminders({ now: new Date() });
    expect(capped.digestsSent).toBe(0);
  });
});

describe('AT-118 / E.0 item 11 — no expired capability is treated as live', () => {
  it('the SHARED resolver never selects an expired token from tier 1', async () => {
    // The exit condition for E.0 verdict row 3d, asserted on the resolver both
    // the manual route and the job depend on. Retention is DISABLED here, which
    // is its default outside production and the case Rev 1 missed: without the
    // `expiresAt` predicate an expired capability seeds new chases forever.
    expect(process.env.DATA_RETENTION_WORKER_ENABLED).not.toBe('true');

    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'resolver-expired',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
      notificationSentTo: 'durable.super@example.com',
    });
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: holdPoint.id,
        recipientEmail: 'stale.super@example.com',
        recipientName: 'Stale Superintendent',
        token: hashHoldPointReleaseToken('b'.repeat(64)),
        expiresAt: new Date(Date.now() - DAY_MS),
      },
    });

    const liveOnly = await loadLiveTokenChaseTargets(holdPoint.id, new Date());
    // PROOF OF CATCH: without `expiresAt: { gt: now }` this returns the stale
    // recipient.
    expect(liveOnly).toHaveLength(0);

    const resolved = await loadHoldPointChaseTargets(
      holdPoint.id,
      projectId,
      new Date(),
      holdPoint.notificationSentTo,
      {
        allowProjectUserFallback: true,
        selectRecipients: (sup, pm) => (sup.length > 0 ? sup : pm),
      },
    );
    expect(resolved.map((target) => target.email)).toEqual(['durable.super@example.com']);
    expect(resolved.map((target) => target.email)).not.toContain('stale.super@example.com');
  });

  it('a LIVE token still resolves from tier 1, so the guard is expiry and not a blanket refusal', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'resolver-live',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
      notificationSentTo: 'durable.super@example.com',
    });
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: holdPoint.id,
        recipientEmail: 'live.super@example.com',
        recipientName: 'Live Superintendent',
        token: hashHoldPointReleaseToken('c'.repeat(64)),
        expiresAt: new Date(Date.now() + DAY_MS),
      },
    });

    const liveOnly = await loadLiveTokenChaseTargets(holdPoint.id, new Date());
    expect(liveOnly.map((target) => target.email)).toEqual(['live.super@example.com']);
  });

  it('the job does not mail an expired token holder; it mails notificationSentTo', async () => {
    // Asserted with the retention worker DISABLED, which is its default outside
    // production — the case where an expired token lingers forever.
    expect(process.env.DATA_RETENTION_WORKER_ENABLED).not.toBe('true');

    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'expired-token',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
      notificationSentTo: 'durable.super@example.com',
    });
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: holdPoint.id,
        recipientEmail: 'stale.super@example.com',
        recipientName: 'Stale Superintendent',
        token: hashHoldPointReleaseToken('a'.repeat(64)),
        expiresAt: new Date(Date.now() - DAY_MS),
      },
    });

    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.digestsSent).toBe(1);
    const queued = getQueuedEmails();
    // PROOF OF CATCH: before the `expiresAt` predicate, the expired token's
    // recipient seeded the chase. Now the durable record wins.
    expect(queued[0]!.to).toBe('durable.super@example.com');
    expect(queued[0]!.to).not.toBe('stale.super@example.com');
  });

  it.each([
    [
      'a released hold point',
      async (id: string) =>
        prisma.holdPoint.update({ where: { id }, data: { status: 'released' } }),
    ],
    [
      'a new generation (re-request)',
      async (id: string) =>
        prisma.holdPoint.update({
          where: { id },
          data: {
            notificationSentAt: new Date(),
            chaseCount: 0,
            lastChasedAt: null,
            scheduledDate: new Date(Date.now() + 30 * DAY_MS),
          },
        }),
    ],
    [
      'a closed project',
      async () => prisma.project.update({ where: { id: projectId }, data: { status: 'archived' } }),
    ],
    [
      'the recipient removed from notificationSentTo',
      async (id: string) =>
        prisma.holdPoint.update({ where: { id }, data: { notificationSentTo: null } }),
    ],
  ])('mints no token after %s (E.0 item 11 clause 3)', async (_label, terminate) => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: `terminate-${_label.slice(0, 8)}`,
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    await terminate(holdPoint.id);

    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.digestsSent).toBe(0);
    expect(getQueuedEmails()).toHaveLength(0);
    const tokens = await prisma.holdPointReleaseToken.findMany({
      where: { holdPointId: holdPoint.id },
    });
    expect(tokens).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The four confirmed findings of the 2026-07-28 deep review
// (`docs/reviews/fable-deep-review-2026-07-28.md` H3, L1, L6). L2 — the
// `daysSinceRequest` clamp — is asserted on the manual path in
// `routes/holdpoints/actionRoutes.chase.test.ts`, which is where the unclamped
// copy lived.

describe('the chase revokes only what the chase minted', () => {
  it('H3: a successful digest leaves the superintendent LIVE batch review-room token intact', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'batch-room',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    // The review room CIVOS already emailed: a batch, and this hold point's
    // token inside it. Every public batch route reaches its hold points through
    // `batch.releaseTokens`, so this row IS the room's membership.
    const batch = await prisma.holdPointReleaseBatch.create({
      data: {
        lotId,
        recipientEmail: SUPER_EMAIL,
        recipientName: 'External Superintendent',
        token: hashHoldPointReleaseToken('d'.repeat(64)),
        expiresAt: new Date(Date.now() + 2 * DAY_MS),
      },
    });
    const batchToken = await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: holdPoint.id,
        batchId: batch.id,
        recipientEmail: SUPER_EMAIL,
        recipientName: 'External Superintendent',
        token: hashHoldPointReleaseToken('e'.repeat(64)),
        expiresAt: new Date(Date.now() + 2 * DAY_MS),
      },
    });
    // A previous chase's own link to the same address — this one SHOULD go, and
    // its going is what proves the revoker ran at all.
    const supersededChaseToken = await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: holdPoint.id,
        recipientEmail: SUPER_EMAIL,
        recipientName: 'External Superintendent',
        token: hashHoldPointReleaseToken('f'.repeat(64)),
        expiresAt: new Date(Date.now() + 2 * DAY_MS),
      },
    });

    const result = await processHoldPointChaseReminders({ now: new Date() });
    expect(result.digestsSent).toBe(1);

    // PROOF OF CATCH: without `batchId: null` in the revoker's where clause this
    // row is deleted — same `holdPointId`, same `recipientEmail`, `usedAt` null,
    // different hash — and the room silently drops the hold point.
    const survivor = await prisma.holdPointReleaseToken.findUnique({
      where: { id: batchToken.id },
    });
    expect(survivor).not.toBeNull();
    expect(survivor!.batchId).toBe(batch.id);

    const room = await prisma.holdPointReleaseBatch.findUniqueOrThrow({
      where: { id: batch.id },
      include: { releaseTokens: true },
    });
    expect(room.releaseTokens.map((token) => token.holdPointId)).toContain(holdPoint.id);

    // The revoker DID run: the chase's own superseded link is gone, and exactly
    // one batch-less token survives — the one this digest delivered.
    expect(
      await prisma.holdPointReleaseToken.findUnique({ where: { id: supersededChaseToken.id } }),
    ).toBeNull();
    const chaseTokens = await prisma.holdPointReleaseToken.findMany({
      where: { holdPointId: holdPoint.id, batchId: null },
    });
    expect(chaseTokens).toHaveLength(1);
  });

  it.each([
    ['failed', { success: false, error: 'connection reset by peer', errorCode: 'transport_error' }],
    ['suppressed', { success: false, error: 'hard bounce', errorCode: 'bounced' }],
  ])('L6: a %s digest leaves no orphan release token behind', async (_label, transportResult) => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: `orphan-${_label}`,
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    await runChaseJob(
      { now: new Date() },
      {
        ...buildHoldPointChaseAutomationDependencies(prisma),
        sendEmail: async () => transportResult,
      },
    );

    // The token is minted BEFORE the send, so a digest that never left the
    // building leaves a live capability nobody was ever told about.
    expect(await prisma.holdPointReleaseToken.count({ where: { holdPointId: holdPoint.id } })).toBe(
      0,
    );

    // PROOF OF CATCH: the same fixture with a working transport DOES leave one
    // live token — the link the recipient actually received — so the zero
    // above is the revoke, not a hold point that never minted anything.
    resetEmailSuppressionForTests();
    await prisma.holdPoint.update({
      where: { id: holdPoint.id },
      data: { chaseCount: 0, lastChasedAt: null },
    });
    const sent = await processHoldPointChaseReminders({ now: new Date() });
    expect(sent.digestsSent).toBe(1);
    const live = await prisma.holdPointReleaseToken.findMany({
      where: { holdPointId: holdPoint.id, usedAt: null },
    });
    expect(live).toHaveLength(1);
    expect(live[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('AT-114 the reservation is atomic', () => {
  it('L1: a reservation from generation A does not succeed once a re-request opens generation B', async () => {
    const generationA = new Date(Date.now() - 5 * DAY_MS);
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'generation-identity',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
      notificationSentAt: generationA,
    });

    // The re-request, exactly as `requestReleaseRoutes` writes it: a NEWER
    // `notificationSentAt` with both counters reset in the same transaction.
    const generationB = new Date(Date.now() - DAY_MS);
    await prisma.holdPoint.update({
      where: { id: holdPoint.id },
      data: { notificationSentAt: generationB, chaseCount: 0, lastChasedAt: null },
    });

    const stale = await reserveHoldPointChase(holdPoint.id, new Date(), generationA);

    // PROOF OF CATCH: with `gte` this reserved — every other clause passes on a
    // freshly re-requested row — and the send was billed as chase #1 of a
    // generation it was never about.
    expect(stale.reserved).toBe(false);
    const untouched = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPoint.id } });
    expect(untouched.chaseCount).toBe(0);
    expect(untouched.lastChasedAt).toBeNull();

    // The bound is an identity, not a blanket refusal: the CURRENT generation
    // still reserves.
    const current = await reserveHoldPointChase(holdPoint.id, new Date(), generationB);
    expect(current.reserved).toBe(true);
    expect(current.chaseCount).toBe(1);
  });

  it('two concurrent passes against one hold point send EXACTLY once', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'concurrent',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });
    const now = new Date();

    const [a, b] = await Promise.all([
      processHoldPointChaseReminders({ now }),
      processHoldPointChaseReminders({ now }),
    ]);

    // PROOF OF CATCH: the pre-E2 shape was findUnique -> check -> bare update,
    // under which both callers passed and both sent.
    expect(a.digestsSent + b.digestsSent).toBe(1);
    expect(getQueuedEmails()).toHaveLength(1);
    const after = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPoint.id } });
    expect(after.chaseCount).toBe(1);
  });

  it('the manual chase route and the job together send exactly once', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'route-vs-job',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    const [routeRes, jobResult] = await Promise.all([
      request(app)
        .post(`/api/holdpoints/${holdPoint.id}/chase`)
        .set('Authorization', `Bearer ${requesterToken}`),
      processHoldPointChaseReminders({ now: new Date() }),
    ]);

    const sends = (routeRes.status === 200 ? 1 : 0) + jobResult.digestsSent;
    expect(sends).toBe(1);
    const after = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPoint.id } });
    expect(after.chaseCount).toBe(1);
  });

  it('a new release request resets the generation, so a capped hold point qualifies again', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'generation',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
      chaseCount: MAX_CHASES_PER_REQUEST,
      lastChasedAt: new Date(Date.now() - 5 * DAY_MS),
    });

    const capped = await processHoldPointChaseReminders({ now: new Date() });
    expect(capped.digestsSent).toBe(0);

    // The real route rewrites `notificationSentAt` AND resets the counter, in
    // one transaction — that is the generation.
    const res = await request(app)
      .post('/api/holdpoints/request-release')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        lotId,
        itpChecklistItemId: holdPoint.itpChecklistItemId,
        scheduledDate: new Date(Date.now() - 2 * DAY_MS).toISOString().slice(0, 10),
        notificationSentTo: SUPER_EMAIL,
        noticePeriodOverride: true,
        noticePeriodOverrideReason: 'test regeneration',
      });
    expect(res.status).toBe(200);

    const reset = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPoint.id } });
    expect(reset.chaseCount).toBe(0);
    expect(reset.lastChasedAt).toBeNull();

    clearEmailQueue();
    const afterRerequest = await processHoldPointChaseReminders({ now: new Date() });
    expect(afterRerequest.digestsSent).toBe(1);
  });
});

describe('AT-101 / AT-115 / AT-117 — reach, attribution and audit', () => {
  it('reaches the address in notificationSentTo after every token is gone, without falling through to project users', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'no-tokens',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
      notificationSentTo: 'purged.super@example.com',
    });
    // The retention sweep has removed every token.
    await prisma.holdPointReleaseToken.deleteMany({ where: { holdPointId: holdPoint.id } });

    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.digestsSent).toBe(1);
    const queued = getQueuedEmails();
    expect(queued[0]!.to).toBe('purged.super@example.com');
    // PROOF OF CATCH: the pre-fix behaviour was to fall through to internal
    // project users. The requester is an admin on this project; the reminder
    // must not have gone to them.
    const requesterUser = await prisma.user.findUniqueOrThrow({ where: { id: requesterId } });
    expect(queued[0]!.to).not.toBe(requesterUser.email);
    // And a fresh, live, single-hold-point token was minted for the link.
    const tokens = await prisma.holdPointReleaseToken.findMany({
      where: { holdPointId: holdPoint.id },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.recipientEmail).toBe('purged.super@example.com');
    expect(tokens[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('resolves the requester via the audit lookup on the SINGLE-request path and sets replyTo', async () => {
    // The single path has no `requestedByUserId` anywhere, so this can only
    // pass through the `HP_RELEASE_REQUESTED` audit row.
    const item = await createChecklistItem(templateId, 'requester');
    const res = await request(app)
      .post('/api/holdpoints/request-release')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        lotId,
        itpChecklistItemId: item.id,
        scheduledDate: new Date(Date.now() - 2 * DAY_MS).toISOString().slice(0, 10),
        notificationSentTo: SUPER_EMAIL,
        noticePeriodOverride: true,
        noticePeriodOverrideReason: 'test',
      });
    expect(res.status).toBe(200);

    const holdPoint = await prisma.holdPoint.findFirstOrThrow({
      where: { lotId, itpChecklistItemId: item.id },
    });
    expect(await prisma.holdPointReleaseBatch.findFirst({ where: { lotId } })).toBeNull();

    // Wave E2.1: this hold point came through the ROUTE, not the fixture
    // helper, so nothing granted consent. This test is about requester
    // attribution, not the gate.
    await grantConsent(projectId, SUPER_EMAIL);

    clearEmailQueue();
    const result = await processHoldPointChaseReminders({ now: new Date() });
    expect(result.digestsSent).toBe(1);

    const queued = getQueuedEmails()[0]!;
    const requesterUser = await prisma.user.findUniqueOrThrow({ where: { id: requesterId } });
    expect(queued.replyTo).toBe(requesterUser.email);
    expect(queued.text).toContain('Rita Requester');
    // `[E-B8b]`: never the recipient's own address.
    expect(queued.text).not.toContain(SUPER_EMAIL);

    const audits = await chaseAudits(holdPoint.id);
    const changes = JSON.parse(audits[0]!.changes!);
    expect(changes.requesterResolution).toBe('requester');
  });

  it('falls back to company support and NAMES the fallback when the requester is inactive', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'inactive-requester',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });
    await prisma.auditLog.create({
      data: {
        projectId,
        userId: requesterId,
        entityType: 'hold_point',
        entityId: holdPoint.id,
        action: 'hp_release_requested',
        createdAt: new Date(),
      },
    });
    await prisma.projectUser.updateMany({
      where: { projectId, userId: requesterId },
      data: { status: 'inactive' },
    });

    const result = await processHoldPointChaseReminders({ now: new Date() });
    expect(result.digestsSent).toBe(1);

    const queued = getQueuedEmails()[0]!;
    expect(queued.replyTo).toBe(process.env.SUPPORT_EMAIL || 'support@civos.com.au');
    // Named as a fallback, not silently attributed to support.
    expect(queued.text).toMatch(/original requester is no longer available/i);

    const audits = await chaseAudits(holdPoint.id);
    expect(JSON.parse(audits[0]!.changes!).requesterResolution).toBe('fallback_inactive');

    await prisma.projectUser.updateMany({
      where: { projectId, userId: requesterId },
      data: { status: 'active' },
    });
  });

  it('falls back rather than throwing when there is no HP_RELEASE_REQUESTED row', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'no-audit-row',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    const result = await processHoldPointChaseReminders({ now: new Date() });

    expect(result.digestsSent).toBe(1);
    const audits = await chaseAudits(holdPoint.id);
    expect(JSON.parse(audits[0]!.changes!).requesterResolution).toBe('fallback_no_audit_row');
  });

  it('AT-117: an automated send writes a system-actor audit row with the full payload', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'audit',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    await processHoldPointChaseReminders({ now: new Date() });

    const audits = await chaseAudits(holdPoint.id);
    expect(audits).toHaveLength(1);
    // The system actor: no user, and the column is nullable with SetNull.
    expect(audits[0]!.userId).toBeNull();

    const changes = JSON.parse(audits[0]!.changes!);
    expect(changes.source).toBe('automation');
    expect(changes.reservationId).toEqual(expect.any(String));
    expect(changes.generation).toEqual(expect.any(String));
    expect(changes.chaseCount).toBe(1);
    expect(changes.sendResult).toBe('sent');
    expect(changes.digestSize).toBe(1);
    expect(changes.requesterResolution).toEqual(expect.any(String));
  });

  it('AT-117: a FAILED send is audited too, and refunds the reservation', async () => {
    // The other arm of AT-117. `finaliseGroupItems` audits all three outcomes
    // and refunds the attempt on a transport failure (`[E-j]`) — the refund was
    // only ever tested on the MANUAL route (actionRoutes.chase.test.ts:245),
    // never on the job path, so the failed row itself had no test at all.
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'send-failed',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    // The transport rejects. Deliberately NOT a suppression signal — that word
    // list (`isSuppressionFailure`) routes to 'suppressed', which CONSUMES the
    // attempt; a transport problem is retryable and must refund it.
    const result = await runChaseJob(
      { now: new Date() },
      {
        ...buildHoldPointChaseAutomationDependencies(prisma),
        sendEmail: async () => ({
          success: false,
          error: 'connection reset by peer',
          errorCode: 'transport_error',
        }),
      },
    );

    expect(result.sendFailures).toBe(1);
    expect(result.digestsSent).toBe(0);
    expect(result.holdPointsReminded).toBe(0);

    // The audit row exists and says `failed` — the claim #1662's body made and
    // no test held.
    const audits = await chaseAudits(holdPoint.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]!.userId).toBeNull();
    const changes = JSON.parse(audits[0]!.changes!);
    expect(changes.source).toBe('automation');
    expect(changes.sendResult).toBe('failed');
    expect(changes.chaseCount).toBe(1);
    expect(changes.digestSize).toBe(1);

    // The refund, read back from the row: the reservation is given back, so the
    // next pass may try again and the daily limit does not lock the recipient
    // out on a message they never received.
    const after = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPoint.id } });
    expect(after.chaseCount).toBe(0);
    expect(after.lastChasedAt).toBeNull();

    // PROOF OF CATCH: with the SAME fixture and a transport that succeeds, the
    // attempt is consumed instead — so the zeroes above are the rollback, not an
    // unreserved hold point.
    await prisma.auditLog.deleteMany({ where: { entityId: holdPoint.id } });
    const sent = await processHoldPointChaseReminders({ now: new Date() });
    expect(sent.digestsSent).toBe(1);
    const settled = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPoint.id } });
    expect(settled.chaseCount).toBe(1);
    expect(settled.lastChasedAt).not.toBeNull();
    expect(JSON.parse((await chaseAudits(holdPoint.id))[0]!.changes!).sendResult).toBe('sent');
  });

  it('AT-109: the recipient never lands in the audit log un-redacted', async () => {
    const holdPoint = await createAwaitingHoldPoint({
      suffix: 'redaction',
      scheduledDate: new Date(Date.now() - 2 * DAY_MS),
    });

    await processHoldPointChaseReminders({ now: new Date() });

    // Asserted on the row read BACK from the database, not on the argument.
    const audits = await chaseAudits(holdPoint.id);
    const raw = audits[0]!.changes!;
    expect(raw).not.toContain(SUPER_EMAIL);
    expect(raw).not.toContain('@');
    expect(JSON.parse(raw).tokenRecipient).toBe('[REDACTED]');
    // The substring guard: the key keeps "token" in it, which is what the
    // `/token/i` trap matches. Renaming it would silently start persisting
    // external recipient emails (E.0 item 9b).
    expect(Object.keys(JSON.parse(raw)).some((key) => /token/i.test(key))).toBe(true);
  });
});
