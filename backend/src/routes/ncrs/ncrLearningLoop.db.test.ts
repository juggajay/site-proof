/**
 * Wave G G5 §5.4 — the DB-backed acceptance tests.
 *
 * AT-G26 the analytics endpoint returns root cause, repeat issues and repeat
 *        offenders WITH subcontractor names (the shipped shape returned bare ids)
 * AT-G27 an off-vocabulary category is rejected 400 server-side; a pre-existing
 *        free-text value still reads and aggregates into "other"
 * AT-G28 NCRs on a lot with a null `activitySlug` land in an explicit
 *        "activity not classified" bucket rather than being dropped
 * AT-G29 an NCR auto-created from a failed ITP item carries
 *        `itpChecklistItemId`, resolvable to its template
 * AT-G30 a recurring-failure trend produces a proposal record, and accepting it
 *        creates a NEW template revision — never an in-place edit
 * AT-G31 tenant isolation: project B's NCRs never appear in project A's trends
 *
 * Plus the two non-AT obligations the spec names for this increment:
 * [GR-N4] `repeatOffenders` is capped, and §7 row 7's office-role gate.
 *
 * DB-backed on purpose: the aggregation is now SQL (`groupBy` plus three
 * parameterised raw queries), so a mocked Prisma would assert nothing about the
 * thing that changed. `src/test/databaseSafety.ts` keeps this on the local
 * disposable database.
 */

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { itpRouter } from '../itp/index.js';
import { ncrLearningRouter } from '../ncrLearning.js';
import { ncrsRouter } from './index.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/ncrs', ncrsRouter);
app.use('/api/itp', itpRouter);
app.use('/api/ncr-learning', ncrLearningRouter);
app.use(errorHandler);

const tag = `g5-${Date.now()}`;

let companyId: string;
let otherCompanyId: string;
let projectId: string;
let otherProjectId: string;
let qmToken: string;
let qmUserId: string;
let foremanToken: string;
let masterTemplateId: string;
let masterItemId: string;
let copyItemId: string;
let classifiedLotId: string;
let unclassifiedLotId: string;
let subcontractorAId: string;

let ncrSequence = 0;
function nextNcrNumber(): string {
  ncrSequence += 1;
  return `NCR-${tag}-${String(ncrSequence).padStart(4, '0')}`;
}

async function createNcr(overrides: {
  projectId?: string;
  category?: string;
  rootCauseCategory?: string | null;
  responsibleSubcontractorId?: string | null;
  itpChecklistItemId?: string | null;
  lotId?: string | null;
  status?: string;
}) {
  return prisma.nCR.create({
    data: {
      projectId: overrides.projectId ?? projectId,
      ncrNumber: nextNcrNumber(),
      description: 'G5 fixture NCR',
      category: overrides.category ?? 'workmanship',
      severity: 'minor',
      status: overrides.status ?? 'open',
      raisedById: qmUserId,
      rootCauseCategory: overrides.rootCauseCategory ?? null,
      responsibleSubcontractorId: overrides.responsibleSubcontractorId ?? null,
      itpChecklistItemId: overrides.itpChecklistItemId ?? null,
      ...(overrides.lotId ? { ncrLots: { create: [{ lotId: overrides.lotId }] } } : {}),
    },
  });
}

async function analytics(token = qmToken, target = projectId) {
  return request(app).get(`/api/ncrs/analytics/${target}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  process.env.NCR_LEARNING_LOOP_ENABLED = 'true';

  const company = await prisma.company.create({ data: { name: `G5 Co ${tag}` } });
  companyId = company.id;
  const otherCompany = await prisma.company.create({ data: { name: `G5 Other Co ${tag}` } });
  otherCompanyId = otherCompany.id;

  const qm = await registerTestUser(app, {
    emailPrefix: `g5-qm-${tag}`,
    fullName: 'G5 Quality Manager',
    companyId,
    roleInCompany: 'member',
  });
  qmToken = qm.token;
  qmUserId = qm.userId;

  const foreman = await registerTestUser(app, {
    emailPrefix: `g5-foreman-${tag}`,
    fullName: 'G5 Foreman',
    companyId,
    roleInCompany: 'member',
  });
  foremanToken = foreman.token;

  const project = await prisma.project.create({
    data: {
      name: `G5 Project ${tag}`,
      projectNumber: `G5-${tag}`,
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;

  const otherProject = await prisma.project.create({
    data: {
      name: `G5 Other Project ${tag}`,
      projectNumber: `G5O-${tag}`,
      companyId: otherCompanyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  otherProjectId = otherProject.id;

  await prisma.projectUser.createMany({
    data: [
      { projectId, userId: qmUserId, role: 'quality_manager', status: 'active' },
      { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
    ],
  });

  // A corporate master and a controlled copy of it INSIDE the same project.
  // Item lineage is what makes the two count as one requirement (§2.2(c)).
  const master = await prisma.iTPTemplate.create({
    data: {
      projectId,
      name: `G5 Master ${tag}`,
      activityType: 'earthworks_general',
      checklistItems: {
        create: [
          { sequenceNumber: 1, description: 'Compaction test at 300mm layers' },
          { sequenceNumber: 2, description: 'Survey conformance' },
        ],
      },
    },
    include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
  });
  masterTemplateId = master.id;
  masterItemId = master.checklistItems[0].id;

  const copy = await prisma.iTPTemplate.create({
    data: {
      projectId,
      name: `G5 Master ${tag} (Copy)`,
      activityType: 'earthworks_general',
      sourceTemplateId: master.id,
      checklistItems: {
        create: [
          {
            sequenceNumber: 1,
            description: 'Compaction test at 300mm layers',
            sourceChecklistItemId: master.checklistItems[0].id,
          },
        ],
      },
    },
    include: { checklistItems: true },
  });
  copyItemId = copy.checklistItems[0].id;

  const classifiedLot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `G5-L1-${tag}`,
      lotType: 'standard',
      activityType: 'Earthworks',
      activitySlug: 'earthworks_general',
      status: 'in_progress',
    },
  });
  classifiedLotId = classifiedLot.id;

  const unclassifiedLot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `G5-L2-${tag}`,
      lotType: 'standard',
      activityType: 'Something the fold only resolved to family level',
      activitySlug: null,
      status: 'in_progress',
    },
  });
  unclassifiedLotId = unclassifiedLot.id;

  const subA = await prisma.subcontractorCompany.create({
    data: {
      projectId,
      companyName: `Acme Civil ${tag}`,
      primaryContactName: 'A Contact',
      primaryContactEmail: `acme-${tag}@example.com`,
      status: 'approved',
    },
  });
  subcontractorAId = subA.id;
});

afterAll(async () => {
  delete process.env.NCR_LEARNING_LOOP_ENABLED;
  const projectIds = [projectId, otherProjectId].filter(Boolean);
  if (projectIds.length === 0) return;
  await prisma.templateRevisionProposal.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.revisionIssue.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.nCR.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId: { in: projectIds } } } });
  await prisma.lot.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.iTPTemplate.updateMany({
    where: { projectId: { in: projectIds } },
    data: { supersededById: null },
  });
  await prisma.iTPTemplate.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.subcontractorCompany.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.projectUser.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.user.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
  await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
});

describe('Wave G G5 — management learning loop', () => {
  // ----------------------------------------------------------------- AT-G26

  it('AT-G26 returns root cause, repeat issues and NAMED repeat offenders', async () => {
    const created = await Promise.all([
      createNcr({
        category: 'materials',
        rootCauseCategory: 'process',
        responsibleSubcontractorId: subcontractorAId,
        lotId: classifiedLotId,
      }),
      createNcr({
        category: 'materials',
        rootCauseCategory: 'process',
        responsibleSubcontractorId: subcontractorAId,
        lotId: classifiedLotId,
      }),
      createNcr({ category: 'design', rootCauseCategory: 'training' }),
    ]);

    try {
      const res = await analytics();
      expect(res.status).toBe(200);

      expect(res.body.charts.rootCause.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ key: 'process', name: 'Process' })]),
      );

      const repeat = res.body.repeatIssues.data.find(
        (issue: { category: string; rootCause: string }) =>
          issue.category === 'materials' && issue.rootCause === 'process',
      );
      expect(repeat).toMatchObject({ count: 2, categoryLabel: 'Materials' });

      const offender = res.body.repeatOffenders.data.find(
        (entry: { subcontractorId: string }) => entry.subcontractorId === subcontractorAId,
      );
      expect(offender).toMatchObject({
        subcontractorName: `Acme Civil ${tag}`,
        ncrCount: 2,
      });
      // [GR-N4]: counts, never the unbounded id array the shipped shape carried.
      expect(offender).not.toHaveProperty('ncrIds');
      expect(res.body).not.toHaveProperty('drillDown');
    } finally {
      await prisma.nCR.deleteMany({ where: { id: { in: created.map((ncr) => ncr.id) } } });
    }
  });

  it('§7 row 7: the analytics route is office-role gated', async () => {
    const res = await analytics(foremanToken);
    expect(res.status).toBe(403);
  });

  // ----------------------------------------------------------------- AT-G27

  describe('AT-G27 vocabulary', () => {
    it('rejects an off-vocabulary category 400 server-side', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${qmToken}`)
        .send({
          projectId,
          description: 'Category outside the canonical list',
          category: 'Concrete finish',
          severity: 'minor',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual({ code: 'NCR_CATEGORY_NOT_CANONICAL' });
      expect(await prisma.nCR.count({ where: { projectId, category: 'Concrete finish' } })).toBe(0);
    });

    it('rejects an off-vocabulary root cause on respond', async () => {
      const ncr = await createNcr({ category: 'workmanship' });
      try {
        const res = await request(app)
          .post(`/api/ncrs/${ncr.id}/respond`)
          .set('Authorization', `Bearer ${qmToken}`)
          .send({
            rootCauseCategory: 'Method',
            rootCauseDescription: 'Free text root cause',
            proposedCorrectiveAction: 'Something',
          });
        expect(res.status).toBe(400);
        expect(res.body.error.details).toEqual({ code: 'NCR_ROOT_CAUSE_NOT_CANONICAL' });
      } finally {
        await prisma.nCR.delete({ where: { id: ncr.id } });
      }
    });

    it('still reads a pre-existing free-text value and aggregates it into other', async () => {
      // Written straight to the database, exactly as a row created before G5
      // exists today. Nothing rewrites it.
      const legacy = await createNcr({
        category: 'Concrete finish (legacy)',
        rootCauseCategory: 'Method',
      });
      try {
        const readBack = await request(app)
          .get(`/api/ncrs/${legacy.id}`)
          .set('Authorization', `Bearer ${qmToken}`);
        expect(readBack.status).toBe(200);
        expect(readBack.body.ncr.category).toBe('Concrete finish (legacy)');

        const res = await analytics();
        const other = res.body.charts.category.data.find(
          (datum: { key: string }) => datum.key === 'other',
        );
        expect(other?.value).toBeGreaterThanOrEqual(1);
        expect(
          res.body.charts.category.data.some(
            (datum: { key: string }) => datum.key === 'Concrete finish (legacy)',
          ),
        ).toBe(false);
      } finally {
        await prisma.nCR.delete({ where: { id: legacy.id } });
      }
    });
  });

  // ----------------------------------------------------------------- AT-G28

  it('AT-G28 puts NCRs on an unclassified lot in an explicit bucket, not nowhere', async () => {
    const created = await Promise.all([
      createNcr({ lotId: unclassifiedLotId }),
      createNcr({ lotId: classifiedLotId }),
      createNcr({ lotId: null }),
    ]);

    try {
      const res = await analytics();
      const buckets = res.body.charts.activity.data as Array<{ key: string; value: number }>;

      const unclassified = buckets.find((bucket) => bucket.key === 'not_classified');
      // One NCR on the null-slug lot plus one with no lot at all.
      expect(unclassified?.value).toBe(2);
      expect(buckets.find((bucket) => bucket.key === 'earthworks_general')?.value).toBe(1);
      expect(buckets.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(3);
    } finally {
      await prisma.nCR.deleteMany({ where: { id: { in: created.map((ncr) => ncr.id) } } });
    }
  });

  // ----------------------------------------------------------------- AT-G29

  it('AT-G29 links an auto-raised NCR to the failed checklist item', async () => {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `G5-ITP-${tag}`,
        lotType: 'standard',
        activityType: 'Earthworks',
        activitySlug: 'earthworks_general',
        status: 'in_progress',
      },
    });
    const instance = await prisma.iTPInstance.create({
      data: { lotId: lot.id, templateId: masterTemplateId, status: 'in_progress' },
    });

    try {
      const res = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${qmToken}`)
        .send({
          itpInstanceId: instance.id,
          checklistItemId: masterItemId,
          status: 'failed',
          ncrDescription: 'Compaction below specification',
          ncrCategory: 'workmanship',
        });

      expect(res.status).toBe(200);

      const raised = await prisma.nCR.findFirstOrThrow({
        where: { projectId, itpChecklistItemId: masterItemId },
        include: { itpChecklistItem: { select: { templateId: true } } },
      });
      expect(raised.itpChecklistItemId).toBe(masterItemId);
      // "resolvable to its template" — one join, not a regex over free text.
      expect(raised.itpChecklistItem?.templateId).toBe(masterTemplateId);
      // The free-text marker is still written; the shipped breadcrumb reads it.
      expect(raised.rectificationNotes).toContain(`[itp-item:${masterItemId}]`);
    } finally {
      await prisma.nCR.deleteMany({ where: { projectId, itpChecklistItemId: masterItemId } });
      await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId: instance.id } });
      await prisma.iTPInstance.delete({ where: { id: instance.id } });
      await prisma.lot.delete({ where: { id: lot.id } });
    }
  });

  it('groups a template and its in-project copy onto one requirement ([GR-A3])', async () => {
    const created = await Promise.all([
      createNcr({ itpChecklistItemId: masterItemId, responsibleSubcontractorId: subcontractorAId }),
      createNcr({ itpChecklistItemId: copyItemId }),
    ]);

    try {
      const res = await analytics();
      const recurring = res.body.recurringItems.data as Array<{
        rootChecklistItemId: string;
        ncrCount: number;
        subcontractorCount: number;
        checklistItemIds: string[];
      }>;

      const group = recurring.find((item) => item.rootChecklistItemId === masterItemId);
      expect(group).toBeDefined();
      expect(group?.ncrCount).toBe(2);
      expect(group?.checklistItemIds).toEqual(expect.arrayContaining([masterItemId, copyItemId]));
      expect(res.body.recurringItems.coverage.linked).toBe(2);
    } finally {
      await prisma.nCR.deleteMany({ where: { id: { in: created.map((ncr) => ncr.id) } } });
    }
  });

  // ----------------------------------------------------------------- AT-G30

  describe('AT-G30 proposals close into a template revision', () => {
    it('creates a proposal carrying SERVER-computed evidence, then a new revision on accept', async () => {
      const trend = await Promise.all([
        createNcr({
          itpChecklistItemId: masterItemId,
          responsibleSubcontractorId: subcontractorAId,
        }),
        createNcr({ itpChecklistItemId: copyItemId }),
      ]);

      let revisionId: string | undefined;
      let proposalId: string | undefined;

      try {
        const createRes = await request(app)
          .post('/api/ncr-learning/proposals')
          .set('Authorization', `Bearer ${qmToken}`)
          .send({
            projectId,
            checklistItemId: masterItemId,
            proposedChange: 'Require a nuclear density gauge reading per 300mm layer.',
            // Deliberately supplied and deliberately ignored: the evidence on a
            // quality record is computed, never asserted by the caller.
            ncrCount: 999,
          });

        expect(createRes.status).toBe(201);
        proposalId = createRes.body.proposal.id;
        expect(createRes.body.proposal.ncrCount).toBe(2);
        expect(createRes.body.proposal.subcontractorCount).toBe(1);
        expect(createRes.body.proposal.status).toBe('open');

        const acceptRes = await request(app)
          .post(`/api/ncr-learning/proposals/${proposalId}/accept`)
          .set('Authorization', `Bearer ${qmToken}`)
          .send({ revisionLabel: 'Rev B', changeSummary: 'Add the density gauge requirement.' });

        expect(acceptRes.status).toBe(201);
        revisionId = acceptRes.body.revision.id;
        expect(revisionId).not.toBe(masterTemplateId);

        // NEVER an in-place edit: the original row is untouched apart from its
        // supersession pointer, and its items still say what they said.
        const original = await prisma.iTPTemplate.findUniqueOrThrow({
          where: { id: masterTemplateId },
          include: { checklistItems: true },
        });
        expect(original.supersededById).toBe(revisionId);
        expect(original.name).toBe(`G5 Master ${tag}`);
        expect(original.checklistItems.map((item) => item.description)).toContain(
          'Compaction test at 300mm layers',
        );

        const revision = await prisma.iTPTemplate.findUniqueOrThrow({
          where: { id: revisionId as string },
          include: { checklistItems: true },
        });
        expect(revision.sourceTemplateId).toBe(masterTemplateId);
        expect(revision.changeSummary).toContain('2 NCR(s)');
        // Item lineage travels with the revision, so the trend keeps counting.
        expect(revision.checklistItems.every((item) => item.sourceChecklistItemId)).toBe(true);

        const decided = await prisma.templateRevisionProposal.findUniqueOrThrow({
          where: { id: proposalId as string },
        });
        expect(decided.status).toBe('accepted');
        expect(decided.resultingTemplateId).toBe(revisionId);

        // Accepting twice cannot mint a second revision.
        const replay = await request(app)
          .post(`/api/ncr-learning/proposals/${proposalId}/accept`)
          .set('Authorization', `Bearer ${qmToken}`)
          .send({ revisionLabel: 'Rev C', changeSummary: 'Again' });
        expect(replay.status).toBe(400);
        expect(replay.body.error.details).toEqual({ code: 'PROPOSAL_ALREADY_DECIDED' });
      } finally {
        await prisma.nCR.deleteMany({ where: { id: { in: trend.map((ncr) => ncr.id) } } });
        if (proposalId) {
          await prisma.templateRevisionProposal
            .delete({ where: { id: proposalId } })
            .catch(() => {});
        }
        await prisma.iTPTemplate.update({
          where: { id: masterTemplateId },
          data: { supersededById: null, supersededAt: null, isActive: true },
        });
        if (revisionId) {
          await prisma.revisionIssue.deleteMany({ where: { entityId: revisionId } });
          await prisma.iTPTemplate.delete({ where: { id: revisionId } }).catch(() => {});
        }
      }
    });

    it('refuses to revise a GLOBAL library template from the app (§2.3)', async () => {
      const global = await prisma.iTPTemplate.create({
        data: {
          projectId: null,
          name: `G5 Global ${tag}`,
          activityType: 'earthworks_general',
          checklistItems: { create: [{ sequenceNumber: 1, description: 'Library item' }] },
        },
        include: { checklistItems: true },
      });

      try {
        // The refusal now lands at CREATE rather than at accept. Same rule
        // (§2.3: a new library edition is an operator act), enforced before a
        // dead-end proposal can enter the queue and wait weeks for a reviewer to
        // discover it can never be actioned.
        const createRes = await request(app)
          .post('/api/ncr-learning/proposals')
          .set('Authorization', `Bearer ${qmToken}`)
          .send({
            projectId,
            checklistItemId: global.checklistItems[0].id,
            proposedChange: 'Tighten the acceptance criteria.',
          });

        expect(createRes.status).toBe(400);
        expect(createRes.body.error.details).toEqual({ code: 'GLOBAL_TEMPLATE_NOT_ISSUABLE' });

        // Nothing was recorded, and the library template is untouched.
        const queued = await prisma.templateRevisionProposal.count({
          where: { templateId: global.id },
        });
        expect(queued).toBe(0);
        const untouched = await prisma.iTPTemplate.findUniqueOrThrow({ where: { id: global.id } });
        expect(untouched.supersededById).toBeNull();
      } finally {
        await prisma.templateRevisionProposal.deleteMany({ where: { templateId: global.id } });
        await prisma.iTPTemplate.delete({ where: { id: global.id } });
      }
    });

    it('404s the proposal routes when the flag is unset', async () => {
      delete process.env.NCR_LEARNING_LOOP_ENABLED;
      try {
        const res = await request(app)
          .get('/api/ncr-learning/proposals')
          .query({ projectId })
          .set('Authorization', `Bearer ${qmToken}`);
        expect(res.status).toBe(404);
      } finally {
        process.env.NCR_LEARNING_LOOP_ENABLED = 'true';
      }
    });
  });

  // ----------------------------------------------------------------- AT-G31

  it('AT-G31 keeps project B out of project A trends, and refuses cross-tenant reads', async () => {
    const outsideNcr = await createNcr({
      projectId: otherProjectId,
      category: 'design',
      rootCauseCategory: 'equipment',
    });
    const insideNcr = await createNcr({ category: 'workmanship', rootCauseCategory: 'training' });

    try {
      const res = await analytics();
      expect(res.status).toBe(200);
      expect(res.body.summary.total).toBe(1);
      expect(res.body.charts.rootCause.data.map((datum: { key: string }) => datum.key)).toEqual([
        'training',
      ]);

      // And the other project is not readable at all by this user.
      const crossTenant = await analytics(qmToken, otherProjectId);
      expect(crossTenant.status).toBe(403);
    } finally {
      await prisma.nCR.deleteMany({ where: { id: { in: [outsideNcr.id, insideNcr.id] } } });
    }
  });

  // --------------------------------------------------------------- [GR-N4]

  it('[GR-N4] caps repeatOffenders instead of returning every subcontractor', async () => {
    const subs = await Promise.all(
      Array.from({ length: 12 }, (_unused, index) =>
        prisma.subcontractorCompany.create({
          data: {
            projectId,
            companyName: `G5 Sub ${index} ${tag}`,
            primaryContactName: 'Contact',
            primaryContactEmail: `g5-sub-${index}-${tag}@example.com`,
            status: 'approved',
          },
        }),
      ),
    );

    const ncrs = [];
    for (const sub of subs) {
      ncrs.push(await createNcr({ responsibleSubcontractorId: sub.id }));
      ncrs.push(await createNcr({ responsibleSubcontractorId: sub.id }));
    }

    try {
      const res = await analytics();
      expect(res.body.repeatOffenders.data.length).toBe(10);
      expect(
        res.body.repeatOffenders.data.every(
          (entry: { subcontractorName: string }) => entry.subcontractorName.length > 0,
        ),
      ).toBe(true);
    } finally {
      await prisma.nCR.deleteMany({ where: { id: { in: ncrs.map((ncr) => ncr.id) } } });
      await prisma.subcontractorCompany.deleteMany({
        where: { id: { in: subs.map((sub) => sub.id) } },
      });
    }
  });
});
