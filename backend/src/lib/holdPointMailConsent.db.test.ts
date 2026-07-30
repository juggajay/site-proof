// Wave E2.1 — the Spam Act consent gate.
//
// Jay's decision, 2026-07-31, in his own name: an automated hold-point reminder
// goes only to a recipient who has opened a CIVOS link at least once, and every
// digest carries an unsubscribe line. These tests are that rule, and nothing in
// this file states or implies a legal conclusion (E.0 §7.3).
//
// DB-backed, like the chase tests it guards: every arm of the gate is a query
// over real rows across two tables and a project boundary, and the failure that
// matters — a gate that silently lets everyone through, or silently nobody — is
// invisible to a mock that answers whatever it was told.
// `src/test/databaseSafety.ts` keeps this on the local disposable database.

import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from './prisma.js';
import {
  createHoldPointUnsubscribeToken,
  hasOpenedHoldPointLink,
  isHoldPointMailUnsubscribed,
  parseHoldPointUnsubscribeToken,
  recordHoldPointLinkOpen,
  recordHoldPointMailUnsubscribe,
} from './holdPointMailConsent.js';
import { buildStaleHoldPointMailConsentWhere } from './dataRetention.js';
import { renderHoldPointChaseDigestEmail } from './email/holdPointChaseDigestTemplate.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { holdpointsRouter } from '../routes/holdpoints.js';
import { hashHoldPointReleaseToken } from '../routes/holdpoints/tokens.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const tag = `e21-consent-${Date.now()}`;
const SUPER = 'external.super@example.com';
const DAY_MS = 24 * 60 * 60 * 1000;

let companyId: string;
let projectId: string;
let otherProjectId: string;
let lotId: string;
let otherLotId: string;
let holdPointId: string;
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
  const template = await prisma.iTPTemplate.create({
    data: { projectId: project.id, name: `T ${tag} ${suffix}`, activityType: 'Earthworks' },
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

async function createHoldPoint(templateId: string, targetLotId: string) {
  checklistSequence += 1;
  const item = await prisma.iTPChecklistItem.create({
    data: {
      templateId,
      description: `Consent item ${checklistSequence}`,
      pointType: 'hold_point',
      sequenceNumber: checklistSequence,
    },
  });
  return prisma.holdPoint.create({
    data: {
      lotId: targetLotId,
      itpChecklistItemId: item.id,
      pointType: 'hold_point',
      description: 'Consent hold point',
      status: 'notified',
      notificationSentAt: new Date(),
      notificationSentTo: SUPER,
    },
  });
}

async function createToken(overrides: {
  recipientEmail: string;
  openedAt?: Date | null;
  usedAt?: Date | null;
  holdPointId?: string;
  rawToken?: string;
}) {
  const raw = overrides.rawToken ?? `raw-${tag}-${Math.random().toString(16).slice(2)}`;
  return prisma.holdPointReleaseToken.create({
    data: {
      holdPointId: overrides.holdPointId ?? holdPointId,
      recipientEmail: overrides.recipientEmail,
      token: hashHoldPointReleaseToken(raw),
      expiresAt: new Date(Date.now() + DAY_MS),
      openedAt: overrides.openedAt ?? null,
      usedAt: overrides.usedAt ?? null,
    },
  });
}

async function clearState() {
  await prisma.holdPointMailConsent.deleteMany({
    where: { projectId: { in: [projectId, otherProjectId] } },
  });
  await prisma.holdPointReleaseToken.deleteMany({
    where: { holdPoint: { lot: { projectId: { in: [projectId, otherProjectId] } } } },
  });
  await prisma.holdPointReleaseBatch.deleteMany({
    where: { lot: { projectId: { in: [projectId, otherProjectId] } } },
  });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const main = await createProjectFixture('main');
  projectId = main.projectId;
  lotId = main.lotId;
  const other = await createProjectFixture('other');
  otherProjectId = other.projectId;
  otherLotId = other.lotId;

  holdPointId = (await createHoldPoint(main.templateId, main.lotId)).id;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearState();
});

afterAll(async () => {
  const projectIds = [projectId, otherProjectId];
  await clearState();
  await prisma.holdPoint.deleteMany({ where: { lot: { projectId: { in: projectIds } } } });
  await prisma.iTPChecklistItem.deleteMany({
    where: { template: { projectId: { in: projectIds } } },
  });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId: { in: projectIds } } } });
  await prisma.lot.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

// ---------------------------------------------------------------------------

describe('the gate — hasOpenedHoldPointLink', () => {
  it('FAILS CLOSED: a recipient with no token, no batch and no consent row is ineligible', async () => {
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(false);
  });

  it('an unopened, unused token is not proof', async () => {
    await createToken({ recipientEmail: SUPER });
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(false);
  });

  it('is eligible via a token openedAt', async () => {
    await createToken({ recipientEmail: SUPER, openedAt: new Date() });
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(true);
  });

  it('is eligible via a token usedAt — the backfill-free path for historical rows', async () => {
    // Rows that predate this wave have no `openedAt` and never will. A used
    // token was necessarily opened first, so it is the only proof they carry.
    await createToken({ recipientEmail: SUPER, usedAt: new Date() });
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(true);
  });

  it('is eligible via a batch openedAt', async () => {
    await prisma.holdPointReleaseBatch.create({
      data: {
        lotId,
        recipientEmail: SUPER,
        token: hashHoldPointReleaseToken(`batch-${tag}`),
        expiresAt: new Date(Date.now() + DAY_MS),
        openedAt: new Date(),
      },
    });
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(true);
  });

  it('is eligible via the durable consent row alone, after every token is purged', async () => {
    // The case the whole table exists for: release tokens live 48 hours and the
    // retention worker deletes them, but the reminder is due days later.
    await prisma.holdPointMailConsent.create({
      data: { projectId, email: SUPER, firstOpenedAt: new Date() },
    });
    expect(await prisma.holdPointReleaseToken.count({ where: { holdPointId } })).toBe(0);
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(true);
  });

  it('a consent row with no firstOpenedAt (unsubscribe-only) is not proof of an open', async () => {
    await prisma.holdPointMailConsent.create({
      data: { projectId, email: SUPER, unsubscribedAt: new Date() },
    });
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(false);
  });

  it.each([
    ['stored upper, queried lower', 'External.Super@Example.com', 'external.super@example.com'],
    ['stored lower, queried upper', 'external.super@example.com', 'EXTERNAL.SUPER@EXAMPLE.COM'],
    ['queried with surrounding whitespace', SUPER, `  ${SUPER}  `],
  ])('normalizes casing and whitespace: %s', async (_label, stored, queried) => {
    await createToken({ recipientEmail: stored, openedAt: new Date() });
    expect(await hasOpenedHoldPointLink(projectId, queried)).toBe(true);
  });

  it('is scoped to the project: an open on another project does not license mail on this one', async () => {
    const otherHoldPoint = await prisma.holdPoint.findFirst({ where: { lotId: otherLotId } });
    const otherTemplate = await prisma.iTPTemplate.findFirstOrThrow({
      where: { projectId: otherProjectId },
    });
    const target = otherHoldPoint ?? (await createHoldPoint(otherTemplate.id, otherLotId));
    await createToken({
      recipientEmail: SUPER,
      openedAt: new Date(),
      holdPointId: target.id,
    });

    expect(await hasOpenedHoldPointLink(otherProjectId, SUPER)).toBe(true);
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(false);
  });

  it('an empty or blank address is never eligible', async () => {
    expect(await hasOpenedHoldPointLink(projectId, '   ')).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('recording an open', () => {
  it('stamps the token and creates the durable row on the public GET', async () => {
    const raw = `open-${tag}`;
    const token = await createToken({ recipientEmail: SUPER, rawToken: raw });

    const res = await request(app).get(`/api/holdpoints/public/${raw}`);
    expect(res.status).toBe(200);

    const after = await prisma.holdPointReleaseToken.findUniqueOrThrow({
      where: { id: token.id },
    });
    expect(after.openedAt).not.toBeNull();

    const consent = await prisma.holdPointMailConsent.findUniqueOrThrow({
      where: { projectId_email: { projectId, email: SUPER } },
    });
    expect(consent.firstOpenedAt).not.toBeNull();
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(true);
  });

  it('the FIRST open sticks — a re-read does not churn either row', async () => {
    const raw = `first-${tag}`;
    const token = await createToken({ recipientEmail: SUPER, rawToken: raw });

    expect((await request(app).get(`/api/holdpoints/public/${raw}`)).status).toBe(200);
    const first = await prisma.holdPointReleaseToken.findUniqueOrThrow({ where: { id: token.id } });
    const firstConsent = await prisma.holdPointMailConsent.findUniqueOrThrow({
      where: { projectId_email: { projectId, email: SUPER } },
    });

    expect((await request(app).get(`/api/holdpoints/public/${raw}`)).status).toBe(200);
    const second = await prisma.holdPointReleaseToken.findUniqueOrThrow({
      where: { id: token.id },
    });
    const secondConsent = await prisma.holdPointMailConsent.findUniqueOrThrow({
      where: { projectId_email: { projectId, email: SUPER } },
    });

    expect(second.openedAt!.getTime()).toBe(first.openedAt!.getTime());
    expect(secondConsent.firstOpenedAt!.getTime()).toBe(firstConsent.firstOpenedAt!.getTime());
    expect(secondConsent.id).toBe(firstConsent.id);
  });

  it('a HEAD probe is not an open — a mail scanner must not manufacture consent', async () => {
    const raw = `head-${tag}`;
    const token = await createToken({ recipientEmail: SUPER, rawToken: raw });

    expect((await request(app).head(`/api/holdpoints/public/${raw}`)).status).toBe(200);

    const after = await prisma.holdPointReleaseToken.findUniqueOrThrow({
      where: { id: token.id },
    });
    expect(after.openedAt).toBeNull();
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(false);
  });

  it('a failed write is NOT fatal — the recipient still sees the evidence page', async () => {
    const raw = `fail-${tag}`;
    await createToken({ recipientEmail: SUPER, rawToken: raw });
    const upsert = vi
      .spyOn(prisma.holdPointMailConsent, 'upsert')
      .mockRejectedValue(new Error('consent write exploded'));

    const res = await request(app).get(`/api/holdpoints/public/${raw}`);

    expect(upsert).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body.isPublicAccess).toBe(true);
  });

  it('records the open on the batch review-room door', async () => {
    const raw = `batch-open-${tag}`;
    const batch = await prisma.holdPointReleaseBatch.create({
      data: {
        lotId,
        recipientEmail: SUPER,
        token: hashHoldPointReleaseToken(raw),
        expiresAt: new Date(Date.now() + DAY_MS),
      },
    });

    const res = await request(app).get(`/api/holdpoints/public/batch/${raw}`);
    expect(res.status).toBe(200);

    const after = await prisma.holdPointReleaseBatch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(after.openedAt).not.toBeNull();
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(true);
  });

  it('a blank recipient address records nothing', async () => {
    const stamp = vi.fn().mockResolvedValue(undefined);
    await recordHoldPointLinkOpen({ projectId, recipientEmail: '  ', stampOpenedAt: stamp });
    expect(stamp).not.toHaveBeenCalled();
    expect(await prisma.holdPointMailConsent.count({ where: { projectId } })).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('the unsubscribe token', () => {
  it('round-trips project and normalized email', () => {
    const token = createHoldPointUnsubscribeToken(projectId, ` ${SUPER.toUpperCase()} `);
    expect(parseHoldPointUnsubscribeToken(token)).toEqual({ projectId, email: SUPER });
  });

  it('is NOT derivable from the address alone: a forged signature is rejected', () => {
    const encoded = Buffer.from(SUPER, 'utf8').toString('base64url');
    expect(parseHoldPointUnsubscribeToken(`${projectId}.${encoded}.${'0'.repeat(64)}`)).toBeNull();
  });

  it('rejects a token whose email was swapped under a valid signature', () => {
    const token = createHoldPointUnsubscribeToken(projectId, SUPER);
    const signature = token.split('.')[2]!;
    const victim = Buffer.from('someone.else@example.com', 'utf8').toString('base64url');
    expect(parseHoldPointUnsubscribeToken(`${projectId}.${victim}.${signature}`)).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['one part', 'abc'],
    ['two parts', 'abc.def'],
    ['four parts', 'a.b.c.d'],
    ['blank email segment', `${'p'}..${'0'.repeat(64)}`],
  ])('rejects a malformed token: %s', (_label, value) => {
    expect(parseHoldPointUnsubscribeToken(value)).toBeNull();
  });
});

describe('the unsubscribe route', () => {
  function unsubscribePath(token = createHoldPointUnsubscribeToken(projectId, SUPER)) {
    return `/api/holdpoints/public/unsubscribe/${token}`;
  }

  it('GET renders a confirmation and writes NOTHING — a scanner must not opt anyone out', async () => {
    const res = await request(app).get(unsubscribePath());

    expect(res.status).toBe(200);
    expect(res.text).toContain('Unsubscribe me');
    expect(res.text).toContain(SUPER);
    expect(await prisma.holdPointMailConsent.count({ where: { projectId } })).toBe(0);
    expect(await isHoldPointMailUnsubscribed(SUPER)).toBe(false);
  });

  it('POST with a valid token suppresses the address', async () => {
    const res = await request(app).post(unsubscribePath());

    expect(res.status).toBe(200);
    expect(res.text).toContain('no longer send');
    expect(await isHoldPointMailUnsubscribed(SUPER)).toBe(true);

    const row = await prisma.holdPointMailConsent.findUniqueOrThrow({
      where: { projectId_email: { projectId, email: SUPER } },
    });
    expect(row.unsubscribedAt).not.toBeNull();
  });

  it('is idempotent: a second POST keeps the FIRST timestamp', async () => {
    expect((await request(app).post(unsubscribePath())).status).toBe(200);
    const first = await prisma.holdPointMailConsent.findUniqueOrThrow({
      where: { projectId_email: { projectId, email: SUPER } },
    });

    expect((await request(app).post(unsubscribePath())).status).toBe(200);
    const second = await prisma.holdPointMailConsent.findUniqueOrThrow({
      where: { projectId_email: { projectId, email: SUPER } },
    });

    expect(second.unsubscribedAt!.getTime()).toBe(first.unsubscribedAt!.getTime());
    expect(await prisma.holdPointMailConsent.count({ where: { projectId, email: SUPER } })).toBe(1);
  });

  it('preserves an existing consent row instead of replacing it', async () => {
    await prisma.holdPointMailConsent.create({
      data: { projectId, email: SUPER, firstOpenedAt: new Date() },
    });

    expect((await request(app).post(unsubscribePath())).status).toBe(200);

    const row = await prisma.holdPointMailConsent.findUniqueOrThrow({
      where: { projectId_email: { projectId, email: SUPER } },
    });
    expect(row.firstOpenedAt).not.toBeNull();
    expect(row.unsubscribedAt).not.toBeNull();
  });

  it.each([
    ['a forged signature', `p.${Buffer.from(SUPER).toString('base64url')}.${'0'.repeat(64)}`],
    ['a bare email', SUPER],
    ['gibberish', 'not-a-token'],
  ])('rejects %s with 4xx and suppresses nobody', async (_label, token) => {
    const get = await request(app).get(unsubscribePath(token));
    const post = await request(app).post(unsubscribePath(token));

    expect(get.status).toBe(400);
    expect(post.status).toBe(400);
    expect(await isHoldPointMailUnsubscribed(SUPER)).toBe(false);
  });

  it('is honoured GLOBALLY: one click stops reminders from every project', async () => {
    await recordHoldPointMailUnsubscribe(otherProjectId, SUPER);

    expect(await isHoldPointMailUnsubscribed(SUPER)).toBe(true);
    // ...and it is the unsubscribe, not the consent read, that is global: the
    // gate still answers per project.
    expect(await hasOpenedHoldPointLink(projectId, SUPER)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('the digest carries the unsubscribe line', () => {
  const item = {
    lotNumber: 'L-1',
    holdPointDescription: 'Subgrade',
    originalRequestDate: 'Monday, 1 January 2026',
    daysSinceRequest: 3,
    chaseCount: 1,
    releaseUrl: 'https://example.test/hp-release/abc',
  };
  const unsubscribeUrl = 'https://api.example.test/api/holdpoints/public/unsubscribe/t.o.k';

  it.each([
    ['a single item (the shipped chase template)', [item]],
    ['a consolidated digest', [item, { ...item, lotNumber: 'L-2' }]],
  ])('appends it to %s, in HTML and text', (_label, holdPoints) => {
    const rendered = renderHoldPointChaseDigestEmail({
      superintendentName: 'Sam Super',
      projectName: 'Northern Bypass',
      requestedBy: 'Rita Requester',
      requesterIsFallback: false,
      holdPoints,
      unsubscribeUrl,
    });

    expect(rendered.html).toContain(unsubscribeUrl);
    expect(rendered.html).toContain('Unsubscribe from these reminders');
    expect(rendered.html!.indexOf(unsubscribeUrl)).toBeLessThan(rendered.html!.indexOf('</body>'));
    expect(rendered.text).toContain(unsubscribeUrl);
  });

  it('omits it when no URL is supplied, so the manual chase email is unchanged', () => {
    const rendered = renderHoldPointChaseDigestEmail({
      superintendentName: 'Sam Super',
      projectName: 'Northern Bypass',
      requestedBy: 'Rita Requester',
      requesterIsFallback: false,
      holdPoints: [item],
    });

    expect(rendered.html).not.toContain('Unsubscribe from these reminders');
    expect(rendered.text).not.toContain('Unsubscribe from these reminders');
  });
});

// ---------------------------------------------------------------------------

describe('retention (E.0 item 16 — the table ships WITH its policy)', () => {
  it('sweeps a consent-only row past its inactivity window', async () => {
    const where = buildStaleHoldPointMailConsentWhere(new Date());
    await prisma.holdPointMailConsent.create({
      data: { projectId, email: SUPER, firstOpenedAt: new Date() },
    });
    await prisma.$executeRaw`UPDATE hold_point_mail_consents SET updated_at = NOW() - INTERVAL '3 years' WHERE project_id = ${projectId}`;

    expect(await prisma.holdPointMailConsent.count({ where })).toBe(1);
  });

  it('NEVER sweeps an unsubscribed row, however old', async () => {
    const where = buildStaleHoldPointMailConsentWhere(new Date());
    await prisma.holdPointMailConsent.create({
      data: { projectId, email: SUPER, unsubscribedAt: new Date() },
    });
    await prisma.$executeRaw`UPDATE hold_point_mail_consents SET updated_at = NOW() - INTERVAL '10 years' WHERE project_id = ${projectId}`;

    expect(await prisma.holdPointMailConsent.count({ where })).toBe(0);
  });

  it('leaves a recently active consent row alone', async () => {
    await prisma.holdPointMailConsent.create({
      data: { projectId, email: SUPER, firstOpenedAt: new Date() },
    });
    expect(
      await prisma.holdPointMailConsent.count({
        where: buildStaleHoldPointMailConsentWhere(new Date()),
      }),
    ).toBe(0);
  });
});
