import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { copilotRouter } from './index.js';
import {
  applyHandlers,
  createProposal,
  rollbackHandlers,
  type AppliedRecordGroup,
} from './proposalService.js';

// Executor PRs register real handlers; this PR ships none, so the test registers
// a marker stage to exercise apply/rollback wiring and status transitions.
const HANDLED_STAGE = 'copilot_test_stage';
const APPLIED: AppliedRecordGroup[] = [{ model: 'lot', ids: ['seed-1', 'seed-2'] }];
let rolledBackWith: AppliedRecordGroup[] | null = null;

applyHandlers[HANDLED_STAGE] = async () => APPLIED;
rollbackHandlers[HANDLED_STAGE] = async (_tx, _proposal, applied) => {
  rolledBackWith = applied;
};

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', copilotRouter);
app.use(errorHandler);

async function seedProposal(
  projectId: string,
  requestedById: string,
  stage: string,
  payload: unknown,
) {
  return createProposal({
    projectId,
    stage,
    requestedById,
    model: 'claude-sonnet-5',
    sourceRefs: [{ fileName: 'setout.pdf', page: 1 }],
    payload,
  });
}

describe('Copilot proposals API', () => {
  let companyId: string;
  let otherCompanyId: string;
  let pmToken: string;
  let pmUserId: string;
  let viewerToken: string;
  let subbieToken: string;
  let outsiderToken: string;
  let projectId: string;
  let otherProjectId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `Cop Co ${stamp}` } })).id;
    otherCompanyId = (await prisma.company.create({ data: { name: `Cop Other ${stamp}` } })).id;

    const pm = await registerTestUser(app, {
      emailPrefix: 'cop-pm',
      fullName: 'Cop PM',
      companyId,
      roleInCompany: 'project_manager',
    });
    pmToken = pm.token;
    pmUserId = pm.userId;

    const viewer = await registerTestUser(app, {
      emailPrefix: 'cop-viewer',
      fullName: 'Cop Viewer',
      companyId,
      roleInCompany: 'viewer',
    });
    viewerToken = viewer.token;

    const subbie = await registerTestUser(app, {
      emailPrefix: 'cop-subbie',
      fullName: 'Cop Subbie',
      companyId,
      roleInCompany: 'subcontractor',
    });
    subbieToken = subbie.token;

    const outsider = await registerTestUser(app, {
      emailPrefix: 'cop-outsider',
      fullName: 'Cop Outsider',
      companyId: otherCompanyId,
      roleInCompany: 'project_manager',
    });
    outsiderToken = outsider.token;

    const project = await prisma.project.create({
      data: {
        name: `Cop Project ${stamp}`,
        projectNumber: `COP-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    const other = await prisma.project.create({
      data: {
        name: `Cop Other Project ${stamp}`,
        projectNumber: `COPO-${stamp}`,
        companyId: otherCompanyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    otherProjectId = other.id;

    await prisma.projectUser.create({
      data: { projectId, userId: pm.userId, role: 'project_manager', status: 'active' },
    });
    await prisma.projectUser.create({
      data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
    });
    await prisma.projectUser.create({
      data: { projectId, userId: subbie.userId, role: 'subcontractor', status: 'active' },
    });
    await prisma.projectUser.create({
      data: {
        projectId: otherProjectId,
        userId: outsider.userId,
        role: 'project_manager',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    await prisma.aiProposal.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    });
    await prisma.projectUser.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
    delete applyHandlers[HANDLED_STAGE];
    delete rollbackHandlers[HANDLED_STAGE];
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/copilot/proposals`);
    expect(res.status).toBe(401);
  });

  it('rejects a cross-company non-member with 403', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/copilot/proposals`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it('denies subcontractor reads (copilot is internal setup)', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/copilot/proposals`)
      .set('Authorization', `Bearer ${subbieToken}`);
    expect(res.status).toBe(403);
  });

  it('creates a proposal and supersedes the prior live one for the same stage', async () => {
    const first = await seedProposal(projectId, pmUserId, 'project_facts', { name: 'v1' });
    const second = await seedProposal(projectId, pmUserId, 'project_facts', { name: 'v2' });

    const refetchedFirst = await prisma.aiProposal.findUnique({ where: { id: first.id } });
    expect(refetchedFirst?.status).toBe('superseded');
    expect(second.status).toBe('proposed');

    // A different stage is untouched by the supersede.
    const otherStage = await seedProposal(projectId, pmUserId, 'plan_sheets', { sheets: 3 });
    expect(otherStage.status).toBe('proposed');
    expect((await prisma.aiProposal.findUnique({ where: { id: second.id } }))?.status).toBe(
      'proposed',
    );
  });

  it('lists newest-first and fetches a single proposal', async () => {
    const listRes = await request(app)
      .get(`/api/projects/${projectId}/copilot/proposals?stage=project_facts`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.proposals.length).toBeGreaterThanOrEqual(2);
    expect(listRes.body.proposals[0].createdAt >= listRes.body.proposals[1].createdAt).toBe(true);

    const one = listRes.body.proposals[0];
    const getRes = await request(app)
      .get(`/api/projects/${projectId}/copilot/proposals/${one.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.proposal.id).toBe(one.id);
  });

  it('isolates proposals across projects (404 via the wrong project path)', async () => {
    const foreign = await seedProposal(otherProjectId, pmUserId, 'project_facts', { x: 1 });

    // outsider owns otherProject; reach the foreign proposal through THIS project's path.
    const getRes = await request(app)
      .get(`/api/projects/${projectId}/copilot/proposals/${foreign.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(getRes.status).toBe(404);

    const decideRes = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${foreign.id}/decision`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ action: 'reject' });
    expect(decideRes.status).toBe(404);

    const rollbackRes = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${foreign.id}/rollback`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(rollbackRes.status).toBe(404);
  });

  it('denies decisions to a read-only member', async () => {
    const proposal = await seedProposal(projectId, pmUserId, 'lot_breakdown', { lots: 1 });
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposal.id}/decision`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ action: 'reject' });
    expect(res.status).toBe(403);
  });

  it('rejects a proposal and blocks a second decision', async () => {
    const proposal = await seedProposal(projectId, pmUserId, 'lot_breakdown', { lots: 2 });
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposal.id}/decision`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ action: 'reject' });
    expect(res.status).toBe(200);
    expect(res.body.proposal.status).toBe('rejected');
    expect(res.body.proposal.decidedById).toBe(pmUserId);

    const again = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposal.id}/decision`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ action: 'accept' });
    expect(again.status).toBe(400);
  });

  it('returns 400 when accepting a stage with no apply handler', async () => {
    const proposal = await seedProposal(projectId, pmUserId, 'plan_sheets', { sheets: 2 });
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposal.id}/decision`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ action: 'accept' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('No apply handler');
  });

  it('rejects editedPayload sent with a reject action', async () => {
    const proposal = await seedProposal(projectId, pmUserId, HANDLED_STAGE, { a: 1 });
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposal.id}/decision`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ action: 'reject', editedPayload: { a: 9 } });
    expect(res.status).toBe(400);
  });

  it('accepts, applies the handler, and rolls back — payload stays immutable', async () => {
    const proposal = await seedProposal(projectId, pmUserId, HANDLED_STAGE, { a: 1 });

    // accept-with-edits: status 'edited', editedPayload stored, payload untouched.
    const acceptRes = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposal.id}/decision`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ action: 'accept', editedPayload: { a: 2 } });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.proposal.status).toBe('edited');
    expect(acceptRes.body.proposal.editedPayload).toEqual({ a: 2 });
    expect(acceptRes.body.proposal.payload).toEqual({ a: 1 });
    expect(acceptRes.body.proposal.appliedRecordIds).toEqual(APPLIED);

    const stored = await prisma.aiProposal.findUnique({ where: { id: proposal.id } });
    expect(stored?.payload).toEqual({ a: 1 });

    // rollback: handler receives the applied records, status becomes 'rolled_back'.
    rolledBackWith = null;
    const rollbackRes = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposal.id}/rollback`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(rollbackRes.status).toBe(200);
    expect(rollbackRes.body.proposal.status).toBe('rolled_back');
    expect(rolledBackWith).toEqual(APPLIED);
  });

  it('blocks rollback of a non-applied proposal', async () => {
    const proposal = await seedProposal(projectId, pmUserId, HANDLED_STAGE, { a: 1 });
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposal.id}/rollback`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Only applied proposals');
  });

  it('accepts without edits — status accepted, payload applied verbatim', async () => {
    const proposal = await seedProposal(projectId, pmUserId, HANDLED_STAGE, { a: 5 });
    const res = await request(app)
      .post(`/api/projects/${projectId}/copilot/proposals/${proposal.id}/decision`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ action: 'accept' });
    expect(res.status).toBe(200);
    expect(res.body.proposal.status).toBe('accepted');
    expect(res.body.proposal.editedPayload).toBeNull();
    expect(res.body.proposal.appliedRecordIds).toEqual(APPLIED);
  });
});
