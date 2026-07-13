import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { controlLinesRouter } from './index.js';
import { extractSetoutRawCandidate } from './setoutExtraction.js';

// Only the AI network call is mocked; cleanSetoutCandidate (the trust boundary)
// runs for real so the route genuinely validates model output end to end.
vi.mock('./setoutExtraction.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./setoutExtraction.js')>();
  return { ...actual, extractSetoutRawCandidate: vi.fn() };
});
const mockedExtract = vi.mocked(extractSetoutRawCandidate);

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', controlLinesRouter);
app.use(errorHandler);

const POINTS = [
  { chainage: 0, easting: 500_000, northing: 6_000_000 },
  { chainage: 100, easting: 500_100, northing: 6_000_000 },
];

function createBody(overrides: Record<string, unknown> = {}) {
  return { name: 'MC00 Mainline', coordinateSystem: 'EPSG:7855', points: POINTS, ...overrides };
}

describe('Control Lines API', () => {
  let companyId: string;
  let otherCompanyId: string;
  let pmToken: string;
  let viewerToken: string;
  let subbieToken: string;
  let outsiderToken: string;
  let projectId: string;
  let siblingProjectId: string; // same company, pm is also a member

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `CL Co ${stamp}` } })).id;
    otherCompanyId = (await prisma.company.create({ data: { name: `CL Other ${stamp}` } })).id;

    const pm = await registerTestUser(app, {
      emailPrefix: 'cl-pm',
      fullName: 'CL PM',
      companyId,
      roleInCompany: 'project_manager',
    });
    pmToken = pm.token;

    const viewer = await registerTestUser(app, {
      emailPrefix: 'cl-viewer',
      fullName: 'CL Viewer',
      companyId,
      roleInCompany: 'viewer',
    });
    viewerToken = viewer.token;

    const subbie = await registerTestUser(app, {
      emailPrefix: 'cl-subbie',
      fullName: 'CL Subbie',
      companyId,
      roleInCompany: 'subcontractor',
    });
    subbieToken = subbie.token;

    const outsider = await registerTestUser(app, {
      emailPrefix: 'cl-outsider',
      fullName: 'CL Outsider',
      companyId: otherCompanyId,
      roleInCompany: 'project_manager',
    });
    outsiderToken = outsider.token;

    const project = await prisma.project.create({
      data: {
        name: `CL Project ${stamp}`,
        projectNumber: `CL-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    const sibling = await prisma.project.create({
      data: {
        name: `CL Sibling ${stamp}`,
        projectNumber: `CLS-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    siblingProjectId = sibling.id;

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
    await prisma.controlLine.deleteMany({
      where: { projectId: { in: [projectId, siblingProjectId] } },
    });
    await prisma.projectUser.deleteMany({
      where: { projectId: { in: [projectId, siblingProjectId] } },
    });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, siblingProjectId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/control-lines`);
    expect(res.status).toBe(401);
  });

  it('rejects a non-member (cross-company) with 403', async () => {
    const listRes = await request(app)
      .get(`/api/projects/${projectId}/control-lines`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(listRes.status).toBe(403);

    const createRes = await request(app)
      .post(`/api/projects/${projectId}/control-lines`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send(createBody());
    expect(createRes.status).toBe(403);
  });

  it('denies write to a read-only member (viewer) and a subcontractor', async () => {
    const viewerRes = await request(app)
      .post(`/api/projects/${projectId}/control-lines`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(createBody());
    expect(viewerRes.status).toBe(403);

    const subbieRes = await request(app)
      .get(`/api/projects/${projectId}/control-lines`)
      .set('Authorization', `Bearer ${subbieToken}`);
    expect(subbieRes.status).toBe(403); // control lines are internal engineering data
  });

  it('runs the full CRUD lifecycle for an authorised writer', async () => {
    // Create
    const created = await request(app)
      .post(`/api/projects/${projectId}/control-lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send(createBody());
    expect(created.status).toBe(201);
    const line = created.body.controlLine;
    expect(line.id).toBeTruthy();
    expect(line.geometryWgs84.geometry.type).toBe('LineString');
    expect(line.geometryWgs84.geometry.coordinates).toHaveLength(2);
    expect(line.createdById).toBeTruthy();

    // A viewer can read it
    const viewerList = await request(app)
      .get(`/api/projects/${projectId}/control-lines`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewerList.status).toBe(200);
    expect(viewerList.body.controlLines).toHaveLength(1);

    // Get by id
    const fetched = await request(app)
      .get(`/api/projects/${projectId}/control-lines/${line.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.controlLine.name).toBe('MC00 Mainline');

    // Same line requested under a sibling project the writer also belongs to → 404 (project-scoped)
    const mismatched = await request(app)
      .get(`/api/projects/${siblingProjectId}/control-lines/${line.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(mismatched.status).toBe(404);

    // Patch name only (geometry cache unchanged)
    const renamed = await request(app)
      .patch(`/api/projects/${projectId}/control-lines/${line.id}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'MC00 Renamed' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.controlLine.name).toBe('MC00 Renamed');

    // Patch points → geometry cache recomputed
    const repointed = await request(app)
      .patch(`/api/projects/${projectId}/control-lines/${line.id}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ points: [...POINTS, { chainage: 200, easting: 500_200, northing: 6_000_000 }] });
    expect(repointed.status).toBe(200);
    expect(repointed.body.controlLine.geometryWgs84.geometry.coordinates).toHaveLength(3);

    // Delete
    const deleted = await request(app)
      .delete(`/api/projects/${projectId}/control-lines/${line.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(deleted.status).toBe(200);

    const gone = await request(app)
      .get(`/api/projects/${projectId}/control-lines/${line.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(gone.status).toBe(404);
  });

  it('validates the create payload', async () => {
    const tooFewPoints = await request(app)
      .post(`/api/projects/${projectId}/control-lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send(createBody({ points: [POINTS[0]] }));
    expect(tooFewPoints.status).toBe(400);

    const badEpsg = await request(app)
      .post(`/api/projects/${projectId}/control-lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send(createBody({ coordinateSystem: 'EPSG:9999' }));
    expect(badEpsg.status).toBe(400);

    const missingName = await request(app)
      .post(`/api/projects/${projectId}/control-lines`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send(createBody({ name: '' }));
    expect(missingName.status).toBe(400);
  });

  describe('POST /control-lines/extract-points (AI setout import)', () => {
    const PDF = Buffer.from('%PDF-1.4 fake setout sheet');

    function extractReq(token: string) {
      return request(app)
        .post(`/api/projects/${projectId}/control-lines/extract-points`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', PDF, { filename: 'setout.pdf', contentType: 'application/pdf' });
    }

    it('returns a cleaned candidate for an authorised writer', async () => {
      mockedExtract.mockResolvedValueOnce({
        coordinateSystem: 'EPSG:7856',
        points: [
          { chainage: 100, easting: 500100, northing: 6000000 },
          { chainage: 0, easting: 500000, northing: 6000000 },
        ],
      });

      const res = await extractReq(pmToken);
      expect(res.status).toBe(200);
      expect(res.body.candidate.coordinateSystem).toBe('EPSG:7856');
      // sorted ascending by chainage
      expect(res.body.candidate.points.map((p: { chainage: number }) => p.chainage)).toEqual([
        0, 100,
      ]);
      expect(res.body.candidate.warnings).toEqual([]);
    });

    it('drops garbage rows and nulls an unsupported EPSG with warnings', async () => {
      mockedExtract.mockResolvedValueOnce({
        coordinateSystem: 'EPSG:9999',
        points: [
          { chainage: 0, easting: 500000, northing: 6000000 },
          { chainage: 'bad', easting: 'x', northing: 'y' },
          { chainage: 50, easting: 500050, northing: 6000000 },
        ],
      });

      const res = await extractReq(pmToken);
      expect(res.status).toBe(200);
      expect(res.body.candidate.coordinateSystem).toBeNull();
      expect(res.body.candidate.points).toHaveLength(2);
      expect(res.body.candidate.warnings.length).toBeGreaterThanOrEqual(2);
    });

    it('returns 400 when fewer than 2 valid points are extracted', async () => {
      mockedExtract.mockResolvedValueOnce({
        coordinateSystem: 'EPSG:7856',
        points: [{ chainage: 0, easting: 1, northing: 2 }],
      });

      const res = await extractReq(pmToken);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SETOUT_EXTRACTION_INSUFFICIENT');
    });

    it('denies a viewer, a subcontractor, and a cross-company outsider', async () => {
      mockedExtract.mockResolvedValue({
        coordinateSystem: 'EPSG:7856',
        points: [
          { chainage: 0, easting: 1, northing: 2 },
          { chainage: 1, easting: 3, northing: 4 },
        ],
      });

      expect((await extractReq(viewerToken)).status).toBe(403);
      expect((await extractReq(subbieToken)).status).toBe(403);
      expect((await extractReq(outsiderToken)).status).toBe(403);
      mockedExtract.mockReset();
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/control-lines/extract-points`)
        .attach('file', PDF, { filename: 'setout.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(401);
    });

    it('rejects a disallowed file type', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/control-lines/extract-points`)
        .set('Authorization', `Bearer ${pmToken}`)
        .attach('file', Buffer.from('<svg/>'), {
          filename: 'evil.svg',
          contentType: 'image/svg+xml',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /control-lines/import (LandXML/DXF)', () => {
    const LANDXML = Buffer.from(
      `<?xml version="1.0"?><LandXML><Alignments>
         <Alignment name="MC01" staStart="1000">
           <CoordGeom>
             <Line><Start>6250000 500000</Start><End>6250000 500100</End></Line>
           </CoordGeom>
         </Alignment>
       </Alignments></LandXML>`,
    );
    const DXF = Buffer.from(
      [
        '0',
        'SECTION',
        '2',
        'ENTITIES',
        '0',
        'LINE',
        '8',
        'CL',
        '10',
        '0',
        '20',
        '0',
        '11',
        '30',
        '21',
        '40',
        '0',
        'ENDSEC',
        '0',
        'EOF',
      ].join('\n'),
    );

    function importReq(token: string, buf: Buffer, filename: string) {
      return request(app)
        .post(`/api/projects/${projectId}/control-lines/import`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', buf, { filename });
    }

    it('parses a LandXML alignment into a preview for an authorised writer', async () => {
      const res = await importReq(pmToken, LANDXML, 'design.landxml');
      expect(res.status).toBe(200);
      expect(res.body.format).toBe('landxml');
      expect(res.body.alignments).toHaveLength(1);
      const a = res.body.alignments[0];
      expect(a.name).toBe('MC01');
      expect(a.chainageStart).toBe(1000);
      expect(a.chainageEnd).toBe(1100);
      expect(a.points[0]).toEqual({ chainage: 1000, easting: 500000, northing: 6250000 });
    });

    it('parses a DXF LINE into a preview', async () => {
      const res = await importReq(pmToken, DXF, 'plan.dxf');
      expect(res.status).toBe(200);
      expect(res.body.format).toBe('dxf');
      expect(res.body.alignments[0].name).toBe('CL');
      expect(res.body.alignments[0].lengthM).toBe(50);
    });

    it('returns 400 for a file with no alignments', async () => {
      const res = await importReq(pmToken, Buffer.from('<LandXML/>'), 'empty.xml');
      expect(res.status).toBe(400);
    });

    it('rejects a disallowed file extension', async () => {
      const res = await importReq(pmToken, LANDXML, 'design.txt');
      expect(res.status).toBe(400);
    });

    it('denies a viewer, a subcontractor, and a cross-company outsider', async () => {
      expect((await importReq(viewerToken, LANDXML, 'd.landxml')).status).toBe(403);
      expect((await importReq(subbieToken, LANDXML, 'd.landxml')).status).toBe(403);
      expect((await importReq(outsiderToken, LANDXML, 'd.landxml')).status).toBe(403);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/control-lines/import`)
        .attach('file', LANDXML, { filename: 'd.landxml' });
      expect(res.status).toBe(401);
    });
  });
});
