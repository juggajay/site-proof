/**
 * Wave G G1 acceptance tests
 * (`docs/plans/wave-g-execution-spec-2026-07-31.md` §1.8).
 *
 * AT numbers are in the test titles, as the increment brief requires.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../lib/supabase.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/supabase.js')>('../lib/supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => false),
    getSupabaseClient: vi.fn(),
  };
});

import { authRouter } from './auth.js';
import { drawingsRouter } from './drawings.js';
import { revisionsRouter } from './revisions.js';
import { lotsRouter } from './lots.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/drawings', drawingsRouter);
app.use('/api/revisions', revisionsRouter);
app.use('/api/lots', lotsRouter);
app.use(errorHandler);

const uploadDir = path.join(process.cwd(), 'uploads', 'drawings');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const validPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');

function attachPdf(req: request.Test): request.Test {
  return req.attach('file', validPdfBytes, {
    filename: 'test-supersede.pdf',
    contentType: 'application/pdf',
  });
}

describe('Wave G G1 — revision governance', () => {
  const stamp = Date.now();
  let companyId: string;
  let authToken: string;
  let userId: string;
  let projectId: string;
  let otherProjectId: string;
  let otherAuthToken: string;

  beforeAll(async () => {
    process.env.REVISION_GOVERNANCE_ENABLED = 'true';

    const company = await prisma.company.create({ data: { name: `G1 Test Company ${stamp}` } });
    companyId = company.id;

    const admin = await registerTestUser(app, {
      emailPrefix: 'g1-admin',
      fullName: 'G1 Admin',
      companyId,
      roleInCompany: 'admin',
    });
    authToken = admin.token;
    userId = admin.userId;

    const project = await prisma.project.create({
      data: {
        name: `G1 Project ${stamp}`,
        projectNumber: `G1-${stamp}`,
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

    // A second tenant, for AT-G5.
    const otherCompany = await prisma.company.create({
      data: { name: `G1 Other Company ${stamp}` },
    });
    const otherAdmin = await registerTestUser(app, {
      emailPrefix: 'g1-other-admin',
      fullName: 'G1 Other Admin',
      companyId: otherCompany.id,
      roleInCompany: 'admin',
    });
    otherAuthToken = otherAdmin.token;
    const otherProject = await prisma.project.create({
      data: {
        name: `G1 Other Project ${stamp}`,
        projectNumber: `G1O-${stamp}`,
        companyId: otherCompany.id,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    otherProjectId = otherProject.id;
    await prisma.projectUser.create({
      data: {
        projectId: otherProjectId,
        userId: otherAdmin.userId,
        role: 'admin',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    delete process.env.REVISION_GOVERNANCE_ENABLED;
  });

  /** A drawing created through the API, so its first-issue record exists too. */
  async function createDrawing(drawingNumber: string, revision: string) {
    const res = await attachPdf(
      request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', drawingNumber)
        .field('revision', revision),
    );
    expect(res.status).toBe(201);
    return res.body.drawing ?? res.body;
  }

  async function createDocument(documentType: string, filename: string, project = projectId) {
    return prisma.document.create({
      data: {
        projectId: project,
        documentType,
        filename,
        fileUrl: `/uploads/${filename}`,
        uploadedById: userId,
      },
    });
  }

  // -------------------------------------------------------------------------
  // AT-G1 / AT-G2 — issuing a drawing revision
  // -------------------------------------------------------------------------

  it('AT-G1: superseding a drawing records a RevisionIssue, the supersession pointer and an audit row', async () => {
    const original = await createDrawing(`G1-AT1-${stamp}`, 'A');

    const res = await attachPdf(
      request(app)
        .post(`/api/drawings/${original.id}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'B')
        .field('reason', 'Client direction CD-11 changed the batter slope'),
    );
    expect(res.status).toBe(201);
    const newDrawingId = (res.body.drawing ?? res.body).id;

    const issue = await prisma.revisionIssue.findFirst({
      where: { projectId, entityType: 'drawing', entityId: newDrawingId },
    });
    expect(issue).toMatchObject({
      supersedesId: original.id,
      revisionLabel: 'B',
      reason: 'Client direction CD-11 changed the batter slope',
      issuedById: userId,
    });

    const supersededOriginal = await prisma.drawing.findUnique({ where: { id: original.id } });
    expect(supersededOriginal?.supersededById).toBe(newDrawingId);

    const audit = await prisma.auditLog.findFirst({
      where: {
        projectId,
        entityType: 'drawing',
        entityId: newDrawingId,
        action: 'revision_issued',
      },
    });
    expect(audit).toBeTruthy();
  });

  it('AT-G2: supersession without a reason is 400; a first issue without a reason succeeds', async () => {
    const original = await createDrawing(`G1-AT2-${stamp}`, 'A');

    // The first issue: no reason supplied, and one RevisionIssue with no
    // `supersedesId` was still recorded.
    const firstIssue = await prisma.revisionIssue.findFirst({
      where: { projectId, entityType: 'drawing', entityId: original.id },
    });
    expect(firstIssue).toMatchObject({ supersedesId: null, reason: null, revisionLabel: 'A' });

    const res = await attachPdf(
      request(app)
        .post(`/api/drawings/${original.id}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'B'),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/reason is required/i);

    // No partial write: the original is still current and no issue was recorded.
    const unchanged = await prisma.drawing.findUnique({ where: { id: original.id } });
    expect(unchanged?.supersededById).toBeNull();
    expect(
      await prisma.revisionIssue.count({ where: { projectId, supersedesId: original.id } }),
    ).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AT-G7 — concurrent issue of the same revision label
  // -------------------------------------------------------------------------

  it('AT-G7: a duplicate revision label is rejected and leaves no RevisionIssue behind', async () => {
    const original = await createDrawing(`G1-AT7-${stamp}`, 'A');

    const first = await attachPdf(
      request(app)
        .post(`/api/drawings/${original.id}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'B')
        .field('reason', 'first'),
    );
    expect(first.status).toBe(201);

    // Sequential loser: the shipped pre-check at drawings.ts catches it and
    // returns 400. That is shipped behaviour and Wave G does not change it —
    // the 400/409 split is recorded in spec §10 item 10, not fixed here.
    const second = await attachPdf(
      request(app)
        .post(`/api/drawings/${original.id}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'B')
        .field('reason', 'second'),
    );
    expect(second.status).toBe(400);

    // Exactly one issue exists for this supersession.
    expect(
      await prisma.revisionIssue.count({ where: { projectId, supersedesId: original.id } }),
    ).toBe(1);
  });

  // -------------------------------------------------------------------------
  // AT-G36 / AT-G5 — tenancy
  // -------------------------------------------------------------------------

  it('AT-G36: a global library ITP template cannot be issued against', async () => {
    const globalTemplate = await prisma.iTPTemplate.create({
      data: {
        projectId: null,
        name: `G1 Global Template ${stamp}`,
        activityType: 'earthworks',
      },
    });

    const res = await request(app)
      .post('/api/revisions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        entityType: 'itp_template',
        entityId: globalTemplate.id,
        revisionLabel: 'Ed. 2',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/global library/i);

    const projectTemplate = await prisma.iTPTemplate.create({
      data: { projectId, name: `G1 Project Template ${stamp}`, activityType: 'earthworks' },
    });
    const ok = await request(app)
      .post('/api/revisions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        entityType: 'itp_template',
        entityId: projectTemplate.id,
        revisionLabel: 'Ed. 2',
      });
    expect(ok.status).toBe(201);
  });

  it('AT-G5: a user in another project cannot read, issue against, or link a revision', async () => {
    const spec = await createDocument('specification', `g1-spec-${stamp}.pdf`);
    const issued = await request(app)
      .post('/api/revisions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ projectId, entityType: 'specification', entityId: spec.id, revisionLabel: 'Ed. 1' });
    expect(issued.status).toBe(201);

    // Read.
    const read = await request(app)
      .get('/api/revisions')
      .query({ projectId, entityType: 'specification', entityId: spec.id })
      .set('Authorization', `Bearer ${otherAuthToken}`);
    expect(read.status).toBe(403);

    // Issue against a record in the other tenant's project.
    const crossIssue = await request(app)
      .post('/api/revisions')
      .set('Authorization', `Bearer ${otherAuthToken}`)
      .send({
        projectId: otherProjectId,
        entityType: 'specification',
        entityId: spec.id,
        revisionLabel: 'Ed. 2',
      });
    // 404, not 403: a 403 would confirm the document exists somewhere else.
    expect(crossIssue.status).toBe(404);

    // Link.
    const otherLot = await prisma.lot.create({
      data: {
        projectId: otherProjectId,
        lotNumber: `G1-OTHER-${stamp}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    const crossLink = await request(app)
      .post(`/api/revisions/lots/${otherLot.id}/governing-revisions`)
      .set('Authorization', `Bearer ${otherAuthToken}`)
      .send({ entityType: 'specification', entityId: spec.id, revisionLabel: 'Ed. 1' });
    expect(crossLink.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // AT-G37 / AT-G38 — the two hand-written database constraints
  // -------------------------------------------------------------------------

  it('AT-G37: a recipient addressed both internally and externally is rejected by the database; addressed to nobody is rejected by the route', async () => {
    const doc = await createDocument('client_direction', `g1-cd-${stamp}.pdf`);
    const issue = await prisma.revisionIssue.create({
      data: {
        projectId,
        entityType: 'client_direction',
        entityId: doc.id,
        revisionLabel: 'CD-1',
        issuedById: userId,
      },
    });

    // Never legitimate in any state — the CHECK constraint.
    await expect(
      prisma.revisionAcknowledgement.create({
        data: { issueId: issue.id, userId, recipientEmail: 'someone@example.com' },
      }),
    ).rejects.toThrow();

    // Addressed to nobody is an INSERT-time invariant, enforced at the route
    // rather than the database: `onDelete: SetNull` legitimately produces the
    // same (null, null) shape when an acknowledger's account is deleted, so the
    // database cannot forbid the state without breaking AT-G6.
    const addressedToNobody = await request(app)
      .post(`/api/revisions/${issue.id}/recipients`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipients: [{}] });
    expect(addressedToNobody.status).toBe(400);

    // Exactly one of the two is fine.
    const ok = await prisma.revisionAcknowledgement.create({
      data: { issueId: issue.id, userId },
    });
    expect(ok.id).toBeTruthy();
  });

  it('AT-G38: two ACTIVE governing-revision links for the same record are impossible, and re-linking after an unlink works', async () => {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `G1-LINK-${stamp}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    const spec = await createDocument('specification', `g1-link-spec-${stamp}.pdf`);
    const body = { entityType: 'specification', entityId: spec.id, revisionLabel: 'Ed. 1' };

    const first = await request(app)
      .post(`/api/revisions/lots/${lot.id}/governing-revisions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(body);
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post(`/api/revisions/lots/${lot.id}/governing-revisions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(body);
    expect(duplicate.status).toBe(409);

    const unlinked = await request(app)
      .delete(`/api/revisions/lots/${lot.id}/governing-revisions/${first.body.link.id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(unlinked.status).toBe(200);
    expect(unlinked.body.link.unlinkedAt).toBeTruthy();

    const relinked = await request(app)
      .post(`/api/revisions/lots/${lot.id}/governing-revisions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(body);
    expect(relinked.status).toBe(201);

    // The unlinked row is retained, not deleted — history is the product.
    expect(await prisma.lotGoverningRevision.count({ where: { lotId: lot.id } })).toBe(2);
  });

  // -------------------------------------------------------------------------
  // AT-G6 — acknowledgement survives project-user removal
  // -------------------------------------------------------------------------

  it('AT-G6: an acknowledgement survives the acknowledger leaving the project', async () => {
    const foreman = await registerTestUser(app, {
      emailPrefix: 'g1-foreman',
      fullName: 'G1 Foreman',
      companyId,
      roleInCompany: 'member',
    });
    await prisma.projectUser.create({
      data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
    });

    const doc = await createDocument('approved_method', `g1-method-${stamp}.pdf`);
    const issued = await request(app)
      .post('/api/revisions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        entityType: 'approved_method',
        entityId: doc.id,
        revisionLabel: 'v1',
        recipients: [{ userId: foreman.userId }],
      });
    expect(issued.status).toBe(201);

    const acknowledged = await request(app)
      .post(`/api/revisions/${issued.body.issue.id}/acknowledge`)
      .set('Authorization', `Bearer ${foreman.token}`);
    expect(acknowledged.status).toBe(200);
    const acknowledgedAt = acknowledged.body.acknowledgement.acknowledgedAt;
    expect(acknowledgedAt).toBeTruthy();

    // Re-acknowledging does not move the instant.
    const again = await request(app)
      .post(`/api/revisions/${issued.body.issue.id}/acknowledge`)
      .set('Authorization', `Bearer ${foreman.token}`);
    expect(again.body.acknowledgement.acknowledgedAt).toBe(acknowledgedAt);

    // Remove the user from the project AND delete the user row: `SetNull` keeps
    // the acknowledgement, with its timestamp intact.
    await prisma.projectUser.deleteMany({ where: { projectId, userId: foreman.userId } });
    await prisma.emailVerificationToken.deleteMany({ where: { userId: foreman.userId } });
    await prisma.user.delete({ where: { id: foreman.userId } });

    const surviving = await prisma.revisionAcknowledgement.findFirst({
      where: { issueId: issued.body.issue.id },
    });
    expect(surviving?.userId).toBeNull();
    expect(surviving?.acknowledgedAt?.toISOString()).toBe(acknowledgedAt);
  });

  // -------------------------------------------------------------------------
  // AT-G3 / AT-G4 — the readiness warning
  // -------------------------------------------------------------------------

  it('AT-G3: a superseded governing revision produces exactly one warning and no blocker', async () => {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `G1-READY-${stamp}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });

    const original = await createDrawing(`G1-AT3-${stamp}`, 'A');
    const link = await request(app)
      .post(`/api/revisions/lots/${lot.id}/governing-revisions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ entityType: 'drawing', entityId: original.id, revisionLabel: 'A' });
    expect(link.status).toBe(201);

    const before = await request(app)
      .get(`/api/lots/${lot.id}/readiness`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(before.status).toBe(200);
    expect(JSON.stringify(before.body)).not.toContain('governing_revision_superseded');

    const superseded = await attachPdf(
      request(app)
        .post(`/api/drawings/${original.id}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'B')
        .field('reason', 'Design change'),
    );
    expect(superseded.status).toBe(201);

    const after = await request(app)
      .get(`/api/lots/${lot.id}/readiness`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(after.status).toBe(200);

    const readiness = after.body.readiness ?? after.body;
    const allItems = [
      ...readiness.conformance.blockers,
      ...readiness.conformance.warnings,
      ...readiness.conformance.support,
      ...readiness.claim.blockers,
      ...readiness.claim.warnings,
      ...readiness.claim.support,
    ];
    const matches = allItems.filter(
      (item: { code: string }) => item.code === 'governing_revision_superseded',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      severity: 'warning',
      area: 'document',
      blocksAction: false,
      count: 1,
    });
    expect(
      readiness.conformance.blockers.filter(
        (item: { code: string }) => item.code === 'governing_revision_superseded',
      ),
    ).toHaveLength(0);
  });

  it('AT-G4: a lot whose governing revision is superseded can still be conformed', async () => {
    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: `G1 Conform Template ${stamp}`,
        activityType: 'earthworks',
        checklistItems: {
          create: [
            {
              description: 'Subgrade visually inspected',
              sequenceNumber: 1,
              pointType: 'inspection',
            },
          ],
        },
      },
      include: { checklistItems: true },
    });

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `G1-CONFORM-${stamp}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
        itpTemplateId: template.id,
      },
    });
    const instance = await prisma.iTPInstance.create({
      data: { lotId: lot.id, templateId: template.id, status: 'in_progress' },
    });
    await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instance.id,
        checklistItemId: template.checklistItems[0].id,
        status: 'completed',
        completedById: userId,
        completedAt: new Date(),
      },
    });

    const original = await createDrawing(`G1-AT4-${stamp}`, 'A');
    await request(app)
      .post(`/api/revisions/lots/${lot.id}/governing-revisions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ entityType: 'drawing', entityId: original.id, revisionLabel: 'A' })
      .expect(201);
    await attachPdf(
      request(app)
        .post(`/api/drawings/${original.id}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'B')
        .field('reason', 'Design change'),
    ).expect(201);

    const conformed = await request(app)
      .post(`/api/lots/${lot.id}/conform`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(conformed.status).toBe(200);
    expect(conformed.body.lot.status).toBe('conformed');

    // E4: the warning is still shown on the conformed lot — conformance already
    // happened, and the record states what governed it.
    const readinessRes = await request(app)
      .get(`/api/lots/${lot.id}/readiness`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(JSON.stringify(readinessRes.body)).toContain('governing_revision_superseded');
  });

  // -------------------------------------------------------------------------
  // Flag contract (spec §1.9)
  // -------------------------------------------------------------------------

  it('routes 404 while REVISION_GOVERNANCE_ENABLED is unset', async () => {
    delete process.env.REVISION_GOVERNANCE_ENABLED;
    try {
      const res = await request(app)
        .get('/api/revisions')
        .query({ projectId, entityType: 'drawing', entityId: 'anything' })
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
    } finally {
      process.env.REVISION_GOVERNANCE_ENABLED = 'true';
    }
  });
});
