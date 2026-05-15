import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { projectsRouter } from './projects.js';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use(errorHandler);

describe('Projects API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Projects Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create test user
    const testEmail = `projects-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Projects Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          projectNumber: `PROJ-${Date.now()}`,
          state: 'NSW',
          specificationSet: 'TfNSW',
        });

      expect(res.status).toBe(201);
      expect(res.body.project).toBeDefined();
      expect(res.body.project.name).toBe('Test Project');
      projectId = res.body.project.id;
    });

    it('should reject project without name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectNumber: 'NO-NAME',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });

    it('should reject malformed project create fields', async () => {
      const malformedName = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: { value: 'Bad Project' },
          projectNumber: `BAD-NAME-${Date.now()}`,
        });

      expect(malformedName.status).toBe(400);

      const invalidDate = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Date Project',
          projectNumber: `BAD-DATE-${Date.now()}`,
          startDate: 'not-a-date',
        });

      expect(invalidDate.status).toBe(400);

      const invalidCalendarDate = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Calendar Date Project',
          projectNumber: `BAD-CALENDAR-DATE-${Date.now()}`,
          startDate: '2026-02-30',
        });

      expect(invalidCalendarDate.status).toBe(400);

      const invalidCalendarDateTime = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Calendar DateTime Project',
          projectNumber: `BAD-CALENDAR-DATETIME-${Date.now()}`,
          targetCompletion: '2026-02-30T10:00:00Z',
        });

      expect(invalidCalendarDateTime.status).toBe(400);

      const invalidContractValue = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Contract Project',
          projectNumber: `BAD-CONTRACT-${Date.now()}`,
          contractValue: -1,
        });

      expect(invalidContractValue.status).toBe(400);

      const encodedContractValue = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Encoded Contract Project',
          projectNumber: `BAD-CONTRACT-ENCODED-${Date.now()}`,
          contractValue: '1e2',
        });

      expect(encodedContractValue.status).toBe(400);

      const hexContractValue = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Hex Contract Project',
          projectNumber: `BAD-CONTRACT-HEX-${Date.now()}`,
          contractValue: '0x10',
        });

      expect(hexContractValue.status).toBe(400);
    });

    it('should reject subcontractor users from creating company projects', async () => {
      const suffix = Date.now();
      const subcontractorEmail = `project-create-sub-${suffix}@example.com`;
      const subcontractorRes = await request(app).post('/api/auth/register').send({
        email: subcontractorEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Project Create Subcontractor',
        tosAccepted: true,
      });
      const subcontractorToken = subcontractorRes.body.token;
      const subcontractorId = subcontractorRes.body.user.id;
      const projectNumber = `SUB-CREATE-BLOCKED-${suffix}`;

      await prisma.user.update({
        where: { id: subcontractorId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });

      try {
        const res = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            name: 'Blocked Subcontractor Project',
            projectNumber,
            state: 'NSW',
            specificationSet: 'TfNSW',
          });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('Only company admins and project managers');
        await expect(prisma.project.count({ where: { projectNumber } })).resolves.toBe(0);
      } finally {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: subcontractorId } });
        await prisma.user.delete({ where: { id: subcontractorId } }).catch(() => {});
      }
    });

    it('should reject subcontractor-linked users without a company from bootstrapping a new company', async () => {
      const suffix = Date.now();
      const setupProject = await prisma.project.create({
        data: {
          companyId,
          name: `Subcontractor Bootstrap Setup ${suffix}`,
          projectNumber: `SUB-BOOTSTRAP-SETUP-${suffix}`,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId: setupProject.id,
          companyName: `Bootstrap Blocked Subcontractor ${suffix}`,
          status: 'approved',
        },
      });
      const subcontractorRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `project-bootstrap-sub-${suffix}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Bootstrap Blocked Subcontractor',
          tosAccepted: true,
        });
      const subcontractorToken = subcontractorRes.body.token;
      const subcontractorId = subcontractorRes.body.user.id;
      const blockedProjectNumber = `SUB-BOOTSTRAP-BLOCKED-${suffix}`;

      await prisma.user.update({
        where: { id: subcontractorId },
        data: { companyId: null, roleInCompany: 'subcontractor_admin' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractorId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'admin',
        },
      });

      let bootstrappedCompanyId: string | null = null;
      let bootstrappedProjectId: string | null = null;

      try {
        const res = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            name: 'Blocked Bootstrap Project',
            projectNumber: blockedProjectNumber,
            state: 'NSW',
            specificationSet: 'TfNSW',
          });

        const updatedUser = await prisma.user.findUnique({
          where: { id: subcontractorId },
          select: { companyId: true, roleInCompany: true },
        });
        bootstrappedCompanyId = updatedUser?.companyId ?? null;
        const bootstrappedProject = await prisma.project.findFirst({
          where: { projectNumber: blockedProjectNumber },
          select: { id: true },
        });
        bootstrappedProjectId = bootstrappedProject?.id ?? null;

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('Subcontractor portal users');
        expect(updatedUser?.companyId).toBeNull();
        expect(updatedUser?.roleInCompany).toBe('subcontractor_admin');
        expect(bootstrappedProject).toBeNull();
      } finally {
        if (bootstrappedProjectId) {
          await prisma.projectUser.deleteMany({ where: { projectId: bootstrappedProjectId } });
          await prisma.project.delete({ where: { id: bootstrappedProjectId } }).catch(() => {});
        }
        await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractorId } });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await prisma.project.delete({ where: { id: setupProject.id } }).catch(() => {});
        await prisma.emailVerificationToken.deleteMany({ where: { userId: subcontractorId } });
        await prisma.user.delete({ where: { id: subcontractorId } }).catch(() => {});
        if (bootstrappedCompanyId) {
          await prisma.company.delete({ where: { id: bootstrappedCompanyId } }).catch(() => {});
        }
      }
    });

    it('should auto-generate project number if not provided', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Auto Number Project',
          state: 'NSW',
          specificationSet: 'TfNSW',
        });

      expect(res.status).toBe(201);
      expect(res.body.project.projectNumber).toBeDefined();
      expect(res.body.project.projectNumber).toMatch(/^PRJ-/);

      // Cleanup
      await prisma.projectUser.deleteMany({ where: { projectId: res.body.project.id } });
      await prisma.project.delete({ where: { id: res.body.project.id } });
    });

    it('should enforce the basic subscription project limit', async () => {
      const suffix = Date.now();
      const limitCompany = await prisma.company.create({
        data: {
          name: `Basic Project Limit Company ${suffix}`,
          subscriptionTier: 'basic',
        },
      });
      const adminEmail = `basic-project-limit-admin-${suffix}@example.com`;
      const adminRes = await request(app).post('/api/auth/register').send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Basic Project Limit Admin',
        tosAccepted: true,
      });
      const adminToken = adminRes.body.token;
      const adminId = adminRes.body.user.id;

      await prisma.user.update({
        where: { id: adminId },
        data: { companyId: limitCompany.id, roleInCompany: 'admin' },
      });

      await Promise.all(
        Array.from({ length: 3 }, (_, index) =>
          prisma.project.create({
            data: {
              name: `Basic Limit Existing Project ${index}`,
              projectNumber: `BASIC-LIMIT-${suffix}-${index}`,
              companyId: limitCompany.id,
              status: 'active',
              state: 'NSW',
              specificationSet: 'TfNSW',
            },
          }),
        ),
      );

      try {
        const res = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Blocked Basic Limit Project',
            projectNumber: `BASIC-LIMIT-BLOCKED-${suffix}`,
          });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('basic subscription allows up to 3 projects');
        await expect(prisma.project.count({ where: { companyId: limitCompany.id } })).resolves.toBe(
          3,
        );
      } finally {
        const projects = await prisma.project.findMany({
          where: { companyId: limitCompany.id },
          select: { id: true },
        });
        await prisma.projectUser.deleteMany({
          where: { projectId: { in: projects.map((project) => project.id) } },
        });
        await prisma.project.deleteMany({ where: { companyId: limitCompany.id } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: adminId } });
        await prisma.user.delete({ where: { id: adminId } }).catch(() => {});
        await prisma.company.delete({ where: { id: limitCompany.id } }).catch(() => {});
      }
    });

    it('should allow unlimited tier companies to exceed the basic project cap', async () => {
      const suffix = Date.now();
      const unlimitedCompany = await prisma.company.create({
        data: {
          name: `Unlimited Project Limit Company ${suffix}`,
          subscriptionTier: 'unlimited',
        },
      });
      const adminEmail = `unlimited-project-limit-admin-${suffix}@example.com`;
      const adminRes = await request(app).post('/api/auth/register').send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Unlimited Project Limit Admin',
        tosAccepted: true,
      });
      const adminToken = adminRes.body.token;
      const adminId = adminRes.body.user.id;

      await prisma.user.update({
        where: { id: adminId },
        data: { companyId: unlimitedCompany.id, roleInCompany: 'admin' },
      });

      await Promise.all(
        Array.from({ length: 3 }, (_, index) =>
          prisma.project.create({
            data: {
              name: `Unlimited Existing Project ${index}`,
              projectNumber: `UNLIMITED-LIMIT-${suffix}-${index}`,
              companyId: unlimitedCompany.id,
              status: 'active',
              state: 'NSW',
              specificationSet: 'TfNSW',
            },
          }),
        ),
      );

      try {
        const res = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Unlimited Additional Project',
            projectNumber: `UNLIMITED-LIMIT-ADDED-${suffix}`,
          });

        expect(res.status).toBe(201);
        expect(res.body.project.name).toBe('Unlimited Additional Project');
        await expect(
          prisma.project.count({ where: { companyId: unlimitedCompany.id } }),
        ).resolves.toBe(4);
      } finally {
        const projects = await prisma.project.findMany({
          where: { companyId: unlimitedCompany.id },
          select: { id: true },
        });
        await prisma.projectUser.deleteMany({
          where: { projectId: { in: projects.map((project) => project.id) } },
        });
        await prisma.project.deleteMany({ where: { companyId: unlimitedCompany.id } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: adminId } });
        await prisma.user.delete({ where: { id: adminId } }).catch(() => {});
        await prisma.company.delete({ where: { id: unlimitedCompany.id } }).catch(() => {});
      }
    });
  });

  describe('GET /api/projects', () => {
    it('should list accessible projects', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.projects).toBeDefined();
      expect(Array.isArray(res.body.projects)).toBe(true);
    });

    it('should include newly created project in list', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const projects = res.body.projects as Array<{ id: string }>;
      const found = projects.find((p) => p.id === projectId);
      expect(found).toBeDefined();
    });

    it('should not expose same-company projects without active project access', async () => {
      const viewerEmail = `projects-viewer-${Date.now()}@example.com`;
      const viewerRes = await request(app).post('/api/auth/register').send({
        email: viewerEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Projects Viewer',
        tosAccepted: true,
      });
      const viewerToken = viewerRes.body.token;
      const viewerId = viewerRes.body.user.id;

      await prisma.user.update({
        where: { id: viewerId },
        data: { companyId, roleInCompany: 'viewer' },
      });

      try {
        const listWithoutMembership = await request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(listWithoutMembership.status).toBe(200);
        expect(
          (listWithoutMembership.body.projects as Array<{ id: string }>).some(
            (p) => p.id === projectId,
          ),
        ).toBe(false);

        const detailWithoutMembership = await request(app)
          .get(`/api/projects/${projectId}`)
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(detailWithoutMembership.status).toBe(403);

        await prisma.projectUser.create({
          data: {
            projectId,
            userId: viewerId,
            role: 'viewer',
            status: 'pending',
          },
        });

        const listWithPendingMembership = await request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(listWithPendingMembership.status).toBe(200);
        expect(
          (listWithPendingMembership.body.projects as Array<{ id: string }>).some(
            (p) => p.id === projectId,
          ),
        ).toBe(false);

        const detailWithPendingMembership = await request(app)
          .get(`/api/projects/${projectId}`)
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(detailWithPendingMembership.status).toBe(403);
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: viewerId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: viewerId } });
        await prisma.user.delete({ where: { id: viewerId } }).catch(() => {});
      }
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get a single project', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.project).toBeDefined();
      expect(res.body.project.id).toBe(projectId);
    });

    it('sanitizes subcontractor project payloads and hides suspended project links', async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          contractValue: '123456.78',
          settings: JSON.stringify({
            hpRecipients: [{ email: 'internal-project-recipient@example.com' }],
            enabledModules: { holdPoints: true },
          }),
          workingHoursStart: '06:00',
          workingHoursEnd: '18:00',
          workingDays: '1,2,3,4,5',
        },
      });

      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Projects Subcontractor ${Date.now()}`,
          status: 'approved',
          portalAccess: { documents: true },
        },
      });
      const email = `projects-subcontractor-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Projects Subcontractor',
        tosAccepted: true,
      });
      const subcontractorToken = regRes.body.token;
      const subcontractorUserId = regRes.body.user.id;

      await prisma.user.update({
        where: { id: subcontractorUserId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractorUserId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'user',
        },
      });

      try {
        const listRes = await request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(listRes.status).toBe(200);
        const listedProject = (
          listRes.body.projects as Array<{ id: string; contractValue: unknown }>
        ).find((p) => p.id === projectId);
        expect(listedProject).toBeDefined();
        expect(listedProject?.contractValue).toBeNull();

        const detailRes = await request(app)
          .get(`/api/projects/${projectId}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(detailRes.status).toBe(200);
        expect(detailRes.body.project.contractValue).toBeNull();
        expect(detailRes.body.project.settings).toBeNull();
        expect(detailRes.body.project.workingHoursStart).toBeNull();
        expect(detailRes.body.project.workingHoursEnd).toBeNull();
        expect(detailRes.body.project.workingDays).toBeNull();

        await prisma.subcontractorCompany.update({
          where: { id: subcontractorCompany.id },
          data: { status: 'suspended' },
        });

        const suspendedListRes = await request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(suspendedListRes.status).toBe(200);
        expect(
          (suspendedListRes.body.projects as Array<{ id: string }>).some((p) => p.id === projectId),
        ).toBe(false);

        const suspendedDetailRes = await request(app)
          .get(`/api/projects/${projectId}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(suspendedDetailRes.status).toBe(403);
      } finally {
        await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractorUserId } });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await prisma.emailVerificationToken.deleteMany({ where: { userId: subcontractorUserId } });
        await prisma.user.delete({ where: { id: subcontractorUserId } }).catch(() => {});
        await prisma.project
          .update({
            where: { id: projectId },
            data: {
              contractValue: null,
              settings: null,
              workingHoursStart: '07:00',
              workingHoursEnd: '17:00',
              workingDays: '1,2,3,4,5',
            },
          })
          .catch(() => {});
      }
    });

    it('should not grant suspended subcontractors project internals through project team memberships', async () => {
      const suffix = Date.now();
      const guardedProject = await prisma.project.create({
        data: {
          companyId,
          name: `Guarded Project ${suffix}`,
          projectNumber: `GUARDED-${suffix}`,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId: guardedProject.id,
          companyName: `Suspended Project Team Subcontractor ${suffix}`,
          status: 'suspended',
        },
      });
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `projects-suspended-team-sub-${suffix}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Suspended Project Team Subcontractor',
          tosAccepted: true,
        });
      const subcontractorToken = regRes.body.token;
      const subcontractorUserId = regRes.body.user.id;

      await prisma.user.update({
        where: { id: subcontractorUserId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractorUserId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'user',
        },
      });
      await prisma.projectUser.create({
        data: {
          projectId: guardedProject.id,
          userId: subcontractorUserId,
          role: 'project_manager',
          status: 'active',
        },
      });
      const guardedArea = await prisma.projectArea.create({
        data: {
          projectId: guardedProject.id,
          name: `Guarded Area ${suffix}`,
          chainageStart: 0,
          chainageEnd: 100,
          colour: '#3B82F6',
        },
      });

      try {
        const listRes = await request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(listRes.status).toBe(200);
        expect(
          (listRes.body.projects as Array<{ id: string }>).some(
            (project) => project.id === guardedProject.id,
          ),
        ).toBe(false);

        const detailRes = await request(app)
          .get(`/api/projects/${guardedProject.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(detailRes.status).toBe(403);

        const dashboardRes = await request(app)
          .get(`/api/projects/${guardedProject.id}/dashboard`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(dashboardRes.status).toBe(403);

        const usersRes = await request(app)
          .get(`/api/projects/${guardedProject.id}/users`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(usersRes.status).toBe(403);

        const auditLogsRes = await request(app)
          .get(`/api/projects/${guardedProject.id}/audit-logs`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(auditLogsRes.status).toBe(403);

        const areasRes = await request(app)
          .get(`/api/projects/${guardedProject.id}/areas`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(areasRes.status).toBe(403);

        const createAreaRes = await request(app)
          .post(`/api/projects/${guardedProject.id}/areas`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            name: `Subcontractor Area ${suffix}`,
            chainageStart: 100,
            chainageEnd: 200,
            colour: '#22C55E',
          });

        expect(createAreaRes.status).toBe(403);

        const updateAreaRes = await request(app)
          .patch(`/api/projects/${guardedProject.id}/areas/${guardedArea.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({ name: `Subcontractor Updated Area ${suffix}` });

        expect(updateAreaRes.status).toBe(403);

        const deleteAreaRes = await request(app)
          .delete(`/api/projects/${guardedProject.id}/areas/${guardedArea.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(deleteAreaRes.status).toBe(403);

        const patchRes = await request(app)
          .patch(`/api/projects/${guardedProject.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({ name: `Subcontractor Updated Project ${suffix}` });

        expect(patchRes.status).toBe(403);

        const unchangedProject = await prisma.project.findUnique({
          where: { id: guardedProject.id },
          select: { name: true },
        });
        expect(unchangedProject?.name).toBe(guardedProject.name);

        const unchangedArea = await prisma.projectArea.findUnique({
          where: { id: guardedArea.id },
          select: { name: true },
        });
        expect(unchangedArea?.name).toBe(guardedArea.name);
      } finally {
        await prisma.projectArea.deleteMany({ where: { projectId: guardedProject.id } });
        await prisma.projectUser.deleteMany({
          where: { projectId: guardedProject.id, userId: subcontractorUserId },
        });
        await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractorUserId } });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await prisma.emailVerificationToken.deleteMany({ where: { userId: subcontractorUserId } });
        await prisma.user.delete({ where: { id: subcontractorUserId } }).catch(() => {});
        await prisma.project.delete({ where: { id: guardedProject.id } }).catch(() => {});
      }
    });

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .get('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject oversized project route parameters before project lookups', async () => {
      const longId = 'p'.repeat(129);
      const cases = [
        () => request(app).get(`/api/projects/${longId}`),
        () => request(app).get(`/api/projects/${longId}/dashboard`),
        () => request(app).get(`/api/projects/${longId}/costs`),
        () => request(app).patch(`/api/projects/${longId}`).send({}),
        () =>
          request(app).delete(`/api/projects/${longId}`).send({ password: 'SecureP@ssword123!' }),
        () => request(app).get(`/api/projects/${longId}/users`),
        () =>
          request(app)
            .post(`/api/projects/${longId}/users`)
            .send({ email: 'user@example.com', role: 'viewer' }),
        () =>
          request(app).patch(`/api/projects/${projectId}/users/${longId}`).send({ role: 'viewer' }),
        () => request(app).delete(`/api/projects/${projectId}/users/${longId}`),
        () => request(app).get(`/api/projects/${longId}/audit-logs`),
        () => request(app).get(`/api/projects/${longId}/areas`),
        () =>
          request(app)
            .post(`/api/projects/${longId}/areas`)
            .send({ name: 'Area', chainageStart: 0, chainageEnd: 1 }),
        () =>
          request(app).patch(`/api/projects/${projectId}/areas/${longId}`).send({ name: 'Area' }),
        () => request(app).delete(`/api/projects/${projectId}/areas/${longId}`),
      ];

      for (const makeRequest of cases) {
        const res = await makeRequest().set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('too long');
      }
    });
  });

  describe('GET /api/projects/:id/costs', () => {
    it('allows commercial roles and rejects active project viewers', async () => {
      const adminRes = await request(app)
        .get(`/api/projects/${projectId}/costs`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.summary).toBeDefined();

      const viewerEmail = `projects-cost-viewer-${Date.now()}@example.com`;
      const viewerRes = await request(app).post('/api/auth/register').send({
        email: viewerEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Projects Cost Viewer',
        tosAccepted: true,
      });
      const viewerToken = viewerRes.body.token;
      const viewerId = viewerRes.body.user.id;

      await prisma.user.update({
        where: { id: viewerId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: viewerId, role: 'viewer', status: 'active' },
      });

      try {
        const deniedRes = await request(app)
          .get(`/api/projects/${projectId}/costs`)
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(deniedRes.status).toBe(403);
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: viewerId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: viewerId } });
        await prisma.user.delete({ where: { id: viewerId } }).catch(() => {});
      }
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('should update project settings', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Project Name',
          lotPrefix: 'LOT-',
          lotStartingNumber: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.project.name).toBe('Updated Project Name');
    });

    it('should reject empty project name', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '',
        });

      expect(res.status).toBe(400);
    });

    it('should validate chainage range', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          chainageStart: 100,
          chainageEnd: 50, // Invalid: end < start
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('greater than');
    });

    it('should reject malformed project update fields', async () => {
      const malformedName = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: { value: 'Bad Update' },
        });

      expect(malformedName.status).toBe(400);

      const invalidWorkingHours = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workingHoursStart: '18:00',
          workingHoursEnd: '07:00',
        });

      expect(invalidWorkingHours.status).toBe(400);

      const invalidSettings = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          settings: 'not-an-object',
        });

      expect(invalidSettings.status).toBe(400);

      const encodedChainage = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          chainageStart: '1e2',
        });

      expect(encodedChainage.status).toBe(400);

      const encodedLotStartingNumber = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lotStartingNumber: '1e2',
        });

      expect(encodedLotStartingNumber.status).toBe(400);
    });

    it('should validate partial chainage updates against existing project bounds', async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          chainageStart: 0,
          chainageEnd: 100,
        },
      });

      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          chainageStart: 150,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('greater than');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should reject malformed password confirmation', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: { value: 'SecureP@ssword123!' } });

      expect(res.status).toBe(400);
    });

    it('should reject same-company viewers even with a valid password', async () => {
      const viewerEmail = `projects-delete-viewer-${Date.now()}@example.com`;
      const viewerPassword = 'SecureP@ssword123!';
      const viewerRes = await request(app).post('/api/auth/register').send({
        email: viewerEmail,
        password: viewerPassword,
        fullName: 'Delete Viewer',
        tosAccepted: true,
      });
      const viewerToken = viewerRes.body.token;
      const viewerId = viewerRes.body.user.id;

      await prisma.user.update({
        where: { id: viewerId },
        data: { companyId, roleInCompany: 'viewer' },
      });

      try {
        const res = await request(app)
          .delete(`/api/projects/${projectId}`)
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({ password: viewerPassword });

        expect(res.status).toBe(403);

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        expect(project).not.toBeNull();
      } finally {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: viewerId } });
        await prisma.user.delete({ where: { id: viewerId } }).catch(() => {});
      }
    });
  });

  describe('Project Areas', () => {
    const areaIds: string[] = [];

    afterAll(async () => {
      if (areaIds.length > 0) {
        await prisma.projectArea.deleteMany({ where: { id: { in: areaIds } } });
      }
    });

    it('should create a project area', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/areas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'North Zone',
          chainageStart: 0,
          chainageEnd: 100,
          colour: '#3B82F6',
        });

      expect(res.status).toBe(201);
      expect(res.body.area.name).toBe('North Zone');
      areaIds.push(res.body.area.id);
    });

    it('should reject malformed project area create fields', async () => {
      const malformedName = await request(app)
        .post(`/api/projects/${projectId}/areas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: { value: 'Bad Area' },
          chainageStart: 0,
          chainageEnd: 100,
          colour: '#3B82F6',
        });

      expect(malformedName.status).toBe(400);

      const invalidColour = await request(app)
        .post(`/api/projects/${projectId}/areas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Bad Colour',
          chainageStart: 0,
          chainageEnd: 100,
          colour: 'blue',
        });

      expect(invalidColour.status).toBe(400);

      const invalidChainage = await request(app)
        .post(`/api/projects/${projectId}/areas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Bad Chainage',
          chainageStart: 100,
          chainageEnd: 50,
          colour: '#3B82F6',
        });

      expect(invalidChainage.status).toBe(400);

      const encodedChainage = await request(app)
        .post(`/api/projects/${projectId}/areas`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Encoded Chainage',
          chainageStart: '0x10',
          chainageEnd: 100,
          colour: '#3B82F6',
        });

      expect(encodedChainage.status).toBe(400);
    });

    it('should reject malformed project area update fields', async () => {
      const area = await prisma.projectArea.create({
        data: {
          projectId,
          name: 'Patch Area',
          chainageStart: 0,
          chainageEnd: 100,
          colour: '#3B82F6',
        },
      });
      areaIds.push(area.id);

      const malformedName = await request(app)
        .patch(`/api/projects/${projectId}/areas/${area.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: { value: 'Bad Patch' } });

      expect(malformedName.status).toBe(400);

      const invalidColour = await request(app)
        .patch(`/api/projects/${projectId}/areas/${area.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ colour: 'red' });

      expect(invalidColour.status).toBe(400);

      const invalidChainage = await request(app)
        .patch(`/api/projects/${projectId}/areas/${area.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ chainageStart: 150 });

      expect(invalidChainage.status).toBe(400);

      const encodedChainage = await request(app)
        .patch(`/api/projects/${projectId}/areas/${area.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ chainageEnd: '1e2' });

      expect(encodedChainage.status).toBe(400);
    });
  });
});

describe('Project Team Management', () => {
  let authToken: string;
  let userId: string;
  let secondUserId: string;
  let secondUserEmail: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Team Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create admin user
    const adminEmail = `team-admin-${Date.now()}@example.com`;
    const adminRes = await request(app).post('/api/auth/register').send({
      email: adminEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Team Admin',
      tosAccepted: true,
    });
    authToken = adminRes.body.token;
    userId = adminRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    // Create second user to add to team
    secondUserEmail = `team-member-${Date.now()}@example.com`;
    const memberRes = await request(app).post('/api/auth/register').send({
      email: secondUserEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Team Member',
      tosAccepted: true,
    });
    secondUserId = memberRes.body.user.id;

    await prisma.user.update({
      where: { id: secondUserId },
      data: { companyId, roleInCompany: 'viewer' },
    });

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Team Test Project ${Date.now()}`,
        projectNumber: `TEAM-${Date.now()}`,
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
  });

  afterAll(async () => {
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});

    for (const uid of [userId, secondUserId]) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } });
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should get project team members', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/users`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('should reject admins from another company when reading project team members', async () => {
    const otherCompany = await prisma.company.create({
      data: { name: `Other Team Company ${Date.now()}` },
    });
    const otherEmail = `other-team-admin-${Date.now()}@example.com`;
    const otherRes = await request(app).post('/api/auth/register').send({
      email: otherEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Other Team Admin',
      tosAccepted: true,
    });
    const otherToken = otherRes.body.token;
    const otherUserId = otherRes.body.user.id;

    await prisma.user.update({
      where: { id: otherUserId },
      data: { companyId: otherCompany.id, roleInCompany: 'admin' },
    });

    try {
      const res = await request(app)
        .get(`/api/projects/${projectId}/users`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    } finally {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
      await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
    }
  });

  it('should add user to project team by email', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/users`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: secondUserEmail, // API expects email, not userId
        role: 'viewer',
      });

    expect(res.status).toBe(201);
  });

  it('should allow adding an existing company user when the company is at its user limit', async () => {
    const suffix = Date.now();
    const limitCompany = await prisma.company.create({
      data: {
        name: `Limit Team Company ${suffix}`,
        subscriptionTier: 'basic',
      },
    });
    const adminEmail = `limit-team-admin-${suffix}@example.com`;
    const adminRes = await request(app).post('/api/auth/register').send({
      email: adminEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Limit Team Admin',
      tosAccepted: true,
    });
    const adminToken = adminRes.body.token;
    const adminId = adminRes.body.user.id;
    const existingUser = await prisma.user.create({
      data: {
        email: `limit-existing-member-${suffix}@example.com`,
        fullName: 'Existing Paid Seat',
        companyId: limitCompany.id,
        roleInCompany: 'viewer',
        emailVerified: true,
      },
    });
    const fillerUsers = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        prisma.user.create({
          data: {
            email: `limit-filler-${suffix}-${index}@example.com`,
            fullName: `Limit Filler ${index}`,
            companyId: limitCompany.id,
            roleInCompany: 'viewer',
            emailVerified: true,
          },
        }),
      ),
    );

    await prisma.user.update({
      where: { id: adminId },
      data: { companyId: limitCompany.id, roleInCompany: 'admin' },
    });

    const limitProject = await prisma.project.create({
      data: {
        name: `Limit Team Project ${suffix}`,
        projectNumber: `LIM-${suffix}`,
        companyId: limitCompany.id,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });

    await prisma.projectUser.create({
      data: { projectId: limitProject.id, userId: adminId, role: 'admin', status: 'active' },
    });

    try {
      const companyUserCount = await prisma.user.count({ where: { companyId: limitCompany.id } });
      expect(companyUserCount).toBe(5);

      const res = await request(app)
        .post(`/api/projects/${limitProject.id}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: existingUser.email,
          role: 'viewer',
        });

      expect(res.status).toBe(201);
      expect(res.body.projectUser.userId).toBe(existingUser.id);
    } finally {
      await prisma.projectUser.deleteMany({ where: { projectId: limitProject.id } });
      await prisma.project.delete({ where: { id: limitProject.id } }).catch(() => {});

      const userIds = [adminId, existingUser.id, ...fillerUsers.map((user) => user.id)];
      await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.company.delete({ where: { id: limitCompany.id } }).catch(() => {});
    }
  });

  it('should reject project team invites for users outside the project company', async () => {
    const otherCompany = await prisma.company.create({
      data: { name: `Outside Invite Company ${Date.now()}` },
    });
    const otherEmail = `outside-invite-${Date.now()}@example.com`;
    const otherRes = await request(app).post('/api/auth/register').send({
      email: otherEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Outside Invite User',
      tosAccepted: true,
    });
    const otherUserId = otherRes.body.user.id;

    await prisma.user.update({
      where: { id: otherUserId },
      data: { companyId: otherCompany.id, roleInCompany: 'viewer' },
    });

    try {
      const res = await request(app)
        .post(`/api/projects/${projectId}/users`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: otherEmail,
          role: 'viewer',
        });

      expect(res.status).toBe(403);
    } finally {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
      await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
    }
  });

  it('should reject invalid project team roles', async () => {
    const inviteRes = await request(app)
      .post(`/api/projects/${projectId}/users`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: secondUserEmail,
        role: 'super_admin',
      });

    expect(inviteRes.status).toBe(400);

    const updateRes = await request(app)
      .patch(`/api/projects/${projectId}/users/${secondUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        role: 'super_admin',
      });

    expect(updateRes.status).toBe(400);
  });

  it('should reject changing your own project role', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/users/${userId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        role: 'viewer',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('own project role');
  });

  it('should keep at least one active project admin', async () => {
    const companyAdminEmail = `team-company-admin-${Date.now()}@example.com`;
    const companyAdminRes = await request(app).post('/api/auth/register').send({
      email: companyAdminEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Team Company Admin',
      tosAccepted: true,
    });
    const companyAdminToken = companyAdminRes.body.token;
    const companyAdminId = companyAdminRes.body.user.id;

    await prisma.user.update({
      where: { id: companyAdminId },
      data: { companyId, roleInCompany: 'admin' },
    });
    await prisma.projectUser.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { role: 'admin', status: 'active' },
      create: { projectId, userId, role: 'admin', status: 'active' },
    });
    await prisma.projectUser.upsert({
      where: { projectId_userId: { projectId, userId: secondUserId } },
      update: { role: 'viewer', status: 'active' },
      create: { projectId, userId: secondUserId, role: 'viewer', status: 'active' },
    });

    try {
      const demoteRes = await request(app)
        .patch(`/api/projects/${projectId}/users/${userId}`)
        .set('Authorization', `Bearer ${companyAdminToken}`)
        .send({
          role: 'viewer',
        });

      expect(demoteRes.status).toBe(400);
      expect(demoteRes.body.error.message).toContain('at least one active admin');

      const removeRes = await request(app)
        .delete(`/api/projects/${projectId}/users/${userId}`)
        .set('Authorization', `Bearer ${companyAdminToken}`);

      expect(removeRes.status).toBe(400);
      expect(removeRes.body.error.message).toContain('at least one active admin');
    } finally {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: companyAdminId } });
      await prisma.user.delete({ where: { id: companyAdminId } }).catch(() => {});
    }
  });

  it('should update user role in project', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/users/${secondUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        role: 'foreman',
      });

    expect(res.status).toBe(200);
  });
});
