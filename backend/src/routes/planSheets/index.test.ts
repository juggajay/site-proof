import express from 'express';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { planSheetsRouter } from './index.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', planSheetsRouter);
app.use(errorHandler);

// A real 20x12 PNG so multer's fileFilter, the magic-byte sniff, and sharp all
// run for real end to end.
let PNG: Buffer;

describe('Plan Sheets API', () => {
  let companyId: string;
  let otherCompanyId: string;
  let pmToken: string;
  let viewerToken: string;
  let subbieToken: string;
  let outsiderToken: string;
  let projectId: string;
  let siblingProjectId: string; // same company, pm is also a member
  let siblingDocumentId: string; // a Document that belongs to the sibling project

  beforeAll(async () => {
    PNG = await sharp({
      create: { width: 20, height: 12, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `PS Co ${stamp}` } })).id;
    otherCompanyId = (await prisma.company.create({ data: { name: `PS Other ${stamp}` } })).id;

    const pm = await registerTestUser(app, {
      emailPrefix: 'ps-pm',
      fullName: 'PS PM',
      companyId,
      roleInCompany: 'project_manager',
    });
    pmToken = pm.token;

    const viewer = await registerTestUser(app, {
      emailPrefix: 'ps-viewer',
      fullName: 'PS Viewer',
      companyId,
      roleInCompany: 'viewer',
    });
    viewerToken = viewer.token;

    const subbie = await registerTestUser(app, {
      emailPrefix: 'ps-subbie',
      fullName: 'PS Subbie',
      companyId,
      roleInCompany: 'subcontractor',
    });
    subbieToken = subbie.token;

    const outsider = await registerTestUser(app, {
      emailPrefix: 'ps-outsider',
      fullName: 'PS Outsider',
      companyId: otherCompanyId,
      roleInCompany: 'project_manager',
    });
    outsiderToken = outsider.token;

    const project = await prisma.project.create({
      data: {
        name: `PS Project ${stamp}`,
        projectNumber: `PS-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    const sibling = await prisma.project.create({
      data: {
        name: `PS Sibling ${stamp}`,
        projectNumber: `PSS-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    siblingProjectId = sibling.id;

    const siblingDoc = await prisma.document.create({
      data: {
        projectId: siblingProjectId,
        documentType: 'drawing',
        filename: 'sibling.pdf',
        fileUrl: 'uploads/documents/sibling.pdf',
      },
    });
    siblingDocumentId = siblingDoc.id;

    for (const [userId, role] of [
      [pm.userId, 'project_manager'],
      [viewer.userId, 'viewer'],
      [subbie.userId, 'subcontractor'],
    ] as const) {
      await prisma.projectUser.create({ data: { projectId, userId, role, status: 'active' } });
    }
    await prisma.projectUser.create({
      data: {
        projectId: siblingProjectId,
        userId: pm.userId,
        role: 'project_manager',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    await prisma.planSheet.deleteMany({
      where: { projectId: { in: [projectId, siblingProjectId] } },
    });
    await prisma.document.deleteMany({
      where: { projectId: { in: [projectId, siblingProjectId] } },
    });
    await prisma.projectUser.deleteMany({
      where: { projectId: { in: [projectId, siblingProjectId] } },
    });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, siblingProjectId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  });

  function createReq(token: string) {
    return request(app)
      .post(`/api/projects/${projectId}/plan-sheets`)
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'C-101 Rev D')
      .field('coordinateSystem', 'EPSG:7856')
      .attach('image', PNG, { filename: 'sheet.png', contentType: 'image/png' });
  }

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/plan-sheets`);
    expect(res.status).toBe(401);
  });

  it('rejects a cross-company outsider with 403', async () => {
    const listRes = await request(app)
      .get(`/api/projects/${projectId}/plan-sheets`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(listRes.status).toBe(403);
    expect((await createReq(outsiderToken)).status).toBe(403);
  });

  it('denies write to a viewer and denies read to a subcontractor', async () => {
    expect((await createReq(viewerToken)).status).toBe(403);

    const subbieRead = await request(app)
      .get(`/api/projects/${projectId}/plan-sheets`)
      .set('Authorization', `Bearer ${subbieToken}`);
    expect(subbieRead.status).toBe(403);
  });

  it('runs the create → list → get → image → patch → delete lifecycle', async () => {
    // Create: sharp re-encodes to PNG; dimensions come from the stored image.
    const created = await createReq(pmToken);
    expect(created.status).toBe(201);
    const sheet = created.body.planSheet;
    expect(sheet.id).toBeTruthy();
    expect(sheet.imageRef).toBeTruthy();
    expect(sheet.imageWidth).toBe(20);
    expect(sheet.imageHeight).toBe(12);
    expect(sheet.coordinateSystem).toBe('EPSG:7856');
    expect(sheet.hasRegistration).toBe(false);
    expect(sheet.createdById).toBeTruthy();

    // List (viewer may read; payload omits registration/perimeter)
    const list = await request(app)
      .get(`/api/projects/${projectId}/plan-sheets`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.planSheets).toHaveLength(1);
    expect(list.body.planSheets[0]).not.toHaveProperty('registration');
    expect(list.body.planSheets[0].hasRegistration).toBe(false);

    // Get by id
    const fetched = await request(app)
      .get(`/api/projects/${projectId}/plan-sheets/${sheet.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.planSheet.name).toBe('C-101 Rev D');

    // Project-scoped: same id under the sibling project → 404
    const mismatched = await request(app)
      .get(`/api/projects/${siblingProjectId}/plan-sheets/${sheet.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(mismatched.status).toBe(404);

    // Image streams as PNG
    const image = await request(app)
      .get(`/api/projects/${projectId}/plan-sheets/${sheet.id}/image`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.body.length).toBeGreaterThan(0);

    // Patch: attach a valid registration
    const patched = await request(app)
      .patch(`/api/projects/${projectId}/plan-sheets/${sheet.id}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        registration: {
          points: [
            { px: 0, py: 0, easting: 500000, northing: 6000000 },
            { px: 20, py: 0, easting: 500020, northing: 6000000 },
          ],
          transform: [1, 0, 500000, 0, -1, 6000000],
          rmsErrorM: 0.012,
        },
      });
    expect(patched.status).toBe(200);
    expect(patched.body.planSheet.hasRegistration).toBe(true);
    expect(patched.body.planSheet.registration.rmsErrorM).toBe(0.012);

    // Patch: clear registration with null
    const cleared = await request(app)
      .patch(`/api/projects/${projectId}/plan-sheets/${sheet.id}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ registration: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.planSheet.hasRegistration).toBe(false);

    // Delete
    const deleted = await request(app)
      .delete(`/api/projects/${projectId}/plan-sheets/${sheet.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(deleted.status).toBe(200);

    const gone = await request(app)
      .get(`/api/projects/${projectId}/plan-sheets/${sheet.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(gone.status).toBe(404);
  });

  it('rejects a documentId from another project (cross-tenant boundary)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/plan-sheets`)
      .set('Authorization', `Bearer ${pmToken}`)
      .field('name', 'Cross tenant')
      .field('coordinateSystem', 'EPSG:7856')
      .field('documentId', siblingDocumentId)
      .attach('image', PNG, { filename: 'sheet.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DOCUMENT_NOT_IN_PROJECT');
  });

  it('rejects an unsupported coordinate system on create', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/plan-sheets`)
      .set('Authorization', `Bearer ${pmToken}`)
      .field('name', 'Bad CRS')
      .field('coordinateSystem', 'EPSG:9999')
      .attach('image', PNG, { filename: 'sheet.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-PNG/JPEG upload via the file filter', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/plan-sheets`)
      .set('Authorization', `Bearer ${pmToken}`)
      .field('name', 'Bad file')
      .field('coordinateSystem', 'EPSG:7856')
      .attach('image', Buffer.from('<svg/>'), {
        filename: 'evil.svg',
        contentType: 'image/svg+xml',
      });
    expect(res.status).toBe(400);
  });

  it('rejects a registration transform that is not exactly 6 numbers', async () => {
    const created = await createReq(pmToken);
    expect(created.status).toBe(201);
    const id = created.body.planSheet.id;

    const res = await request(app)
      .patch(`/api/projects/${projectId}/plan-sheets/${id}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        registration: {
          points: [
            { px: 0, py: 0, easting: 1, northing: 2 },
            { px: 1, py: 1, easting: 3, northing: 4 },
          ],
          transform: [1, 2, 3, 4, 5],
          rmsErrorM: 0,
        },
      });
    expect(res.status).toBe(400);

    await request(app)
      .delete(`/api/projects/${projectId}/plan-sheets/${id}`)
      .set('Authorization', `Bearer ${pmToken}`);
  });

  it('denies patch and delete to a viewer', async () => {
    const created = await createReq(pmToken);
    const id = created.body.planSheet.id;

    const patch = await request(app)
      .patch(`/api/projects/${projectId}/plan-sheets/${id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'nope' });
    expect(patch.status).toBe(403);

    const del = await request(app)
      .delete(`/api/projects/${projectId}/plan-sheets/${id}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(del.status).toBe(403);

    await request(app)
      .delete(`/api/projects/${projectId}/plan-sheets/${id}`)
      .set('Authorization', `Bearer ${pmToken}`);
  });
});
