import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Import ITP router - named export
import { itpRouter } from './itp/index.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/itp', itpRouter);
app.use(errorHandler);

const TEST_PASSWORD = 'SecureP@ssword123!';

async function registerTestUser(prefix: string, fullName: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: TEST_PASSWORD,
    fullName,
    tosAccepted: true,
  });

  return {
    token: res.body.token as string,
    userId: res.body.user.id as string,
  };
}

async function cleanupTestUser(userId: string) {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

describe('ITP Templates API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let templateId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `ITP Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `itp-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'ITP Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    const project = await prisma.project.create({
      data: {
        name: `ITP Test Project ${Date.now()}`,
        projectNumber: `ITP-${Date.now()}`,
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
    await prisma.iTPChecklistItem.deleteMany({ where: { template: { projectId } } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('POST /api/itp/templates', () => {
    it('should create a new ITP template with checklist items', async () => {
      const res = await request(app)
        .post('/api/itp/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          name: 'Earthworks ITP',
          description: 'Inspection and test plan for earthworks',
          activityType: 'Earthworks',
          checklistItems: [
            {
              description: 'Check compaction level',
              pointType: 'verification',
              evidenceRequired: 'required',
            },
            {
              description: 'QM Approval Required',
              pointType: 'hold_point',
            },
            {
              description: 'Client Witness Required',
              pointType: 'witness',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.template).toBeDefined();
      expect(res.body.template.name).toBe('Earthworks ITP');
      expect(res.body.template.checklistItems).toBeDefined();
      expect(res.body.template.checklistItems.length).toBe(3);
      templateId = res.body.template.id;
    });

    it('should reject template without name', async () => {
      const res = await request(app)
        .post('/api/itp/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'No name template',
        });

      expect(res.status).toBe(400);
    });

    it('should reject template without activityType', async () => {
      const res = await request(app)
        .post('/api/itp/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          name: 'Missing Activity',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/itp/templates', () => {
    it('should list templates for project', async () => {
      const res = await request(app)
        .get(`/api/itp/templates?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.templates).toBeDefined();
      expect(Array.isArray(res.body.templates)).toBe(true);
      expect(res.body.templates.length).toBeGreaterThan(0);
    });

    it('should reject malformed template query parameters', async () => {
      const duplicateProjectRes = await request(app)
        .get('/api/itp/templates')
        .query({ projectId: [projectId, projectId] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateProjectRes.status).toBe(400);
      expect(duplicateProjectRes.body.error.message).toContain(
        'projectId query parameter must be a single value',
      );

      const duplicateIncludeGlobalRes = await request(app)
        .get('/api/itp/templates')
        .query({ projectId, includeGlobal: ['true', 'false'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateIncludeGlobalRes.status).toBe(400);
      expect(duplicateIncludeGlobalRes.body.error.message).toContain(
        'includeGlobal query parameter must be a single value',
      );

      const invalidIncludeGlobalRes = await request(app)
        .get(`/api/itp/templates?projectId=${projectId}&includeGlobal=yes`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidIncludeGlobalRes.status).toBe(400);
      expect(invalidIncludeGlobalRes.body.error.message).toContain(
        'includeGlobal must be true or false',
      );

      const duplicateCurrentProjectRes = await request(app)
        .get('/api/itp/templates/cross-project')
        .query({ currentProjectId: [projectId, projectId] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateCurrentProjectRes.status).toBe(400);
      expect(duplicateCurrentProjectRes.body.error.message).toContain(
        'currentProjectId query parameter must be a single value',
      );

      const longProjectId = 'p'.repeat(129);
      const oversizedProjectRes = await request(app)
        .get('/api/itp/templates')
        .query({ projectId: longProjectId })
        .set('Authorization', `Bearer ${authToken}`);

      expect(oversizedProjectRes.status).toBe(400);
      expect(oversizedProjectRes.body.error.message).toContain('projectId is too long');

      const oversizedCurrentProjectRes = await request(app)
        .get('/api/itp/templates/cross-project')
        .query({ currentProjectId: longProjectId })
        .set('Authorization', `Bearer ${authToken}`);

      expect(oversizedCurrentProjectRes.status).toBe(400);
      expect(oversizedCurrentProjectRes.body.error.message).toContain(
        'currentProjectId is too long',
      );
    });

    it('should reject pending project memberships from template reads and writes', async () => {
      const pending = await registerTestUser('itp-pending', 'Pending ITP User');
      await prisma.user.update({
        where: { id: pending.userId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: pending.userId, role: 'admin', status: 'pending' },
      });

      try {
        const listRes = await request(app)
          .get(`/api/itp/templates?projectId=${projectId}`)
          .set('Authorization', `Bearer ${pending.token}`);

        expect(listRes.status).toBe(403);

        const detailRes = await request(app)
          .get(`/api/itp/templates/${templateId}`)
          .set('Authorization', `Bearer ${pending.token}`);

        expect(detailRes.status).toBe(403);

        const createRes = await request(app)
          .post('/api/itp/templates')
          .set('Authorization', `Bearer ${pending.token}`)
          .send({
            projectId,
            name: 'Pending User Template',
            activityType: 'Earthworks',
          });

        expect(createRes.status).toBe(403);
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: pending.userId } });
        await cleanupTestUser(pending.userId);
      }
    });

    it('should not grant subcontractors template access through project memberships', async () => {
      const targetTemplate =
        templateId ||
        (
          await prisma.iTPTemplate.create({
            data: {
              projectId,
              name: `Subcontractor Blocked Template ${Date.now()}`,
              activityType: 'Earthworks',
            },
          })
        ).id;
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `ITP Template Project Role Subcontractor ${Date.now()}`,
          status: 'approved',
          portalAccess: { itps: true },
        },
      });
      const subcontractor = await registerTestUser(
        'itp-template-project-role-subcontractor',
        'ITP Template Project Role Subcontractor',
      );

      await prisma.user.update({
        where: { id: subcontractor.userId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractor.userId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'admin',
        },
      });
      await prisma.projectUser.create({
        data: {
          projectId,
          userId: subcontractor.userId,
          role: 'project_manager',
          status: 'active',
        },
      });

      try {
        const listRes = await request(app)
          .get(`/api/itp/templates?projectId=${projectId}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(listRes.status).toBe(403);

        const detailRes = await request(app)
          .get(`/api/itp/templates/${targetTemplate}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(detailRes.status).toBe(403);

        const createRes = await request(app)
          .post('/api/itp/templates')
          .set('Authorization', `Bearer ${subcontractor.token}`)
          .send({
            projectId,
            name: 'Subcontractor Project Role Template',
            activityType: 'Earthworks',
          });
        expect(createRes.status).toBe(403);
      } finally {
        await prisma.projectUser.deleteMany({
          where: { projectId, userId: subcontractor.userId },
        });
        await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        if (!templateId) {
          await prisma.iTPTemplate.delete({ where: { id: targetTemplate } }).catch(() => {});
        }
        await cleanupTestUser(subcontractor.userId);
      }
    });

    it('should exclude pending memberships from cross-project imports', async () => {
      const importUser = await registerTestUser('itp-import', 'ITP Import User');
      let otherProjectId = '';
      let otherTemplateId = '';

      await prisma.user.update({
        where: { id: importUser.userId },
        data: { companyId, roleInCompany: 'viewer' },
      });

      try {
        const otherProject = await prisma.project.create({
          data: {
            name: `ITP Import Other Project ${Date.now()}`,
            projectNumber: `ITPIMP-${Date.now()}`,
            companyId,
            status: 'active',
            state: 'NSW',
            specificationSet: 'TfNSW',
          },
        });
        otherProjectId = otherProject.id;

        const otherTemplate = await prisma.iTPTemplate.create({
          data: {
            projectId: otherProjectId,
            name: 'Pending Import Template',
            activityType: 'Earthworks',
          },
        });
        otherTemplateId = otherTemplate.id;

        await prisma.projectUser.createMany({
          data: [
            { projectId, userId: importUser.userId, role: 'viewer', status: 'active' },
            {
              projectId: otherProjectId,
              userId: importUser.userId,
              role: 'viewer',
              status: 'pending',
            },
          ],
        });

        const res = await request(app)
          .get(`/api/itp/templates/cross-project?currentProjectId=${projectId}`)
          .set('Authorization', `Bearer ${importUser.token}`);

        expect(res.status).toBe(200);
        expect(
          (res.body.projects as Array<{ id: string }>).some(
            (project) => project.id === otherProjectId,
          ),
        ).toBe(false);
        expect(res.body.templates).toEqual([]);
      } finally {
        await prisma.projectUser.deleteMany({ where: { userId: importUser.userId } });
        if (otherTemplateId) {
          await prisma.iTPTemplate.delete({ where: { id: otherTemplateId } }).catch(() => {});
        }
        if (otherProjectId) {
          await prisma.project.delete({ where: { id: otherProjectId } }).catch(() => {});
        }
        await cleanupTestUser(importUser.userId);
      }
    });
  });

  describe('GET /api/itp/templates/:id', () => {
    it('should get a single template with checklist items', async () => {
      const res = await request(app)
        .get(`/api/itp/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.template).toBeDefined();
      expect(res.body.template.id).toBe(templateId);
      expect(res.body.template.checklistItems).toBeDefined();
    });

    it('should return 404 for non-existent template', async () => {
      const res = await request(app)
        .get('/api/itp/templates/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject oversized template route ids before template lookups', async () => {
      const longId = 't'.repeat(129);
      const getRes = await request(app)
        .get(`/api/itp/templates/${longId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.status).toBe(400);
      expect(getRes.body.error.message).toContain('id is too long');

      const lotsRes = await request(app)
        .get(`/api/itp/templates/${longId}/lots`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(lotsRes.status).toBe(400);
      expect(lotsRes.body.error.message).toContain('id is too long');

      const cloneRes = await request(app)
        .post(`/api/itp/templates/${longId}/clone`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Clone should not run' });

      expect(cloneRes.status).toBe(400);
      expect(cloneRes.body.error.message).toContain('id is too long');
    });
  });

  describe('PATCH /api/itp/templates/:id', () => {
    it('should update template metadata', async () => {
      const res = await request(app)
        .patch(`/api/itp/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Earthworks ITP',
          description: 'Updated description',
        });

      expect(res.status).toBe(200);
      expect(res.body.template.name).toBe('Updated Earthworks ITP');
    });
  });

  describe('POST /api/itp/templates/:id/clone', () => {
    it('should clone a template', async () => {
      const res = await request(app)
        .post(`/api/itp/templates/${templateId}/clone`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Cloned Earthworks ITP',
        });

      expect(res.status).toBe(201);
      expect(res.body.template).toBeDefined();
      expect(res.body.template.name).toBe('Cloned Earthworks ITP');
      // Cleanup cloned template
      await prisma.iTPChecklistItem.deleteMany({ where: { templateId: res.body.template.id } });
      await prisma.iTPTemplate.delete({ where: { id: res.body.template.id } });
    });
  });

  describe('DELETE /api/itp/templates/:id', () => {
    it('should reject malformed force query parameters', async () => {
      const duplicateForceRes = await request(app)
        .delete(`/api/itp/templates/${templateId}`)
        .query({ force: ['true', 'false'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateForceRes.status).toBe(400);
      expect(duplicateForceRes.body.error.message).toContain(
        'force query parameter must be a single value',
      );

      const invalidForceRes = await request(app)
        .delete(`/api/itp/templates/${templateId}?force=yes`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidForceRes.status).toBe(400);
      expect(invalidForceRes.body.error.message).toContain('force must be true or false');
    });

    it('should reject force deleting an in-use template without deleting checklist items', async () => {
      const template = await prisma.iTPTemplate.create({
        data: {
          projectId,
          name: `In Use Delete Template ${Date.now()}`,
          activityType: 'Earthworks',
          checklistItems: {
            create: [
              {
                description: 'Hold template item',
                pointType: 'hold_point',
                sequenceNumber: 1,
              },
            ],
          },
        },
        include: { checklistItems: true },
      });
      const lot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `ITP-DELETE-IN-USE-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const instance = await prisma.iTPInstance.create({
        data: {
          lotId: lot.id,
          templateId: template.id,
          templateSnapshot: JSON.stringify({ id: template.id, checklistItems: [] }),
        },
      });

      try {
        const res = await request(app)
          .delete(`/api/itp/templates/${template.id}?force=true`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(409);

        const checklistItemCount = await prisma.iTPChecklistItem.count({
          where: { templateId: template.id },
        });
        expect(checklistItemCount).toBe(template.checklistItems.length);
      } finally {
        await prisma.iTPInstance.delete({ where: { id: instance.id } }).catch(() => {});
        await prisma.lot.delete({ where: { id: lot.id } }).catch(() => {});
        await prisma.iTPChecklistItem.deleteMany({ where: { templateId: template.id } });
        await prisma.iTPTemplate.delete({ where: { id: template.id } }).catch(() => {});
      }
    });
  });

  describe('POST /api/itp/templates/:id/propagate', () => {
    it('should reject missing or wrong-template instances without partial snapshot updates', async () => {
      const template = await prisma.iTPTemplate.create({
        data: {
          projectId,
          name: `Propagate Template ${Date.now()}`,
          activityType: 'Earthworks',
          checklistItems: {
            create: [
              {
                description: 'Original item',
                pointType: 'standard',
                sequenceNumber: 1,
              },
            ],
          },
        },
      });
      const lot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `ITP-PROPAGATE-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const instance = await prisma.iTPInstance.create({
        data: {
          lotId: lot.id,
          templateId: template.id,
          templateSnapshot: JSON.stringify({ before: true }),
        },
      });

      try {
        const res = await request(app)
          .post(`/api/itp/templates/${template.id}/propagate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            instanceIds: [instance.id, '00000000-0000-4000-8000-000000000001'],
          });

        expect(res.status).toBe(400);

        const unchangedInstance = await prisma.iTPInstance.findUniqueOrThrow({
          where: { id: instance.id },
          select: { templateSnapshot: true },
        });
        expect(unchangedInstance.templateSnapshot).toBe(JSON.stringify({ before: true }));
      } finally {
        await prisma.iTPInstance.delete({ where: { id: instance.id } }).catch(() => {});
        await prisma.lot.delete({ where: { id: lot.id } }).catch(() => {});
        await prisma.iTPChecklistItem.deleteMany({ where: { templateId: template.id } });
        await prisma.iTPTemplate.delete({ where: { id: template.id } }).catch(() => {});
      }
    });
  });
});

describe('ITP Instances', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let templateId: string;
  let lotId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `ITP Instance Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `itp-instance-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'ITP Instance User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    const project = await prisma.project.create({
      data: {
        name: `ITP Instance Project ${Date.now()}`,
        projectNumber: `ITPINST-${Date.now()}`,
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

    // Create template with items
    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: 'Instance Test ITP',
        activityType: 'Earthworks',
        checklistItems: {
          create: [
            {
              description: 'Contractor Test Item',
              pointType: 'verification',
              responsibleParty: 'contractor',
              sequenceNumber: 1,
            },
            {
              description: 'Subcontractor Test Item',
              pointType: 'verification',
              responsibleParty: 'subcontractor',
              sequenceNumber: 2,
            },
          ],
        },
      },
    });
    templateId = template.id;

    // Create lot
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ITP-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;
  });

  afterAll(async () => {
    // Use correct relation name 'itpInstance' (not 'instance')
    await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lotId } } });
    await prisma.iTPInstance.deleteMany({ where: { lotId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should create ITP instance for lot', async () => {
    const res = await request(app)
      .post('/api/itp/instances')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        lotId,
        templateId,
      });

    expect(res.status).toBe(201);
    expect(res.body.instance).toBeDefined();
    // instanceId stored in res.body.instance.id if needed

    const linkedLot = await prisma.lot.findUniqueOrThrow({
      where: { id: lotId },
      select: { itpTemplateId: true },
    });
    expect(linkedLot.itpTemplateId).toBe(templateId);
  });

  it('should reject archived templates without creating an instance', async () => {
    const archivedTemplate = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: `Archived Instance Template ${Date.now()}`,
        activityType: 'Earthworks',
        isActive: false,
      },
    });
    const targetLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ITP-ARCHIVED-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });

    try {
      const res = await request(app)
        .post('/api/itp/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lotId: targetLot.id,
          templateId: archivedTemplate.id,
        });

      expect(res.status).toBe(400);

      const instanceCount = await prisma.iTPInstance.count({ where: { lotId: targetLot.id } });
      const unchangedLot = await prisma.lot.findUniqueOrThrow({
        where: { id: targetLot.id },
        select: { itpTemplateId: true },
      });
      expect(instanceCount).toBe(0);
      expect(unchangedLot.itpTemplateId).toBeNull();
    } finally {
      await prisma.lot.delete({ where: { id: targetLot.id } }).catch(() => {});
      await prisma.iTPTemplate.delete({ where: { id: archivedTemplate.id } }).catch(() => {});
    }
  });

  it('should reject cross-project templates without creating an instance', async () => {
    const otherProject = await prisma.project.create({
      data: {
        name: `ITP Instance Other Project ${Date.now()}`,
        projectNumber: `ITPINST-OTHER-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    const otherTemplate = await prisma.iTPTemplate.create({
      data: {
        projectId: otherProject.id,
        name: `Other Project Instance Template ${Date.now()}`,
        activityType: 'Earthworks',
      },
    });
    const targetLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ITP-CROSS-PROJECT-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });

    try {
      const res = await request(app)
        .post('/api/itp/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lotId: targetLot.id,
          templateId: otherTemplate.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('not available');

      const instanceCount = await prisma.iTPInstance.count({ where: { lotId: targetLot.id } });
      const unchangedLot = await prisma.lot.findUniqueOrThrow({
        where: { id: targetLot.id },
        select: { itpTemplateId: true },
      });
      expect(instanceCount).toBe(0);
      expect(unchangedLot.itpTemplateId).toBeNull();
    } finally {
      await prisma.lot.delete({ where: { id: targetLot.id } }).catch(() => {});
      await prisma.iTPTemplate.delete({ where: { id: otherTemplate.id } }).catch(() => {});
      await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
    }
  });

  it('should reject assigning an ITP to terminal lots', async () => {
    const terminalLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ITP-TERMINAL-LOT-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });

    try {
      const res = await request(app)
        .post('/api/itp/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lotId: terminalLot.id,
          templateId,
        });

      expect(res.status).toBe(400);

      const instanceCount = await prisma.iTPInstance.count({ where: { lotId: terminalLot.id } });
      expect(instanceCount).toBe(0);
    } finally {
      await prisma.lot.delete({ where: { id: terminalLot.id } }).catch(() => {});
    }
  });

  it('should not grant subcontractors template assignment through project memberships', async () => {
    const suffix = Date.now();
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `ITP Instance Project Role Subcontractor ${suffix}`,
        status: 'approved',
        portalAccess: { itps: true },
      },
    });
    const subcontractor = await registerTestUser(
      'itp-instance-project-role-subcontractor',
      'ITP Instance Project Role Subcontractor',
    );
    const targetLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ITP-PROJECT-ROLE-LOT-${suffix}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });

    await prisma.user.update({
      where: { id: subcontractor.userId },
      data: { companyId, roleInCompany: 'subcontractor' },
    });
    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractor.userId,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'admin',
      },
    });
    await prisma.projectUser.create({
      data: {
        projectId,
        userId: subcontractor.userId,
        role: 'project_manager',
        status: 'active',
      },
    });

    try {
      const res = await request(app)
        .post('/api/itp/instances')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({
          lotId: targetLot.id,
          templateId,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('ITP template assignment access required');

      const instanceCount = await prisma.iTPInstance.count({ where: { lotId: targetLot.id } });
      const unchangedLot = await prisma.lot.findUniqueOrThrow({
        where: { id: targetLot.id },
        select: { itpTemplateId: true },
      });
      expect(instanceCount).toBe(0);
      expect(unchangedLot.itpTemplateId).toBeNull();
    } finally {
      await prisma.projectUser.deleteMany({
        where: { projectId, userId: subcontractor.userId },
      });
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await prisma.lot.delete({ where: { id: targetLot.id } }).catch(() => {});
      await cleanupTestUser(subcontractor.userId);
    }
  });

  it('should get ITP instance for lot', async () => {
    const res = await request(app)
      .get(`/api/itp/instances/lot/${lotId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // API returns { instance: { ...instance, template: { ... } } }
    expect(res.body.instance).toBeDefined();
    expect(res.body.instance.template).toBeDefined();
  });

  it('should validate subcontractorView query parameters', async () => {
    const subcontractorViewRes = await request(app)
      .get(`/api/itp/instances/lot/${lotId}?subcontractorView=true`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(subcontractorViewRes.status).toBe(200);
    expect(subcontractorViewRes.body.instance.template.checklistItems).toHaveLength(1);
    expect(subcontractorViewRes.body.instance.template.checklistItems[0].responsibleParty).toBe(
      'subcontractor',
    );

    const duplicateSubcontractorViewRes = await request(app)
      .get(`/api/itp/instances/lot/${lotId}`)
      .query({ subcontractorView: ['true', 'false'] })
      .set('Authorization', `Bearer ${authToken}`);

    expect(duplicateSubcontractorViewRes.status).toBe(400);
    expect(duplicateSubcontractorViewRes.body.error.message).toContain(
      'subcontractorView query parameter must be a single value',
    );

    const invalidSubcontractorViewRes = await request(app)
      .get(`/api/itp/instances/lot/${lotId}?subcontractorView=yes`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(invalidSubcontractorViewRes.status).toBe(400);
    expect(invalidSubcontractorViewRes.body.error.message).toContain(
      'subcontractorView must be true or false',
    );
  });

  it('should reject oversized lot route ids before ITP instance lookups', async () => {
    const longId = 'l'.repeat(129);

    const res = await request(app)
      .get(`/api/itp/instances/lot/${longId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('lotId is too long');
  });

  it('should reject users without project access from reading a lot ITP instance', async () => {
    const outsider = await registerTestUser('itp-instance-outsider', 'ITP Instance Outsider');

    try {
      const res = await request(app)
        .get(`/api/itp/instances/lot/${lotId}`)
        .set('Authorization', `Bearer ${outsider.token}`);

      expect(res.status).toBe(403);
    } finally {
      await cleanupTestUser(outsider.userId);
    }
  });

  it('scopes subcontractor ITP instance reads to assigned lots and subcontractor items', async () => {
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `ITP Instance Subcontractor ${Date.now()}`,
        status: 'approved',
        portalAccess: { itps: true },
      },
    });
    const subcontractor = await registerTestUser(
      'itp-instance-subcontractor',
      'ITP Instance Subcontractor',
    );

    await prisma.user.update({
      where: { id: subcontractor.userId },
      data: { companyId, roleInCompany: 'subcontractor' },
    });
    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractor.userId,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'user',
      },
    });

    try {
      const deniedRes = await request(app)
        .get(`/api/itp/instances/lot/${lotId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(deniedRes.status).toBe(403);

      await prisma.lotSubcontractorAssignment.create({
        data: {
          projectId,
          lotId,
          subcontractorCompanyId: subcontractorCompany.id,
          status: 'active',
          canCompleteITP: true,
        },
      });

      const allowedRes = await request(app)
        .get(`/api/itp/instances/lot/${lotId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(allowedRes.status).toBe(200);
      expect(allowedRes.body.instance.template.checklistItems).toHaveLength(1);
      expect(allowedRes.body.instance.template.checklistItems[0].responsibleParty).toBe(
        'subcontractor',
      );
    } finally {
      await prisma.lotSubcontractorAssignment.deleteMany({
        where: { subcontractorCompanyId: subcontractorCompany.id },
      });
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await cleanupTestUser(subcontractor.userId);
    }
  });
});

describe('ITP Completion Attachments', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let otherProjectId: string;
  let templateId: string;
  let checklistItemId: string;
  let lotId: string;
  let instanceId: string;
  let completionId: string;
  let documentId: string;
  let otherProjectDocumentId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `ITP Attachment Company ${Date.now()}` },
    });
    companyId = company.id;

    const registered = await registerTestUser('itp-attachment', 'ITP Attachment User');
    authToken = registered.token;
    userId = registered.userId;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    const project = await prisma.project.create({
      data: {
        name: `ITP Attachment Project ${Date.now()}`,
        projectNumber: `ITPATT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    const otherProject = await prisma.project.create({
      data: {
        name: `ITP Attachment Other Project ${Date.now()}`,
        projectNumber: `ITPATT-OTHER-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    otherProjectId = otherProject.id;

    await prisma.projectUser.createMany({
      data: [
        { projectId, userId, role: 'admin', status: 'active' },
        { projectId: otherProjectId, userId, role: 'admin', status: 'active' },
      ],
    });

    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: 'Attachment Test ITP',
        activityType: 'Earthworks',
      },
    });
    templateId = template.id;

    const checklistItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId,
        description: 'Upload evidence photo',
        pointType: 'verification',
        sequenceNumber: 1,
      },
    });
    checklistItemId = checklistItem.id;

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ITP-ATT-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

    const instance = await prisma.iTPInstance.create({
      data: {
        lotId,
        templateId,
        templateSnapshot: JSON.stringify({
          id: templateId,
          name: 'Attachment Test ITP',
          checklistItems: [{ id: checklistItemId, description: 'Upload evidence photo' }],
        }),
      },
    });
    instanceId = instance.id;

    const completion = await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instanceId,
        checklistItemId,
        status: 'pending',
      },
    });
    completionId = completion.id;

    const document = await prisma.document.create({
      data: {
        projectId,
        lotId,
        documentType: 'photo',
        category: 'itp_evidence',
        filename: 'stored-evidence.jpg',
        fileUrl: '/uploads/documents/stored-evidence.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        uploadedById: userId,
      },
    });
    documentId = document.id;

    const otherProjectDocument = await prisma.document.create({
      data: {
        projectId: otherProjectId,
        documentType: 'photo',
        category: 'itp_evidence',
        filename: 'other-project.jpg',
        fileUrl: '/uploads/documents/other-project.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        uploadedById: userId,
      },
    });
    otherProjectDocumentId = otherProjectDocument.id;
  });

  afterAll(async () => {
    await prisma.iTPCompletionAttachment.deleteMany({ where: { completionId } });
    await prisma.document.deleteMany({
      where: { id: { in: [documentId, otherProjectDocumentId].filter(Boolean) } },
    });
    await prisma.iTPCompletion.deleteMany({ where: { id: completionId } });
    await prisma.iTPInstance.deleteMany({ where: { id: instanceId } });
    await prisma.lot.deleteMany({ where: { id: lotId } });
    await prisma.iTPChecklistItem.deleteMany({ where: { id: checklistItemId } });
    await prisma.iTPTemplate.deleteMany({ where: { id: templateId } });
    await prisma.projectUser.deleteMany({ where: { userId } });
    await prisma.project.deleteMany({
      where: { id: { in: [projectId, otherProjectId].filter(Boolean) } },
    });
    await cleanupTestUser(userId);
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should attach an already uploaded document without duplicating it', async () => {
    const res = await request(app)
      .post(`/api/itp/completions/${completionId}/attachments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        documentId,
        caption: 'Stored evidence photo',
        gpsLatitude: -33.865143,
        gpsLongitude: 151.2099,
      });

    expect(res.status).toBe(201);
    expect(res.body.attachment.documentId).toBe(documentId);
    expect(res.body.attachment.document.fileUrl).toBe('/uploads/documents/stored-evidence.jpg');

    const repeated = await request(app)
      .post(`/api/itp/completions/${completionId}/attachments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ documentId });

    expect(repeated.status).toBe(200);

    const attachments = await prisma.iTPCompletionAttachment.findMany({
      where: { completionId, documentId },
    });
    expect(attachments).toHaveLength(1);

    const updatedDocument = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    expect(updatedDocument.caption).toBe('Stored evidence photo');
    expect(Number(updatedDocument.gpsLatitude)).toBeCloseTo(-33.865143, 5);
    expect(Number(updatedDocument.gpsLongitude)).toBeCloseTo(151.2099, 5);
  });

  it('should reject malformed or out-of-range GPS coordinates on attachments', async () => {
    const malformedLatitude = await request(app)
      .post(`/api/itp/completions/${completionId}/attachments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        documentId,
        gpsLatitude: '-33.865143abc',
      });

    expect(malformedLatitude.status).toBe(400);
    expect(malformedLatitude.body.error.message).toContain('gpsLatitude');

    const outOfRangeLongitude = await request(app)
      .post(`/api/itp/completions/${completionId}/attachments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        documentId,
        gpsLongitude: '181',
      });

    expect(outOfRangeLongitude.status).toBe(400);
    expect(outOfRangeLongitude.body.error.message).toContain('gpsLongitude');
  });

  it('should reject oversized attachment captions without mutating existing documents', async () => {
    const beforeDocument = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

    const res = await request(app)
      .post(`/api/itp/completions/${completionId}/attachments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        documentId,
        caption: 'x'.repeat(2001),
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error.details)).toContain('caption');

    const afterDocument = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    expect(afterDocument.caption).toBe(beforeDocument.caption);
  });

  it('should update completion notes without changing status', async () => {
    const res = await request(app)
      .patch(`/api/itp/completions/${completionId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ notes: 'Subcontractor note update' });

    expect(res.status).toBe(200);
    expect(res.body.completion.notes).toBe('Subcontractor note update');
    expect(res.body.completion.status).toBe('pending');

    const completion = await prisma.iTPCompletion.findUniqueOrThrow({
      where: { id: completionId },
    });
    expect(completion.notes).toBe('Subcontractor note update');
    expect(completion.status).toBe('pending');
  });

  it('should reject oversized completion workflow text without mutating the completion', async () => {
    const beforeCompletion = await prisma.iTPCompletion.findUniqueOrThrow({
      where: { id: completionId },
      select: {
        notes: true,
        status: true,
        witnessName: true,
        verificationStatus: true,
        verificationNotes: true,
      },
    });

    const oversizedNotes = await request(app)
      .patch(`/api/itp/completions/${completionId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ notes: 'x'.repeat(5001) });

    expect(oversizedNotes.status).toBe(400);
    expect(JSON.stringify(oversizedNotes.body.error.details)).toContain('Notes');

    const oversizedWitness = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId,
        status: 'completed',
        witnessName: 'x'.repeat(161),
      });

    expect(oversizedWitness.status).toBe(400);
    expect(JSON.stringify(oversizedWitness.body.error.details)).toContain('Witness name');

    const oversizedRejection = await request(app)
      .post(`/api/itp/completions/${completionId}/reject`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ reason: 'x'.repeat(3001) });

    expect(oversizedRejection.status).toBe(400);
    expect(JSON.stringify(oversizedRejection.body.error.details)).toContain('Rejection reason');

    const afterCompletion = await prisma.iTPCompletion.findUniqueOrThrow({
      where: { id: completionId },
      select: {
        notes: true,
        status: true,
        witnessName: true,
        verificationStatus: true,
        verificationNotes: true,
      },
    });
    expect(afterCompletion).toEqual(beforeCompletion);
  });

  it('should reject inline data URLs for new attachment records', async () => {
    const res = await request(app)
      .post(`/api/itp/completions/${completionId}/attachments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        filename: 'inline.jpg',
        fileUrl: 'data:image/jpeg;base64,abc123',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.issues[0].message).toContain('Inline data URLs');
  });

  it('should reject oversized new attachment metadata without creating documents', async () => {
    const oversizedMetadataCases = [
      {
        field: 'filename',
        payload: {
          filename: `${'x'.repeat(181)}.jpg`,
          fileUrl: `/uploads/documents/oversized-filename-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        },
      },
      {
        field: 'mimeType',
        payload: {
          filename: `oversized-mime-${Date.now()}.jpg`,
          fileUrl: `/uploads/documents/oversized-mime-${Date.now()}.jpg`,
          mimeType: 'x'.repeat(121),
        },
      },
    ];

    for (const { field, payload } of oversizedMetadataCases) {
      const res = await request(app)
        .post(`/api/itp/completions/${completionId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toContain(field);

      const createdDocument = await prisma.document.findFirst({
        where: { projectId, fileUrl: payload.fileUrl },
        select: { id: true },
      });
      expect(createdDocument).toBeNull();
    }
  });

  it('should create new attachment records only from stored document upload paths', async () => {
    const filename = `stored-path-evidence-${Date.now()}.jpg`;
    let createdDocumentId: string | undefined;

    try {
      const res = await request(app)
        .post(`/api/itp/completions/${completionId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filename,
          fileUrl: `/uploads/documents/${filename}`,
          mimeType: 'image/jpeg',
          caption: 'Stored path evidence photo',
        });

      expect(res.status).toBe(201);
      expect(res.body.attachment.document.fileUrl).toBe(`/uploads/documents/${filename}`);
      createdDocumentId = res.body.attachment.documentId;
    } finally {
      if (createdDocumentId) {
        await prisma.iTPCompletionAttachment.deleteMany({
          where: { completionId, documentId: createdDocumentId },
        });
        await prisma.document.deleteMany({ where: { id: createdDocumentId } });
      }
    }
  });

  it('should reject new attachment file URLs outside stored document uploads', async () => {
    const filename = `comment-upload-reference-${Date.now()}.jpg`;

    const res = await request(app)
      .post(`/api/itp/completions/${completionId}/attachments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        filename,
        fileUrl: `/uploads/comments/${filename}`,
        mimeType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('uploaded document file');

    const createdDocument = await prisma.document.findFirst({
      where: { projectId, filename },
      select: { id: true },
    });
    expect(createdDocument).toBeNull();
  });

  it('should reject documents from a different project', async () => {
    const res = await request(app)
      .post(`/api/itp/completions/${completionId}/attachments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ documentId: otherProjectDocumentId });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('same project');
  });

  it('should reject malformed pending verification project query parameters', async () => {
    const missingProjectRes = await request(app)
      .get('/api/itp/pending-verifications')
      .set('Authorization', `Bearer ${authToken}`);

    expect(missingProjectRes.status).toBe(400);
    expect(missingProjectRes.body.error.message).toContain('projectId is required');

    const blankProjectRes = await request(app)
      .get('/api/itp/pending-verifications')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId: '   ' });

    expect(blankProjectRes.status).toBe(400);
    expect(blankProjectRes.body.error.message).toContain('projectId is required');

    const repeatedProjectRes = await request(app)
      .get('/api/itp/pending-verifications')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId: [projectId, otherProjectId] });

    expect(repeatedProjectRes.status).toBe(400);
    expect(repeatedProjectRes.body.error.message).toContain('projectId is required');
  });

  it('should list pending verifications with assigned subcontractor details', async () => {
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `ITP Pending Verification Subcontractor ${Date.now()}`,
        status: 'approved',
      },
    });

    try {
      await prisma.lot.update({
        where: { id: lotId },
        data: { assignedSubcontractorId: subcontractorCompany.id },
      });
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          status: 'completed',
          completedById: userId,
          completedAt: new Date(),
          verificationStatus: 'pending_verification',
        },
      });

      const res = await request(app)
        .get('/api/itp/pending-verifications')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ projectId });

      expect(res.status).toBe(200);
      expect(res.body.pendingVerifications).toHaveLength(1);
      expect(res.body.pendingVerifications[0]).toMatchObject({
        id: completionId,
        subcontractor: {
          id: subcontractorCompany.id,
          companyName: subcontractorCompany.companyName,
        },
      });
    } finally {
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          status: 'pending',
          completedById: null,
          completedAt: null,
          verificationStatus: 'none',
        },
      });
      await prisma.lot.update({
        where: { id: lotId },
        data: { assignedSubcontractorId: null },
      });
      await prisma.subcontractorCompany.deleteMany({ where: { id: subcontractorCompany.id } });
    }
  });

  it('should reject oversized completion route ids before lookups', async () => {
    const longId = 'c'.repeat(129);

    const cases = [
      {
        request: () =>
          request(app).patch(`/api/itp/completions/${longId}`).send({ notes: 'Route validation' }),
        message: 'id is too long',
      },
      {
        request: () => request(app).post(`/api/itp/completions/${longId}/verify`),
        message: 'id is too long',
      },
      {
        request: () =>
          request(app)
            .post(`/api/itp/completions/${longId}/reject`)
            .send({ reason: 'Insufficient evidence' }),
        message: 'id is too long',
      },
      {
        request: () =>
          request(app).post(`/api/itp/completions/${longId}/attachments`).send({ documentId }),
        message: 'completionId is too long',
      },
      {
        request: () => request(app).get(`/api/itp/completions/${longId}/attachments`),
        message: 'completionId is too long',
      },
      {
        request: () =>
          request(app).delete(`/api/itp/completions/${longId}/attachments/attachment-id`),
        message: 'completionId is too long',
      },
      {
        request: () =>
          request(app).delete(`/api/itp/completions/${completionId}/attachments/${longId}`),
        message: 'attachmentId is too long',
      },
    ];

    for (const testCase of cases) {
      const res = await testCase.request().set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain(testCase.message);
    }
  });

  it('should reject users without project access from updating completions', async () => {
    const outsider = await registerTestUser('itp-completion-outsider', 'ITP Completion Outsider');

    try {
      const res = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${outsider.token}`)
        .send({
          itpInstanceId: instanceId,
          checklistItemId,
          status: 'completed',
        });

      expect(res.status).toBe(403);

      const patchRes = await request(app)
        .patch(`/api/itp/completions/${completionId}`)
        .set('Authorization', `Bearer ${outsider.token}`)
        .send({ notes: 'Unauthorized note update' });

      expect(patchRes.status).toBe(403);
    } finally {
      await cleanupTestUser(outsider.userId);
    }
  });

  it('should reject subcontractors without lot assignment from completion and attachment access', async () => {
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `ITP Completion Subcontractor ${Date.now()}`,
        status: 'approved',
        portalAccess: { itps: true },
      },
    });
    const subcontractor = await registerTestUser(
      'itp-completion-subcontractor',
      'ITP Completion Subcontractor',
    );

    await prisma.user.update({
      where: { id: subcontractor.userId },
      data: { companyId, roleInCompany: 'subcontractor' },
    });
    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractor.userId,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'user',
      },
    });

    try {
      const createRes = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({
          itpInstanceId: instanceId,
          checklistItemId,
          status: 'pending',
        });
      expect(createRes.status).toBe(403);

      const patchRes = await request(app)
        .patch(`/api/itp/completions/${completionId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({ notes: 'Unauthorized subcontractor note update' });
      expect(patchRes.status).toBe(403);

      const attachmentsRes = await request(app)
        .get(`/api/itp/completions/${completionId}/attachments`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(attachmentsRes.status).toBe(403);
    } finally {
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await cleanupTestUser(subcontractor.userId);
    }
  });

  it('should reject subcontractor ITP writes and attachments when portal access is disabled', async () => {
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `ITP Disabled Portal Subcontractor ${Date.now()}`,
        status: 'approved',
        portalAccess: { itps: false },
      },
    });
    const subcontractor = await registerTestUser(
      'itp-disabled-portal-subcontractor',
      'ITP Disabled Portal Subcontractor',
    );

    await prisma.user.update({
      where: { id: subcontractor.userId },
      data: { companyId, roleInCompany: 'subcontractor' },
    });
    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractor.userId,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'user',
      },
    });
    await prisma.lotSubcontractorAssignment.create({
      data: {
        projectId,
        lotId,
        subcontractorCompanyId: subcontractorCompany.id,
        status: 'active',
        canCompleteITP: true,
      },
    });

    const beforeCompletion = await prisma.iTPCompletion.findUniqueOrThrow({
      where: { id: completionId },
    });

    try {
      const createRes = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({
          itpInstanceId: instanceId,
          checklistItemId,
          status: 'completed',
        });
      expect(createRes.status).toBe(403);
      expect(createRes.body.error.message).toContain('ITPs portal access is not enabled');

      const patchRes = await request(app)
        .patch(`/api/itp/completions/${completionId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({ notes: 'Should not save while ITP portal is disabled' });
      expect(patchRes.status).toBe(403);
      expect(patchRes.body.error.message).toContain('ITPs portal access is not enabled');

      const attachmentsRes = await request(app)
        .get(`/api/itp/completions/${completionId}/attachments`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(attachmentsRes.status).toBe(403);
      expect(attachmentsRes.body.error.message).toContain('ITPs portal access is not enabled');

      const attachRes = await request(app)
        .post(`/api/itp/completions/${completionId}/attachments`)
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({ documentId });
      expect(attachRes.status).toBe(403);
      expect(attachRes.body.error.message).toContain('ITPs portal access is not enabled');

      const afterCompletion = await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id: completionId },
      });
      expect(afterCompletion.status).toBe(beforeCompletion.status);
      expect(afterCompletion.notes).toBe(beforeCompletion.notes);
    } finally {
      await prisma.lotSubcontractorAssignment.deleteMany({
        where: { subcontractorCompanyId: subcontractorCompany.id },
      });
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await cleanupTestUser(subcontractor.userId);
    }
  });
});
