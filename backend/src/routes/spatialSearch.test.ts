import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';
import { authRouter } from './auth.js';
import { spatialSearchRouter } from './spatialSearch.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', spatialSearchRouter);
app.use(errorHandler);

// Box covering Sydney; the "inside" polygon sits within it, the "outside" one
// (far east) does not.
const BOUNDS = { west: 150.9, south: -33.9, east: 151.1, north: -33.7 };

function polygonAt(lng: number, lat: number): object {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lng, lat],
          [lng + 0.001, lat],
          [lng + 0.001, lat - 0.001],
          [lng, lat - 0.001],
          [lng, lat],
        ],
      ],
    },
  };
}

describe('POST /api/projects/:projectId/spatial-search', () => {
  let companyId: string;
  let otherCompanyId: string;
  let pmToken: string;
  let subbieToken: string;
  let outsiderToken: string;
  let projectId: string;
  let insideLotId: string;
  let outsideLotId: string;
  let unassignedInsideLotId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `SS Co ${stamp}` } })).id;
    otherCompanyId = (await prisma.company.create({ data: { name: `SS Other ${stamp}` } })).id;

    const pm = await registerTestUser(app, {
      emailPrefix: 'ss-pm',
      fullName: 'SS PM',
      companyId,
      roleInCompany: 'project_manager',
    });
    pmToken = pm.token;

    const outsider = await registerTestUser(app, {
      emailPrefix: 'ss-outsider',
      fullName: 'SS Outsider',
      companyId: otherCompanyId,
      roleInCompany: 'project_manager',
    });
    outsiderToken = outsider.token;

    const project = await prisma.project.create({
      data: {
        name: `SS Project ${stamp}`,
        projectNumber: `SS-${stamp}`,
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
        companyName: `SS Subbie ${stamp}`,
        primaryContactName: 'SS Subbie',
        primaryContactEmail: `ss-subbie-${stamp}@example.com`,
        status: 'approved',
        portalAccess: { lots: true },
      },
    });

    const subbie = await registerTestUser(app, {
      emailPrefix: 'ss-subbie-user',
      fullName: 'SS Subbie User',
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

    // Inside the box, assigned to the subbie.
    const insideLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `SS-INSIDE-${stamp}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
        assignedSubcontractorId: subcontractorCompany.id,
      },
    });
    insideLotId = insideLot.id;

    // Inside the box, NOT assigned to the subbie.
    const unassignedInsideLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `SS-INSIDE-UNASSIGNED-${stamp}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Drainage',
      },
    });
    unassignedInsideLotId = unassignedInsideLot.id;

    // Far outside the box.
    const outsideLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `SS-OUTSIDE-${stamp}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'General',
      },
    });
    outsideLotId = outsideLot.id;

    await prisma.lotGeometry.create({
      data: { lotId: insideLotId, kind: 'drawn', geometryWgs84: polygonAt(151.0, -33.8) as never },
    });
    await prisma.lotGeometry.create({
      data: {
        lotId: unassignedInsideLotId,
        kind: 'drawn',
        geometryWgs84: polygonAt(151.02, -33.82) as never,
      },
    });
    await prisma.lotGeometry.create({
      data: {
        lotId: outsideLotId,
        kind: 'drawn',
        geometryWgs84: polygonAt(155.0, -30.0) as never,
      },
    });

    // Photos: one inside linked to the assigned lot, one inside unlinked, one
    // outside the box.
    await prisma.document.create({
      data: {
        projectId,
        lotId: insideLotId,
        documentType: 'photo',
        filename: 'inside-linked.jpg',
        fileUrl: 'supabase://documents/inside-linked.jpg',
        gpsLatitude: -33.805,
        gpsLongitude: 151.002,
      },
    });
    await prisma.document.create({
      data: {
        projectId,
        documentType: 'photo',
        filename: 'inside-unlinked.jpg',
        fileUrl: 'supabase://documents/inside-unlinked.jpg',
        gpsLatitude: -33.806,
        gpsLongitude: 151.003,
      },
    });
    await prisma.document.create({
      data: {
        projectId,
        lotId: insideLotId,
        documentType: 'photo',
        filename: 'outside.jpg',
        fileUrl: 'supabase://documents/outside.jpg',
        gpsLatitude: -30.0,
        gpsLongitude: 155.0,
      },
    });

    // Test results on the assigned inside lot + the outside lot.
    await prisma.testResult.create({
      data: { projectId, lotId: insideLotId, testType: 'Compaction', status: 'requested' },
    });
    await prisma.testResult.create({
      data: { projectId, lotId: outsideLotId, testType: 'Density', status: 'requested' },
    });
  });

  afterAll(async () => {
    await prisma.testResult.deleteMany({ where: { projectId } });
    await prisma.document.deleteMany({ where: { projectId } });
    await prisma.lotGeometry.deleteMany({
      where: { lotId: { in: [insideLotId, unassignedInsideLotId, outsideLotId] } },
    });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompany: { projectId } } });
    await prisma.subcontractorCompany.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/spatial-search`)
      .send({ bounds: BOUNDS });
    expect(res.status).toBe(401);
  });

  it('rejects a cross-company non-member with 403', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/spatial-search`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ bounds: BOUNDS });
    expect(res.status).toBe(403);
  });

  it('rejects invalid bounds (west >= east)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/spatial-search`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ bounds: { west: 151.1, south: -33.9, east: 150.9, north: -33.7 } });
    expect(res.status).toBe(400);
  });

  it('returns intersecting lots, in-box photos, and their test results for a member', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/spatial-search`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ bounds: BOUNDS });
    expect(res.status).toBe(200);

    const lotIds = res.body.lots.map((l: { lotId: string }) => l.lotId).sort();
    expect(lotIds).toEqual([insideLotId, unassignedInsideLotId].sort());
    expect(lotIds).not.toContain(outsideLotId);

    // Both in-box photos (linked + unlinked) visible to an internal member.
    const filenames = res.body.photos.map((p: { filename: string }) => p.filename).sort();
    expect(filenames).toEqual(['inside-linked.jpg', 'inside-unlinked.jpg']);

    // Each photo carries its GPS coords so the map can pin it. Prisma Decimal
    // serialises as a string over JSON — the frontend Number()s it.
    const linked = res.body.photos.find(
      (p: { filename: string }) => p.filename === 'inside-linked.jpg',
    );
    expect(Number(linked.gpsLatitude)).toBeCloseTo(-33.805, 5);
    expect(Number(linked.gpsLongitude)).toBeCloseTo(151.002, 5);

    // Test results only for the intersecting lots.
    const trLotIds = res.body.testResults.map((t: { lotId: string }) => t.lotId);
    expect(trLotIds).toContain(insideLotId);
    expect(trLotIds).not.toContain(outsideLotId);
    const tr = res.body.testResults.find((t: { lotId: string }) => t.lotId === insideLotId);
    expect(tr).toMatchObject({ testType: 'Compaction', status: 'requested' });
    expect(tr.lotNumber).toContain('SS-INSIDE-');

    expect(res.body.lotsTruncated).toBe(false);
    expect(res.body.photosTruncated).toBe(false);
    expect(res.body.testResultsTruncated).toBe(false);
  });

  it('scopes a subcontractor to their assigned lots, photos, and test results', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/spatial-search`)
      .set('Authorization', `Bearer ${subbieToken}`)
      .send({ bounds: BOUNDS });
    expect(res.status).toBe(200);

    // Only the assigned inside lot — not the unassigned inside lot.
    expect(res.body.lots.map((l: { lotId: string }) => l.lotId)).toEqual([insideLotId]);

    // Only the photo linked to their assigned lot; the unlinked photo is hidden.
    expect(res.body.photos.map((p: { filename: string }) => p.filename)).toEqual([
      'inside-linked.jpg',
    ]);

    // Test results only for the assigned lot.
    expect(res.body.testResults.map((t: { lotId: string }) => t.lotId)).toEqual([insideLotId]);
  });

  it('photos-only mode returns the same photos as full mode, with other collections empty', async () => {
    const post = (body: object) =>
      request(app)
        .post(`/api/projects/${projectId}/spatial-search`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send(body);

    const full = await post({ bounds: BOUNDS });
    const only = await post({ bounds: BOUNDS, only: 'photos' });
    expect(only.status).toBe(200);

    const names = (r: typeof full) =>
      r.body.photos.map((p: { filename: string }) => p.filename).sort();
    expect(names(only)).toEqual(names(full));
    expect(names(only)).toEqual(['inside-linked.jpg', 'inside-unlinked.jpg']);

    // Coords still present so the map can pin without a second call.
    const linked = only.body.photos.find(
      (p: { filename: string }) => p.filename === 'inside-linked.jpg',
    );
    expect(Number(linked.gpsLatitude)).toBeCloseTo(-33.805, 5);

    // The skipped collections come back empty (shape unchanged for the layer).
    expect(only.body.lots).toEqual([]);
    expect(only.body.testResults).toEqual([]);
    expect(only.body.lotsTruncated).toBe(false);
    expect(only.body.testResultsTruncated).toBe(false);
    expect(only.body.photosTruncated).toBe(false);
  });

  it('photos-only preserves subcontractor photo scoping (identical set to full mode)', async () => {
    const post = (body: object) =>
      request(app)
        .post(`/api/projects/${projectId}/spatial-search`)
        .set('Authorization', `Bearer ${subbieToken}`)
        .send(body);

    const full = await post({ bounds: BOUNDS });
    const only = await post({ bounds: BOUNDS, only: 'photos' });
    expect(only.status).toBe(200);

    const names = (r: typeof full) =>
      r.body.photos.map((p: { filename: string }) => p.filename).sort();
    // Same scope helper => same photo set: only the photo on the assigned lot;
    // the unlinked in-box photo stays hidden in both modes.
    expect(names(only)).toEqual(names(full));
    expect(names(only)).toEqual(['inside-linked.jpg']);
    expect(only.body.lots).toEqual([]);
  });

  it('caps photos server-side at RESULT_CAP and flags truncation', async () => {
    // 501 in-box photos > RESULT_CAP (500) => DB take bounds the fetch, cap()
    // slices to 500 and flags truncation from the one extra row.
    await prisma.document.createMany({
      data: Array.from({ length: 501 }, (_, i) => ({
        projectId,
        documentType: 'photo',
        filename: `bulk-${i}.jpg`,
        fileUrl: `supabase://documents/bulk-${i}.jpg`,
        gpsLatitude: -33.8,
        gpsLongitude: 151.0,
      })),
    });
    try {
      const res = await request(app)
        .post(`/api/projects/${projectId}/spatial-search`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ bounds: BOUNDS, only: 'photos' });
      expect(res.status).toBe(200);
      expect(res.body.photos.length).toBe(500);
      expect(res.body.photosTruncated).toBe(true);
    } finally {
      await prisma.document.deleteMany({
        where: { projectId, filename: { startsWith: 'bulk-' } },
      });
    }
  });
});
