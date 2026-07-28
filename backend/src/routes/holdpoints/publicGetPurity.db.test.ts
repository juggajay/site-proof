// AT-112 — `[E-B9]` GET purity, the regression test `[ER-A4]` asked for.
//
// Wave E approvals spec §4.4 / §12 AT-112: repeated GET and HEAD requests
// against every public (unauthenticated, token-bearing) hold-point and batch
// route must leave `usedAt` null, release nothing, write no audit decision row
// and trigger no notification.
//
// This is the FIRST test asserting non-mutation on these routes. `[ER-A4]`
// confirmed GET purity is intact today but untested: nothing stopped a future
// change — or a mail-client link prefetch, the real-world trigger — from
// turning a review-room GET into a release. The assertions are on the DATABASE
// re-read after the requests, never on the response bodies; response statuses
// are checked only so a route that silently 404s cannot make this vacuous.
//
// DB-backed on purpose: `usedAt`, the release columns, the audit row and the
// decision snapshot rows are all storage state. `src/test/databaseSafety.ts`
// keeps this on the local disposable database.

import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditAction } from '../../lib/auditLog.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { holdpointsRouter } from '../holdpoints.js';
import { buildTemplateSnapshot } from '../itp/helpers/templateSnapshot.js';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const tag = `hp-get-purity-${Date.now()}`;

const RELEASE_AUDIT_ACTIONS = [AuditAction.HP_RELEASED, AuditAction.HP_PUBLIC_RELEASED];

function hashToken(rawToken: string): string {
  return `sha256:${crypto.createHash('sha256').update(rawToken).digest('hex')}`;
}

let companyId: string;
let projectId: string;
let templateId: string;
let lotId: string;
let itpInstanceId: string;
let userId: string;
let documentId: string;
let documentFilePath: string;

// Single-token door.
let singleHoldPointId: string;
let singleTokenId: string;
let singleRawToken: string;

// Batch ("review room") door.
let batchId: string;
let batchHoldPointId: string;
let batchTokenId: string;
let batchRawToken: string;

/** Every public GET/HEAD route under /api/holdpoints, each on a 200 path. */
function publicGetPaths(): Array<{ label: string; path: string }> {
  return [
    { label: 'GET /public/:token', path: `/api/holdpoints/public/${singleRawToken}` },
    {
      label: 'GET /public/:token/documents/:documentId',
      path: `/api/holdpoints/public/${singleRawToken}/documents/${documentId}`,
    },
    {
      label: 'GET /public/batch/:batchToken',
      path: `/api/holdpoints/public/batch/${batchRawToken}`,
    },
    {
      label: 'GET /public/batch/:batchToken/holdpoints/:holdPointId',
      path: `/api/holdpoints/public/batch/${batchRawToken}/holdpoints/${batchHoldPointId}`,
    },
    {
      label: 'GET /public/batch/:batchToken/holdpoints/:holdPointId/documents/:documentId',
      path: `/api/holdpoints/public/batch/${batchRawToken}/holdpoints/${batchHoldPointId}/documents/${documentId}`,
    },
  ];
}

type PurityBaseline = {
  auditCount: number;
  notificationCount: number;
  decisionCount: number;
  singleTokenExpiresAt: number;
  batchTokenExpiresAt: number;
  batchExpiresAt: number;
};

async function captureBaseline(): Promise<PurityBaseline> {
  const [audits, notifications, decisions, singleToken, batchToken, batch] = await Promise.all([
    prisma.auditLog.count({ where: { projectId } }),
    prisma.notification.count({ where: { projectId } }),
    prisma.requirementEvaluation.count({ where: { projectId } }),
    prisma.holdPointReleaseToken.findUniqueOrThrow({ where: { id: singleTokenId } }),
    prisma.holdPointReleaseToken.findUniqueOrThrow({ where: { id: batchTokenId } }),
    prisma.holdPointReleaseBatch.findUniqueOrThrow({ where: { id: batchId } }),
  ]);

  return {
    auditCount: audits,
    notificationCount: notifications,
    decisionCount: decisions,
    singleTokenExpiresAt: singleToken.expiresAt.getTime(),
    batchTokenExpiresAt: batchToken.expiresAt.getTime(),
    batchExpiresAt: batch.expiresAt.getTime(),
  };
}

/**
 * Re-reads the database and asserts nothing moved. Deliberately a helper and
 * not inline expectations: the last test in this file feeds it a token it has
 * manually marked used, proving these assertions actually have teeth.
 */
async function expectNothingMutated(baseline: PurityBaseline): Promise<void> {
  const tokens = await prisma.holdPointReleaseToken.findMany({
    where: { holdPoint: { lotId } },
    orderBy: { createdAt: 'asc' },
  });
  expect(tokens).toHaveLength(2);
  for (const token of tokens) {
    // The single-use link is still unspent.
    expect(token.usedAt).toBeNull();
    expect(token.releasedByName).toBeNull();
    expect(token.releasedByOrg).toBeNull();
    expect(token.releaseSignatureUrl).toBeNull();
  }
  expect(tokens.find((token) => token.id === singleTokenId)!.expiresAt.getTime()).toBe(
    baseline.singleTokenExpiresAt,
  );
  expect(tokens.find((token) => token.id === batchTokenId)!.expiresAt.getTime()).toBe(
    baseline.batchTokenExpiresAt,
  );

  const batch = await prisma.holdPointReleaseBatch.findUniqueOrThrow({ where: { id: batchId } });
  expect(batch.expiresAt.getTime()).toBe(baseline.batchExpiresAt);

  // Nothing was released. (`hold_points` records the releaser as a free-text
  // name, not an id — there is no `releasedById` column on this model.)
  const holdPoints = await prisma.holdPoint.findMany({ where: { lotId } });
  expect(holdPoints).toHaveLength(2);
  for (const holdPoint of holdPoints) {
    expect(holdPoint.status).toBe('notified');
    expect(holdPoint.releasedAt).toBeNull();
    expect(holdPoint.releasedByName).toBeNull();
    expect(holdPoint.releaseMethod).toBeNull();
  }

  // No decision was recorded: no release audit row on either hold point, no
  // new audit row at all, and no readiness snapshot.
  const releaseAudits = await prisma.auditLog.findMany({
    where: {
      entityId: { in: [singleHoldPointId, batchHoldPointId] },
      action: { in: RELEASE_AUDIT_ACTIONS },
    },
  });
  expect(releaseAudits).toHaveLength(0);
  expect(await prisma.auditLog.count({ where: { projectId } })).toBe(baseline.auditCount);
  expect(await prisma.requirementEvaluation.count({ where: { projectId } })).toBe(
    baseline.decisionCount,
  );

  // And nobody was notified. The project has an active member, so a release
  // fan-out would have written a row here.
  expect(await prisma.notification.count({ where: { projectId } })).toBe(
    baseline.notificationCount,
  );
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const user = await prisma.user.create({
    data: {
      email: `${tag}@example.com`,
      fullName: 'Purity Requester',
      passwordHash: 'x',
      companyId,
    },
  });
  userId = user.id;

  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `P-${tag}`,
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;

  // A real project member, so "no notification was created" is a claim about
  // behaviour rather than about an empty recipient list.
  await prisma.projectUser.create({
    data: { projectId, userId, role: 'admin', status: 'active' },
  });

  const template = await prisma.iTPTemplate.create({
    data: { projectId, name: `Template ${tag}`, activityType: 'Earthworks' },
  });
  templateId = template.id;

  const singleItem = await prisma.iTPChecklistItem.create({
    data: {
      templateId,
      description: 'Single-link hold point',
      pointType: 'hold_point',
      sequenceNumber: 1,
    },
  });
  const batchItem = await prisma.iTPChecklistItem.create({
    data: {
      templateId,
      description: 'Batch hold point',
      pointType: 'hold_point',
      sequenceNumber: 2,
    },
  });

  const snapshotSource = await prisma.iTPTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
  });

  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-LOT`,
      status: 'in_progress',
      lotType: 'chainage',
      activityType: 'Earthworks',
    },
  });
  lotId = lot.id;

  const itpInstance = await prisma.iTPInstance.create({
    data: {
      templateId,
      lotId,
      templateSnapshot: JSON.stringify(buildTemplateSnapshot(snapshotSource)),
      status: 'in_progress',
    },
  });
  itpInstanceId = itpInstance.id;

  const singleCompletion = await prisma.iTPCompletion.create({
    data: { itpInstanceId, checklistItemId: singleItem.id, status: 'completed' },
  });
  const batchCompletion = await prisma.iTPCompletion.create({
    data: { itpInstanceId, checklistItemId: batchItem.id, status: 'completed' },
  });

  // One evidence file on local disk, attached to both completions, so both
  // document routes have a real 200 path.
  const filename = `${tag}-evidence.pdf`;
  const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
  documentFilePath = path.join(uploadDir, filename);
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(documentFilePath, Buffer.from('%PDF-1.4 get purity evidence'));
  const document = await prisma.document.create({
    data: {
      projectId,
      lotId,
      documentType: 'photo',
      category: 'itp_evidence',
      filename: 'get-purity-evidence.pdf',
      fileUrl: `/uploads/documents/${filename}`,
      mimeType: 'application/pdf',
    },
  });
  documentId = document.id;
  await prisma.iTPCompletionAttachment.createMany({
    data: [
      { completionId: singleCompletion.id, documentId },
      { completionId: batchCompletion.id, documentId },
    ],
  });

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const singleHoldPoint = await prisma.holdPoint.create({
    data: {
      lotId,
      itpChecklistItemId: singleItem.id,
      pointType: 'hold_point',
      description: 'Single-link hold point',
      status: 'notified',
    },
  });
  singleHoldPointId = singleHoldPoint.id;

  singleRawToken = `${tag}-single`;
  const singleToken = await prisma.holdPointReleaseToken.create({
    data: {
      holdPointId: singleHoldPointId,
      recipientEmail: `${tag}-super@example.com`,
      recipientName: 'Named Superintendent',
      token: hashToken(singleRawToken),
      expiresAt,
    },
  });
  singleTokenId = singleToken.id;

  const batchHoldPoint = await prisma.holdPoint.create({
    data: {
      lotId,
      itpChecklistItemId: batchItem.id,
      pointType: 'hold_point',
      description: 'Batch hold point',
      status: 'notified',
    },
  });
  batchHoldPointId = batchHoldPoint.id;

  batchRawToken = `${tag}-batch`;
  const batch = await prisma.holdPointReleaseBatch.create({
    data: {
      lotId,
      recipientEmail: `${tag}-super@example.com`,
      recipientName: 'Named Superintendent',
      token: hashToken(batchRawToken),
      expiresAt,
      requestedByUserId: userId,
    },
  });
  batchId = batch.id;

  const batchToken = await prisma.holdPointReleaseToken.create({
    data: {
      holdPointId: batchHoldPointId,
      batchId: batch.id,
      recipientEmail: `${tag}-super@example.com`,
      recipientName: 'Named Superintendent',
      token: hashToken(`${batchRawToken}-hp`),
      expiresAt,
    },
  });
  batchTokenId = batchToken.id;
});

afterAll(async () => {
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.holdPointReleaseToken.deleteMany({ where: { holdPoint: { lotId } } });
  await prisma.holdPointReleaseBatch.deleteMany({ where: { lotId } });
  await prisma.holdPoint.deleteMany({ where: { lotId } });
  await prisma.iTPCompletionAttachment.deleteMany({ where: { documentId } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId } });
  await prisma.document.deleteMany({ where: { id: documentId } });
  await prisma.iTPInstance.deleteMany({ where: { lotId } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  if (documentFilePath) {
    fs.rmSync(documentFilePath, { force: true });
  }
});

describe('AT-112 — public hold-point GET purity (`[E-B9]`, `[ER-A4]`)', () => {
  it('leaves the database untouched after repeated GET and HEAD on every public route', async () => {
    const baseline = await captureBaseline();
    const routes = publicGetPaths();
    expect(routes).toHaveLength(5);

    for (const route of routes) {
      // Three GETs — a forwarded link opened more than once — then a HEAD, the
      // shape a mail client or link scanner actually sends.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const res = await request(app).get(route.path);
        expect(
          res.status,
          `${route.label} attempt ${attempt + 1} must be a real 200, or this test is vacuous`,
        ).toBe(200);
      }

      const head = await request(app).head(route.path);
      expect(head.status, `${route.label} HEAD`).toBe(200);
    }

    await expectNothingMutated(baseline);
  });

  // A purity assertion that cannot fail is worse than none — it reads as
  // coverage. Each simulated regression below is what the corresponding
  // mutation would leave behind, applied directly and then rolled back.
  const simulatedRegressions: Array<{ name: string; apply: () => Promise<() => Promise<void>> }> = [
    {
      name: 'the secure link was spent',
      apply: async () => {
        await prisma.holdPointReleaseToken.update({
          where: { id: singleTokenId },
          data: { usedAt: new Date(), releasedByName: 'Named Superintendent' },
        });
        return async () => {
          await prisma.holdPointReleaseToken.update({
            where: { id: singleTokenId },
            data: { usedAt: null, releasedByName: null },
          });
        };
      },
    },
    {
      name: 'the hold point was released',
      apply: async () => {
        await prisma.holdPoint.update({
          where: { id: batchHoldPointId },
          data: {
            status: 'released',
            releasedAt: new Date(),
            releasedByName: 'Named Superintendent',
            releaseMethod: 'secure_link',
          },
        });
        return async () => {
          await prisma.holdPoint.update({
            where: { id: batchHoldPointId },
            data: {
              status: 'notified',
              releasedAt: null,
              releasedByName: null,
              releaseMethod: null,
            },
          });
        };
      },
    },
    {
      name: 'a release decision was audited',
      apply: async () => {
        const row = await prisma.auditLog.create({
          data: {
            projectId,
            entityType: 'hold_point',
            entityId: singleHoldPointId,
            action: AuditAction.HP_PUBLIC_RELEASED,
          },
        });
        return async () => {
          await prisma.auditLog.delete({ where: { id: row.id } });
        };
      },
    },
    {
      name: 'the project team was notified',
      apply: async () => {
        const row = await prisma.notification.create({
          data: {
            userId,
            projectId,
            type: 'hold_point_release',
            title: 'Hold Point Released',
            message: 'Simulated release fan-out',
          },
        });
        return async () => {
          await prisma.notification.delete({ where: { id: row.id } });
        };
      },
    },
  ];

  it.each(simulatedRegressions)(
    'catches the regression where $name (the assertions have teeth)',
    async ({ apply }) => {
      const baseline = await captureBaseline();
      await expectNothingMutated(baseline);

      const restore = await apply();
      try {
        await expect(expectNothingMutated(baseline)).rejects.toThrow();
      } finally {
        await restore();
      }

      await expectNothingMutated(baseline);
    },
  );
});
