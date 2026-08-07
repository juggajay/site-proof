/**
 * Wave G G5 — the review surface's backend guarantees, DB-backed.
 *
 * Every case here is one an in-memory mock cannot prove, because each depends
 * on real transaction semantics or a real relation:
 *
 *  - a second decision on an already-decided proposal is refused AND leaves no
 *    second template revision behind (the guard that used to sit outside the
 *    transaction)
 *  - a proposal naming a library template is refused at CREATE, not weeks later
 *  - the list reports the unbounded `total` beside its capped page
 *  - the list is office-only: a foreman who can legitimately read templates
 *    cannot read the failure trend behind them
 *  - editing a template through the update route preserves each row's
 *    `sourceChecklistItemId` — the loop-breaker, since editing the new revision
 *    is a MANDATORY step after accepting a proposal
 */

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';
import { authRouter } from './auth.js';
import { itpRouter } from './itp/index.js';
import { ncrLearningRouter } from './ncrLearning.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/itp', itpRouter);
app.use('/api/ncr-learning', ncrLearningRouter);
app.use(errorHandler);

const tag = `g5r-${Date.now()}`;

describe('Wave G G5 — proposal decisions, listing and lineage', () => {
  let companyId: string;
  let projectId: string;
  let adminId: string;
  let adminToken: string;
  let foremanToken: string;
  let templateId: string;
  let globalTemplateId: string;
  let checklistItemId: string;

  beforeAll(async () => {
    process.env.NCR_LEARNING_LOOP_ENABLED = 'true';

    const company = await prisma.company.create({ data: { name: `G5R Co ${tag}` } });
    companyId = company.id;

    const admin = await registerTestUser(app, {
      emailPrefix: `g5r-admin-${tag}`,
      fullName: 'G5R Admin',
      companyId,
      roleInCompany: 'admin',
    });
    adminToken = admin.token;
    adminId = admin.userId;

    const foreman = await registerTestUser(app, {
      emailPrefix: `g5r-foreman-${tag}`,
      fullName: 'G5R Foreman',
      companyId,
      roleInCompany: 'member',
    });
    foremanToken = foreman.token;

    const project = await prisma.project.create({
      data: {
        name: `G5R Project ${tag}`,
        projectNumber: `G5R-${tag}`,
        companyId,
        status: 'active',
        state: 'QLD',
        specificationSet: 'TMR',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId: adminId, role: 'admin', status: 'active' },
    });
    // A real project member whose role is NOT in the office set. This is the
    // shape the gate exists for: the ITP Templates page renders for them.
    await prisma.projectUser.create({
      data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
    });

    // A library template — projectId null is what makes it the shared library.
    const globalTemplate = await prisma.iTPTemplate.create({
      data: {
        projectId: null,
        name: `G5R Library Earthworks ${tag}`,
        activityType: 'earthworks_general',
        checklistItems: {
          create: [{ sequenceNumber: 1, description: 'Library compaction check' }],
        },
      },
    });
    globalTemplateId = globalTemplate.id;
  });

  afterAll(async () => {
    delete process.env.NCR_LEARNING_LOOP_ENABLED;
  });

  // A fresh project template per test: accept SUPERSEDES the template, so tests
  // sharing one would order-depend on each other.
  beforeEach(async () => {
    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: `G5R Earthworks ${tag}-${Math.random().toString(36).slice(2, 8)}`,
        activityType: 'earthworks_general',
        checklistItems: {
          create: [
            { sequenceNumber: 1, description: 'Compaction density per layer' },
            { sequenceNumber: 2, description: 'Moisture content within range' },
          ],
        },
      },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
    });
    templateId = template.id;
    checklistItemId = template.checklistItems[0].id;
  });

  async function createProposal(target: { templateId?: string; checklistItemId?: string }) {
    const res = await request(app)
      .post('/api/ncr-learning/proposals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ projectId, ...target, proposedChange: 'Require a density reading per 300mm layer.' });
    return res;
  }

  it('refuses a second decision and leaves no second revision behind', async () => {
    const created = await createProposal({ checklistItemId });
    expect(created.status).toBe(201);
    const proposalId = created.body.proposal.id as string;

    const accept = await request(app)
      .post(`/api/ncr-learning/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ revisionLabel: 'B', changeSummary: 'Density per layer, not per lot.' });
    expect(accept.status).toBe(201);
    const revisionId = accept.body.revision.id as string;

    // The same proposal decided again — the case two reviewers hitting Accept
    // together produce, with the second arriving after the first committed.
    const second = await request(app)
      .post(`/api/ncr-learning/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ revisionLabel: 'C', changeSummary: 'A competing second revision.' });
    expect(second.status).toBe(400);
    expect(second.body.error.details.code).toBe('PROPOSAL_ALREADY_DECIDED');

    // The real assertion: no orphan. Exactly one successor exists, the source
    // points at it, and the 'C' revision was never created.
    const successors = await prisma.iTPTemplate.findMany({
      where: { sourceTemplateId: templateId },
      select: { id: true, name: true },
    });
    expect(successors).toHaveLength(1);
    expect(successors[0].id).toBe(revisionId);
    expect(successors[0].name).not.toContain('(C)');

    const source = await prisma.iTPTemplate.findUniqueOrThrow({
      where: { id: templateId },
      select: { supersededById: true, isActive: true },
    });
    expect(source.supersededById).toBe(revisionId);
    expect(source.isActive).toBe(false);

    // And the decision recorded is still the FIRST one.
    const decided = await prisma.templateRevisionProposal.findUniqueOrThrow({
      where: { id: proposalId },
      select: { status: true, decisionNote: true, resultingTemplateId: true },
    });
    expect(decided.status).toBe('accepted');
    expect(decided.decisionNote).toContain('Density per layer');
    expect(decided.resultingTemplateId).toBe(revisionId);
  });

  it('refuses a reject that races a completed accept', async () => {
    const created = await createProposal({ checklistItemId });
    const proposalId = created.body.proposal.id as string;

    await request(app)
      .post(`/api/ncr-learning/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ revisionLabel: 'B', changeSummary: 'Accepted first.' });

    const reject = await request(app)
      .post(`/api/ncr-learning/proposals/${proposalId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decisionNote: 'Too late.' });
    expect(reject.status).toBe(400);
    expect(reject.body.error.details.code).toBe('PROPOSAL_ALREADY_DECIDED');

    // A rejected proposal still pointing at a live successor template is the
    // corruption this guard exists to prevent.
    const after = await prisma.templateRevisionProposal.findUniqueOrThrow({
      where: { id: proposalId },
      select: { status: true, resultingTemplateId: true },
    });
    expect(after.status).toBe('accepted');
    expect(after.resultingTemplateId).not.toBeNull();
  });

  it('refuses a proposal against a library template at create time', async () => {
    const res = await createProposal({ templateId: globalTemplateId });

    expect(res.status).toBe(400);
    expect(res.body.error.details.code).toBe('GLOBAL_TEMPLATE_NOT_ISSUABLE');
    // The reviewer is told what to do, not how the seeder works.
    expect(res.body.error.message).toContain('clone it into the project first');
    expect(res.body.error.message).not.toContain('--execute');

    // Nothing entered the queue.
    const rows = await prisma.templateRevisionProposal.count({
      where: { projectId, templateId: globalTemplateId },
    });
    expect(rows).toBe(0);
  });

  it('returns the unbounded total beside the capped page', async () => {
    await createProposal({ checklistItemId });
    await createProposal({ checklistItemId });

    const res = await request(app)
      .get(`/api/ncr-learning/proposals?projectId=${projectId}&status=open`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    // `total` counts the same filtered set, so it can never be under the page.
    expect(res.body.total).toBeGreaterThanOrEqual(res.body.proposals.length);
    expect(res.body.total).toBe(
      await prisma.templateRevisionProposal.count({ where: { projectId, status: 'open' } }),
    );
  });

  it('keeps the proposal list off a foreman who can still read templates', async () => {
    // Not a permission technicality — the foreman really is on this project and
    // the page hosting this list renders for them.
    const templates = await request(app)
      .get(`/api/itp/templates?projectId=${projectId}`)
      .set('Authorization', `Bearer ${foremanToken}`);
    expect(templates.status).toBe(200);

    const res = await request(app)
      .get(`/api/ncr-learning/proposals?projectId=${projectId}`)
      .set('Authorization', `Bearer ${foremanToken}`);
    expect(res.status).toBe(403);
  });

  it('preserves checklist lineage when the accepted revision is edited', async () => {
    const created = await createProposal({ checklistItemId });
    const proposalId = created.body.proposal.id as string;

    const accept = await request(app)
      .post(`/api/ncr-learning/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ revisionLabel: 'B', changeSummary: 'Density per layer.' });
    expect(accept.status).toBe(201);
    const revisionId = accept.body.revision.id as string;

    // Accept clones with lineage intact; that half already worked.
    const cloned = await prisma.iTPChecklistItem.findMany({
      where: { templateId: revisionId },
      orderBy: { sequenceNumber: 'asc' },
      select: { id: true, description: true, sourceChecklistItemId: true },
    });
    expect(cloned.map((item) => item.sourceChecklistItemId)).toEqual([
      checklistItemId,
      expect.any(String),
    ]);

    // Now the step that used to break it: editing the new revision — which the
    // reviewer MUST do, since accept only produces an unchanged copy.
    const edit = await request(app)
      .patch(`/api/itp/templates/${revisionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Revised ${tag}`,
        checklistItems: [
          {
            id: cloned[0].id,
            description: 'Compaction density per 300mm layer',
            responsibleParty: 'contractor',
          },
          { id: cloned[1].id, description: cloned[1].description },
          // A genuinely new row, and a foreign id that must contribute nothing.
          { description: 'Proof roll witnessed', id: checklistItemId },
        ],
      });
    expect(edit.status).toBe(200);

    const afterEdit = await prisma.iTPChecklistItem.findMany({
      where: { templateId: revisionId },
      orderBy: { sequenceNumber: 'asc' },
      select: { description: true, sourceChecklistItemId: true },
    });

    // Row 1 was edited and row 2 untouched; both keep pointing at the items they
    // descend from, so an NCR raised against either still aggregates with the
    // failures that justified this revision.
    expect(afterEdit[0].description).toBe('Compaction density per 300mm layer');
    expect(afterEdit[0].sourceChecklistItemId).toBe(cloned[0].sourceChecklistItemId);
    expect(afterEdit[1].sourceChecklistItemId).toBe(cloned[1].sourceChecklistItemId);
    // The foreign id belongs to another template, so it is not a lineage source
    // here — the row is created as genuinely new.
    expect(afterEdit[2].description).toBe('Proof roll witnessed');
    expect(afterEdit[2].sourceChecklistItemId).toBeNull();
  });
});
