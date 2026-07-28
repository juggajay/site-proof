/**
 * H1 (fable deep review 2026-07-28) — the project-overview attention feed filled
 * ONE key (`daysOverdue`) two ways: NCR rows through the shared floor helper
 * `daysOverdue()`, hold-point rows through `Math.ceil` on age-since-created.
 * `ProjectDashboard.tsx` renders both through a single line, so a hold point and
 * an NCR of identical elapsed span printed different numbers side by side.
 *
 * The fixture pins both rows to the SAME instant; the assertion is that they
 * print the same number, and that the number is full days elapsed (floor).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

import { projectsRouter } from '../projects.js';
import { authRouter } from '../auth.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use(errorHandler);

const HOUR_MS = 60 * 60 * 1000;

// The route anchors both ages on LOCAL midnight (`today.setHours(0,0,0,0)`), so
// the fixture does too. 8 days + 5 hours before that midnight is 8 FULL days
// elapsed — and 9 under the old `Math.ceil`, which is the off-by-one this pins.
function midnightToday(): Date {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

describe('GET /api/projects/:id/dashboard — one rounding rule for attention ages', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let lotId: string;
  let templateId: string;
  let checklistItemId: string;
  let holdPointId: string;
  let ncrId: string;

  beforeAll(async () => {
    const anchor = new Date(midnightToday().getTime() - (8 * 24 + 5) * HOUR_MS);

    const company = await prisma.company.create({
      data: { name: `Overview Ages Company ${Date.now()}` },
    });
    companyId = company.id;

    const user = await registerTestUser(app, {
      emailPrefix: 'overview-ages',
      fullName: 'Overview Ages User',
      companyId,
      roleInCompany: 'admin',
    });
    authToken = user.token;
    userId = user.userId;

    const project = await prisma.project.create({
      data: {
        name: 'Overview Ages Project',
        projectNumber: `OVA-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;
    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'LOT-OVA-1',
        lotType: 'general',
        activityType: 'earthworks',
        status: 'in_progress',
      },
    });
    lotId = lot.id;

    const template = await prisma.iTPTemplate.create({
      data: { projectId, name: 'Overview Ages ITP', activityType: 'earthworks' },
    });
    templateId = template.id;

    const checklistItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId,
        sequenceNumber: 1,
        description: 'Subgrade proof roll',
        pointType: 'hold_point',
      },
    });
    checklistItemId = checklistItem.id;

    const holdPoint = await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        description: 'Subgrade proof roll',
        status: 'pending',
        createdAt: anchor,
      },
    });
    holdPointId = holdPoint.id;

    const ncr = await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: `NCR-OVA-${Date.now()}`,
        description: 'Kerb out of tolerance',
        category: 'minor',
        severity: 'minor',
        status: 'open',
        // Same instant as the hold point's createdAt: identical elapsed span.
        dueDate: anchor,
      },
    });
    ncrId = ncr.id;
  });

  afterAll(async () => {
    await prisma.holdPoint.deleteMany({ where: { id: holdPointId } });
    await prisma.iTPChecklistItem.deleteMany({ where: { id: checklistItemId } });
    await prisma.iTPTemplate.deleteMany({ where: { id: templateId } });
    await prisma.nCR.deleteMany({ where: { id: ncrId } });
    await prisma.lot.deleteMany({ where: { id: lotId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('prints the same day count for a hold point and an NCR of identical span', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/dashboard`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const items: Array<{ id: string; type: string; daysOverdue: number; link: string }> =
      res.body.attentionItems;
    const ncrRow = items.find((item) => item.id === `ncr-${ncrId}`);
    const holdPointRow = items.find((item) => item.id === `hp-${holdPointId}`);

    expect(ncrRow).toBeDefined();
    expect(holdPointRow).toBeDefined();
    // One fact, one number — the whole point of the shared helper.
    expect(holdPointRow!.daysOverdue).toBe(ncrRow!.daysOverdue);
    // FULL days elapsed since the shared anchor. `Math.ceil` said 9 here.
    expect(holdPointRow!.daysOverdue).toBe(8);
  });
});
