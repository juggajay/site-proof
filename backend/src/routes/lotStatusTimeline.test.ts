import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';
import { authRouter } from './auth.js';
import { lotStatusTimelineRouter } from './lotStatusTimeline.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', lotStatusTimelineRouter);
app.use(errorHandler);

describe('GET /api/projects/:projectId/lots/status-timeline', () => {
  let companyId: string;
  let otherCompanyId: string;
  let pmToken: string;
  let subbieToken: string;
  let outsiderToken: string;
  let projectId: string;
  let assignedLotId: string;
  let unassignedLotId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `ST Co ${stamp}` } })).id;
    otherCompanyId = (await prisma.company.create({ data: { name: `ST Other ${stamp}` } })).id;

    const pm = await registerTestUser(app, {
      emailPrefix: 'st-pm',
      fullName: 'ST PM',
      companyId,
      roleInCompany: 'project_manager',
    });
    pmToken = pm.token;

    const outsider = await registerTestUser(app, {
      emailPrefix: 'st-outsider',
      fullName: 'ST Outsider',
      companyId: otherCompanyId,
      roleInCompany: 'project_manager',
    });
    outsiderToken = outsider.token;

    const project = await prisma.project.create({
      data: {
        name: `ST Project ${stamp}`,
        projectNumber: `ST-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId: pm.userId, role: 'project_manager', status: 'active' },
    });

    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `ST Subbie ${stamp}`,
        primaryContactName: 'ST Subbie',
        primaryContactEmail: `st-subbie-${stamp}@example.com`,
        status: 'approved',
        portalAccess: { lots: true },
      },
    });

    const subbie = await registerTestUser(app, {
      emailPrefix: 'st-subbie-user',
      fullName: 'ST Subbie User',
      companyId,
      roleInCompany: 'subcontractor',
    });
    subbieToken = subbie.token;
    await prisma.user.update({
      where: { id: subbie.userId },
      data: { companyId: null, roleInCompany: 'subcontractor' },
    });
    await prisma.subcontractorUser.create({
      data: {
        userId: subbie.userId,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'user',
      },
    });

    const assignedLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ST-ASSIGNED-${stamp}`,
        status: 'completed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        assignedSubcontractorId: subcontractorCompany.id,
        createdAt: new Date('2026-01-10T00:00:00Z'),
      },
    });
    assignedLotId = assignedLot.id;

    const unassignedLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ST-UNASSIGNED-${stamp}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Drainage',
        createdAt: new Date('2026-02-01T00:00:00Z'),
      },
    });
    unassignedLotId = unassignedLot.id;

    // Status history for the assigned lot; a non-status lot row that must be ignored.
    await prisma.auditLog.createMany({
      data: [
        {
          projectId,
          entityType: 'lot',
          entityId: assignedLotId,
          action: 'lot_status_changed',
          changes: JSON.stringify({ status: { from: 'not_started', to: 'in_progress' } }),
          createdAt: new Date('2026-01-15T00:00:00Z'),
        },
        {
          projectId,
          entityType: 'lot',
          entityId: assignedLotId,
          action: 'lot_updated',
          changes: JSON.stringify({ status: { from: 'in_progress', to: 'completed' } }),
          createdAt: new Date('2026-03-01T00:00:00Z'),
        },
        {
          projectId,
          entityType: 'lot',
          entityId: assignedLotId,
          action: 'lot_subcontractor_assignment_updated',
          changes: JSON.stringify({ status: { from: 'pending', to: 'active' } }),
          createdAt: new Date('2026-02-20T00:00:00Z'),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { projectId } });
    await prisma.lotSubcontractorAssignment.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompany: { projectId } } });
    await prisma.subcontractorCompany.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/lots/status-timeline`);
    expect(res.status).toBe(401);
  });

  it('rejects a cross-company non-member with 403', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/lots/status-timeline`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it('returns per-lot status events and the earliest instant for an internal member', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/lots/status-timeline`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(res.status).toBe(200);
    // Earliest = earliest lot createdAt (assigned lot, 2026-01-10).
    expect(res.body.earliest).toBe('2026-01-10T00:00:00.000Z');

    const assigned = res.body.lots.find((l: { lotId: string }) => l.lotId === assignedLotId);
    expect(assigned.currentStatus).toBe('completed');
    // Only the two lot-status rows — the assignment row is excluded.
    expect(assigned.events).toEqual([
      { at: '2026-01-15T00:00:00.000Z', from: 'not_started', to: 'in_progress' },
      { at: '2026-03-01T00:00:00.000Z', from: 'in_progress', to: 'completed' },
    ]);

    const unassigned = res.body.lots.find((l: { lotId: string }) => l.lotId === unassignedLotId);
    expect(unassigned.events).toEqual([]);
  });

  it('scopes a subcontractor to lots assigned to their company', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/lots/status-timeline`)
      .set('Authorization', `Bearer ${subbieToken}`);
    expect(res.status).toBe(200);
    expect(res.body.lots).toHaveLength(1);
    expect(res.body.lots[0].lotId).toBe(assignedLotId);
  });
});
