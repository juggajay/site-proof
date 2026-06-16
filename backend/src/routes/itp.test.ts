import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { AuditAction, parseAuditLogChanges } from '../lib/auditLog.js';
import { registerTestUser as registerSharedTestUser } from '../test/routeTestHarness.js';

// Import ITP router - named export
import { itpRouter } from './itp/index.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/itp', itpRouter);
app.use(errorHandler);

async function registerTestUser(prefix: string, fullName: string) {
  const { token, userId } = await registerSharedTestUser(app, { emailPrefix: prefix, fullName });
  return { token, userId };
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

    const primaryUser = await registerSharedTestUser(app, {
      emailPrefix: 'itp-test',
      fullName: 'ITP Test User',
      companyId,
      roleInCompany: 'admin',
    });
    authToken = primaryUser.token;
    userId = primaryUser.userId;

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
        data: { companyId: null, roleInCompany: 'subcontractor' },
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

  describe('GET /api/itp/templates/:id/lots', () => {
    it('should reject global template lot enumeration across tenants', async () => {
      const suffix = Date.now();
      const globalTemplate = await prisma.iTPTemplate.create({
        data: {
          projectId: null,
          name: `Global Leak Guard ${suffix}`,
          activityType: 'Earthworks',
          stateSpec: 'TfNSW',
          isActive: true,
        },
      });
      const otherCompany = await prisma.company.create({
        data: { name: `Other ITP Tenant ${suffix}` },
      });
      const otherProject = await prisma.project.create({
        data: {
          name: `Other ITP Project ${suffix}`,
          projectNumber: `OTHER-ITP-${suffix}`,
          companyId: otherCompany.id,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const otherLot = await prisma.lot.create({
        data: {
          projectId: otherProject.id,
          lotNumber: `OTHER-LOT-${suffix}`,
          lotType: 'chainage',
          activityType: 'Earthworks',
          status: 'in_progress',
          itpTemplateId: globalTemplate.id,
        },
      });
      await prisma.iTPInstance.create({
        data: {
          lotId: otherLot.id,
          templateId: globalTemplate.id,
          status: 'in_progress',
        },
      });

      try {
        const res = await request(app)
          .get(`/api/itp/templates/${globalTemplate.id}/lots`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(403);
        expect(JSON.stringify(res.body)).not.toContain(otherLot.lotNumber);
      } finally {
        await prisma.iTPInstance.deleteMany({ where: { templateId: globalTemplate.id } });
        await prisma.lot.delete({ where: { id: otherLot.id } }).catch(() => {});
        await prisma.iTPTemplate.delete({ where: { id: globalTemplate.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
        await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
      }
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

    const primaryUser = await registerSharedTestUser(app, {
      emailPrefix: 'itp-instance',
      fullName: 'ITP Instance User',
      companyId,
      roleInCompany: 'admin',
    });
    authToken = primaryUser.token;
    userId = primaryUser.userId;

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
      data: { companyId: null, roleInCompany: 'subcontractor' },
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

  it('returns a null instance for accessible lots with no assigned ITP', async () => {
    const lotWithoutItp = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ITP-NONE-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });

    try {
      const res = await request(app)
        .get(`/api/itp/instances/lot/${lotWithoutItp.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.instance).toBeNull();
    } finally {
      await prisma.lot.delete({ where: { id: lotWithoutItp.id } }).catch(() => {});
    }
  });

  it('should validate subcontractorView query parameters', async () => {
    const subcontractorViewRes = await request(app)
      .get(`/api/itp/instances/lot/${lotId}?subcontractorView=true`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(subcontractorViewRes.status).toBe(200);
    // The subcontractor view now includes contractor items (the field work the
    // subcontractor performs), not only items tagged 'subcontractor'.
    const subcontractorViewParties = subcontractorViewRes.body.instance.template.checklistItems.map(
      (item: { responsibleParty: string }) => item.responsibleParty,
    );
    expect(subcontractorViewParties).toHaveLength(2);
    expect(subcontractorViewParties).toEqual(
      expect.arrayContaining(['contractor', 'subcontractor']),
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

  it('hides superintendent items but shows contractor + subcontractor items in the subcontractor view', async () => {
    // Dedicated template covering all three responsible parties so the
    // subcontractor-view filter is exercised end to end.
    const partyTemplate = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: `Party Filter ITP ${Date.now()}`,
        activityType: 'Earthworks',
        checklistItems: {
          create: [
            {
              description: 'Contractor item',
              pointType: 'verification',
              responsibleParty: 'contractor',
              sequenceNumber: 1,
            },
            {
              description: 'Subcontractor item',
              pointType: 'verification',
              responsibleParty: 'subcontractor',
              sequenceNumber: 2,
            },
            {
              description: 'Superintendent hold point',
              pointType: 'hold_point',
              responsibleParty: 'superintendent',
              sequenceNumber: 3,
            },
          ],
        },
      },
    });
    const partyLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `PARTY-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });

    try {
      const createInstanceRes = await request(app)
        .post('/api/itp/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ lotId: partyLot.id, templateId: partyTemplate.id });
      expect(createInstanceRes.status).toBe(201);

      // Full (head-contractor) view sees every item.
      const fullView = await request(app)
        .get(`/api/itp/instances/lot/${partyLot.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(fullView.status).toBe(200);
      expect(fullView.body.instance.template.checklistItems).toHaveLength(3);

      // Subcontractor view sees contractor + subcontractor, but not superintendent.
      const subView = await request(app)
        .get(`/api/itp/instances/lot/${partyLot.id}?subcontractorView=true`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(subView.status).toBe(200);
      const parties = subView.body.instance.template.checklistItems.map(
        (item: { responsibleParty: string }) => item.responsibleParty,
      );
      expect(parties).toHaveLength(2);
      expect(parties).toEqual(expect.arrayContaining(['contractor', 'subcontractor']));
      expect(parties).not.toContain('superintendent');
    } finally {
      await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lotId: partyLot.id } } });
      await prisma.iTPInstance.deleteMany({ where: { lotId: partyLot.id } });
      await prisma.lot.delete({ where: { id: partyLot.id } }).catch(() => {});
      await prisma.iTPChecklistItem.deleteMany({ where: { templateId: partyTemplate.id } });
      await prisma.iTPTemplate.delete({ where: { id: partyTemplate.id } }).catch(() => {});
    }
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
    const existingInstance = await prisma.iTPInstance.findUnique({
      where: { lotId },
      select: { id: true },
    });
    if (!existingInstance) {
      const createRes = await request(app)
        .post('/api/itp/instances')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ lotId, templateId });
      expect(createRes.status).toBe(201);
    }

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
      data: { companyId: null, roleInCompany: 'subcontractor' },
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
      // The subcontractor view now includes the contractor field-work items the
      // subcontractor performs, not only items tagged 'subcontractor'. Only the
      // superintendent's hold/witness points remain withheld.
      const allowedParties = allowedRes.body.instance.template.checklistItems.map(
        (item: { responsibleParty: string }) => item.responsibleParty,
      );
      expect(allowedParties).toHaveLength(2);
      expect(allowedParties).toEqual(expect.arrayContaining(['contractor', 'subcontractor']));
      expect(allowedParties).not.toContain('superintendent');
      expect(allowedRes.body.instance.templateSnapshot).toBeUndefined();
      expect(JSON.stringify(allowedRes.body.instance)).toContain('Contractor Test Item');
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
  let completionAuthorUserId: string;
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

    const completionAuthor = await registerTestUser(
      'itp-completion-author',
      'ITP Completion Author',
    );
    completionAuthorUserId = completionAuthor.userId;

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
    await cleanupTestUser(completionAuthorUserId);
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  async function markCompletionPendingVerification(completedById: string | null) {
    await prisma.iTPCompletion.update({
      where: { id: completionId },
      data: {
        status: 'completed',
        completedById,
        completedAt: new Date('2026-01-01T00:00:00.000Z'),
        verificationStatus: 'pending_verification',
        verifiedAt: null,
        verifiedById: null,
        verificationNotes: null,
      },
    });
  }

  async function resetCompletionWorkflowState() {
    await prisma.iTPCompletion.update({
      where: { id: completionId },
      data: {
        status: 'pending',
        completedById: null,
        completedAt: null,
        verificationStatus: 'none',
        verifiedAt: null,
        verifiedById: null,
        verificationNotes: null,
      },
    });
  }

  async function getCompletionVerificationState() {
    return prisma.iTPCompletion.findUniqueOrThrow({
      where: { id: completionId },
      select: { verificationStatus: true, verifiedAt: true, verifiedById: true },
    });
  }

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

  it('should enforce one attachment link per completion and document at the database level', async () => {
    const timestamp = Date.now();
    const duplicateGuardDocument = await prisma.document.create({
      data: {
        projectId,
        lotId,
        documentType: 'photo',
        category: 'itp_evidence',
        filename: `duplicate-guard-${timestamp}.jpg`,
        fileUrl: `/uploads/documents/duplicate-guard-${timestamp}.jpg`,
        fileSize: 1024,
        mimeType: 'image/jpeg',
        uploadedById: userId,
      },
    });

    try {
      await prisma.iTPCompletionAttachment.create({
        data: {
          completionId,
          documentId: duplicateGuardDocument.id,
        },
      });

      await expect(
        prisma.iTPCompletionAttachment.create({
          data: {
            completionId,
            documentId: duplicateGuardDocument.id,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      const attachmentCount = await prisma.iTPCompletionAttachment.count({
        where: {
          completionId,
          documentId: duplicateGuardDocument.id,
        },
      });
      expect(attachmentCount).toBe(1);
    } finally {
      await prisma.iTPCompletionAttachment.deleteMany({
        where: { documentId: duplicateGuardDocument.id },
      });
      await prisma.document.delete({ where: { id: duplicateGuardDocument.id } }).catch(() => {});
    }
  });

  it('should handle concurrent duplicate attachment requests idempotently', async () => {
    const timestamp = Date.now();
    const concurrentDocument = await prisma.document.create({
      data: {
        projectId,
        lotId,
        documentType: 'photo',
        category: 'itp_evidence',
        filename: `concurrent-attach-${timestamp}.jpg`,
        fileUrl: `/uploads/documents/concurrent-attach-${timestamp}.jpg`,
        fileSize: 1024,
        mimeType: 'image/jpeg',
        uploadedById: userId,
      },
    });

    try {
      const responses = await Promise.all([
        request(app)
          .post(`/api/itp/completions/${completionId}/attachments`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ documentId: concurrentDocument.id }),
        request(app)
          .post(`/api/itp/completions/${completionId}/attachments`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ documentId: concurrentDocument.id }),
      ]);

      expect(responses.map((res) => res.status).sort()).toEqual([200, 201]);
      expect(new Set(responses.map((res) => res.body.attachment.id)).size).toBe(1);

      const attachmentCount = await prisma.iTPCompletionAttachment.count({
        where: {
          completionId,
          documentId: concurrentDocument.id,
        },
      });
      expect(attachmentCount).toBe(1);
    } finally {
      await prisma.iTPCompletionAttachment.deleteMany({
        where: { documentId: concurrentDocument.id },
      });
      await prisma.document.delete({ where: { id: concurrentDocument.id } }).catch(() => {});
    }
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

  it('should require a verifier revision reason before updating verified completion notes', async () => {
    const originalCompletion = await prisma.iTPCompletion.findUniqueOrThrow({
      where: { id: completionId },
    });

    await prisma.auditLog.deleteMany({
      where: { entityId: completionId, action: AuditAction.ITP_ITEM_UPDATED },
    });

    try {
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          status: 'completed',
          completedById: userId,
          completedAt: new Date('2026-01-01T00:00:00.000Z'),
          notes: 'Verified baseline notes',
          verificationStatus: 'verified',
          verifiedAt: new Date('2026-01-02T00:00:00.000Z'),
          verifiedById: userId,
        },
      });

      const missingReason = await request(app)
        .patch(`/api/itp/completions/${completionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Unexplained post-verification change' });

      expect(missingReason.status).toBe(409);
      expect(missingReason.body.error.message).toContain('revision reason');

      const unchanged = await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id: completionId },
        select: {
          notes: true,
          verificationStatus: true,
          verifiedAt: true,
          verifiedById: true,
        },
      });
      expect(unchanged.notes).toBe('Verified baseline notes');
      expect(unchanged.verificationStatus).toBe('verified');
      expect(unchanged.verifiedAt?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
      expect(unchanged.verifiedById).toBe(userId);

      const corrected = await request(app)
        .patch(`/api/itp/completions/${completionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Verifier-approved correction',
          revisionReason: 'Correcting a typo after verification',
        });

      expect(corrected.status).toBe(200);
      expect(corrected.body.completion.notes).toBe('Verifier-approved correction');
      expect(corrected.body.completion.verificationStatus).toBe('verified');

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'itp_completion',
          entityId: completionId,
          action: AuditAction.ITP_ITEM_UPDATED,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).toBeTruthy();
      expect(parseAuditLogChanges(auditLog?.changes ?? null)).toMatchObject({
        checklistItemId,
        notes: 'Verifier-approved correction',
        previousNotes: 'Verified baseline notes',
        verifiedRevision: true,
        revisionReason: 'Correcting a typo after verification',
      });
    } finally {
      await prisma.auditLog.deleteMany({
        where: { entityId: completionId, action: AuditAction.ITP_ITEM_UPDATED },
      });
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          status: originalCompletion.status,
          completedById: originalCompletion.completedById,
          completedAt: originalCompletion.completedAt,
          notes: originalCompletion.notes,
          verificationStatus: originalCompletion.verificationStatus,
          verifiedAt: originalCompletion.verifiedAt,
          verifiedById: originalCompletion.verifiedById,
          verificationNotes: originalCompletion.verificationNotes,
        },
      });
    }
  });

  it('should reject subcontractor note and attachment writes for hidden superintendent items', async () => {
    const suffix = Date.now();
    const hiddenItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId,
        description: `Hidden superintendent attachment item ${suffix}`,
        pointType: 'witness',
        responsibleParty: 'superintendent',
        sequenceNumber: 50,
      },
    });
    const hiddenCompletion = await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instanceId,
        checklistItemId: hiddenItem.id,
        status: 'pending',
        notes: 'Original hidden note',
      },
    });
    const hiddenAttachment = await prisma.iTPCompletionAttachment.create({
      data: {
        completionId: hiddenCompletion.id,
        documentId,
      },
    });
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `ITP Hidden Attachment Subcontractor ${suffix}`,
        status: 'approved',
        portalAccess: { itps: true },
      },
    });
    const subcontractor = await registerTestUser(
      'itp-hidden-attachment-subcontractor',
      'ITP Hidden Attachment Subcontractor',
    );

    await prisma.user.update({
      where: { id: subcontractor.userId },
      data: { companyId: null, roleInCompany: 'subcontractor' },
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

    try {
      const noteUpdate = await request(app)
        .patch(`/api/itp/completions/${hiddenCompletion.id}`)
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({ notes: 'Subcontractor hidden note update' });
      expect(noteUpdate.status).toBe(403);

      const addAttachment = await request(app)
        .post(`/api/itp/completions/${hiddenCompletion.id}/attachments`)
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({ documentId });
      expect(addAttachment.status).toBe(403);

      const listAttachments = await request(app)
        .get(`/api/itp/completions/${hiddenCompletion.id}/attachments`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(listAttachments.status).toBe(403);

      const deleteAttachment = await request(app)
        .delete(`/api/itp/completions/${hiddenCompletion.id}/attachments/${hiddenAttachment.id}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(deleteAttachment.status).toBe(403);

      const unchangedCompletion = await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id: hiddenCompletion.id },
        select: { notes: true },
      });
      expect(unchangedCompletion.notes).toBe('Original hidden note');

      const attachmentStillPresent = await prisma.iTPCompletionAttachment.findUnique({
        where: { id: hiddenAttachment.id },
      });
      expect(attachmentStillPresent).toBeTruthy();
    } finally {
      await prisma.iTPCompletionAttachment.deleteMany({
        where: { completionId: hiddenCompletion.id },
      });
      await prisma.iTPCompletion.deleteMany({ where: { id: hiddenCompletion.id } });
      await prisma.iTPChecklistItem.deleteMany({ where: { id: hiddenItem.id } });
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

  it('should not create duplicate completions for concurrent checklist item writes', async () => {
    const concurrentChecklistItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId,
        description: `Concurrent completion item ${Date.now()}`,
        pointType: 'verification',
        sequenceNumber: 99,
      },
    });
    const originalInstance = await prisma.iTPInstance.findUniqueOrThrow({
      where: { id: instanceId },
      select: { templateSnapshot: true },
    });
    await prisma.iTPInstance.update({
      where: { id: instanceId },
      data: {
        templateSnapshot: JSON.stringify({
          id: templateId,
          name: 'Attachment Test ITP',
          checklistItems: [
            {
              id: checklistItemId,
              description: 'Upload evidence photo',
              sequenceNumber: 1,
              pointType: 'verification',
              responsibleParty: 'contractor',
            },
            {
              id: concurrentChecklistItem.id,
              description: concurrentChecklistItem.description,
              sequenceNumber: concurrentChecklistItem.sequenceNumber,
              pointType: concurrentChecklistItem.pointType,
              responsibleParty: concurrentChecklistItem.responsibleParty,
            },
          ],
        }),
      },
    });

    let releaseReads: () => void = () => {};
    let matchingReads = 0;
    let middlewareActive = true;
    const bothRequestsHaveReadCompletion = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    const releaseFallback = setTimeout(releaseReads, 2000);

    prisma.$use(async (params, next) => {
      const result = await next(params);
      const where = params.args?.where as
        | { itpInstanceId?: string; checklistItemId?: string }
        | undefined;

      if (
        middlewareActive &&
        params.model === 'ITPCompletion' &&
        params.action === 'findFirst' &&
        params.runInTransaction !== true &&
        where?.itpInstanceId === instanceId &&
        where?.checklistItemId === concurrentChecklistItem.id
      ) {
        matchingReads += 1;
        if (matchingReads === 2) {
          clearTimeout(releaseFallback);
          releaseReads();
        }
        await bothRequestsHaveReadCompletion;
      }

      return result;
    });

    try {
      const [firstRes, secondRes] = await Promise.all([
        request(app).post('/api/itp/completions').set('Authorization', `Bearer ${authToken}`).send({
          itpInstanceId: instanceId,
          checklistItemId: concurrentChecklistItem.id,
          status: 'completed',
          notes: 'First concurrent completion',
        }),
        request(app).post('/api/itp/completions').set('Authorization', `Bearer ${authToken}`).send({
          itpInstanceId: instanceId,
          checklistItemId: concurrentChecklistItem.id,
          status: 'completed',
          notes: 'Second concurrent completion',
        }),
      ]);

      expect(firstRes.status).toBe(200);
      expect(secondRes.status).toBe(200);

      const completions = await prisma.iTPCompletion.findMany({
        where: {
          itpInstanceId: instanceId,
          checklistItemId: concurrentChecklistItem.id,
        },
      });

      expect(completions).toHaveLength(1);
      expect(completions[0].status).toBe('completed');
      expect(['First concurrent completion', 'Second concurrent completion']).toContain(
        completions[0].notes,
      );
    } finally {
      middlewareActive = false;
      clearTimeout(releaseFallback);
      releaseReads();
      await prisma.iTPCompletion.deleteMany({
        where: { checklistItemId: concurrentChecklistItem.id },
      });
      await prisma.iTPInstance.update({
        where: { id: instanceId },
        data: { templateSnapshot: originalInstance.templateSnapshot },
      });
      await prisma.iTPChecklistItem
        .delete({ where: { id: concurrentChecklistItem.id } })
        .catch(() => {});
    }
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

  it('should keep repeat verification idempotent for already verified completions', async () => {
    const verifiedAt = new Date('2026-01-02T03:04:05.000Z');

    try {
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          status: 'completed',
          completedById: userId,
          completedAt: new Date('2026-01-01T00:00:00.000Z'),
          verificationStatus: 'verified',
          verifiedAt,
          verifiedById: userId,
          verificationNotes: 'Original verification note',
        },
      });

      const res = await request(app)
        .post(`/api/itp/completions/${completionId}/verify`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.completion.verificationStatus).toBe('verified');
      expect(res.body.completion.verifiedAt).toBe(verifiedAt.toISOString());

      const completion = await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id: completionId },
        select: {
          verificationStatus: true,
          verifiedAt: true,
          verifiedById: true,
          verificationNotes: true,
        },
      });

      expect(completion.verificationStatus).toBe('verified');
      expect(completion.verifiedAt?.toISOString()).toBe(verifiedAt.toISOString());
      expect(completion.verifiedById).toBe(userId);
      expect(completion.verificationNotes).toBe('Original verification note');
    } finally {
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          status: 'pending',
          completedById: null,
          completedAt: null,
          verificationStatus: 'none',
          verifiedAt: null,
          verifiedById: null,
          verificationNotes: null,
        },
      });
    }
  });

  it('should reject self-verification and self-rejection of pending ITP completions', async () => {
    try {
      await markCompletionPendingVerification(userId);

      const selfVerify = await request(app)
        .post(`/api/itp/completions/${completionId}/verify`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(selfVerify.status).toBe(403);
      expect(selfVerify.body.error.message).toContain('different user');

      const afterSelfVerify = await getCompletionVerificationState();
      expect(afterSelfVerify).toEqual({
        verificationStatus: 'pending_verification',
        verifiedAt: null,
        verifiedById: null,
      });

      const selfReject = await request(app)
        .post(`/api/itp/completions/${completionId}/reject`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Rejecting my own completion' });

      expect(selfReject.status).toBe(403);
      expect(selfReject.body.error.message).toContain('different user');

      const afterSelfReject = await getCompletionVerificationState();
      expect(afterSelfReject).toEqual({
        verificationStatus: 'pending_verification',
        verifiedAt: null,
        verifiedById: null,
      });
    } finally {
      await resetCompletionWorkflowState();
    }
  });

  it('should write audit context when verifying a pending ITP completion', async () => {
    await prisma.auditLog.deleteMany({
      where: { entityId: completionId, action: AuditAction.ITP_ITEM_VERIFIED },
    });

    try {
      await markCompletionPendingVerification(completionAuthorUserId);

      const res = await request(app)
        .post(`/api/itp/completions/${completionId}/verify`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'itp_completion',
          entityId: completionId,
          action: AuditAction.ITP_ITEM_VERIFIED,
        },
      });
      expect(auditLog).toBeTruthy();
      const changes = parseAuditLogChanges(auditLog?.changes ?? null) as Record<string, unknown>;
      expect(changes).toMatchObject({
        lotId,
        checklistItemId,
        verificationStatus: { from: 'pending_verification', to: 'verified' },
      });
    } finally {
      await prisma.auditLog.deleteMany({
        where: { entityId: completionId, action: AuditAction.ITP_ITEM_VERIFIED },
      });
      await resetCompletionWorkflowState();
    }
  });

  it('should write audit context when rejecting a pending ITP completion', async () => {
    await prisma.auditLog.deleteMany({
      where: { entityId: completionId, action: AuditAction.ITP_ITEM_REJECTED },
    });

    try {
      await markCompletionPendingVerification(completionAuthorUserId);

      const res = await request(app)
        .post(`/api/itp/completions/${completionId}/reject`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Evidence photo is missing chainage marker' });

      expect(res.status).toBe(200);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'itp_completion',
          entityId: completionId,
          action: AuditAction.ITP_ITEM_REJECTED,
        },
      });
      expect(auditLog).toBeTruthy();
      const changes = parseAuditLogChanges(auditLog?.changes ?? null) as Record<string, unknown>;
      expect(changes).toMatchObject({
        lotId,
        checklistItemId,
        reason: 'Evidence photo is missing chainage marker',
        verificationStatus: { from: 'pending_verification', to: 'rejected' },
      });
    } finally {
      await prisma.auditLog.deleteMany({
        where: { entityId: completionId, action: AuditAction.ITP_ITEM_REJECTED },
      });
      await resetCompletionWorkflowState();
    }
  });

  it('should reject only pending verification completions', async () => {
    try {
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          status: 'completed',
          completedById: userId,
          completedAt: new Date('2026-01-01T00:00:00.000Z'),
          verificationStatus: 'verified',
          verifiedAt: new Date('2026-01-02T03:04:05.000Z'),
          verifiedById: userId,
          verificationNotes: 'Verified evidence',
        },
      });

      const verifiedReject = await request(app)
        .post(`/api/itp/completions/${completionId}/reject`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Trying to reverse verified item' });

      expect(verifiedReject.status).toBe(409);
      expect(verifiedReject.body.error.message).toContain('pending verification');

      const afterVerifiedReject = await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id: completionId },
        select: { verificationStatus: true, verificationNotes: true },
      });
      expect(afterVerifiedReject.verificationStatus).toBe('verified');
      expect(afterVerifiedReject.verificationNotes).toBe('Verified evidence');

      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          verificationStatus: 'none',
          verifiedAt: null,
          verifiedById: null,
          verificationNotes: null,
        },
      });

      const noneReject = await request(app)
        .post(`/api/itp/completions/${completionId}/reject`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Rejecting item that was never submitted' });

      expect(noneReject.status).toBe(409);
      expect(noneReject.body.error.message).toContain('pending verification');
    } finally {
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          status: 'pending',
          completedById: null,
          completedAt: null,
          verificationStatus: 'none',
          verifiedAt: null,
          verifiedById: null,
          verificationNotes: null,
        },
      });
    }
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
      data: { companyId: null, roleInCompany: 'subcontractor' },
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

  it('should reject view-only subcontractor completion and attachment writes', async () => {
    const suffix = Date.now();
    const beforeCompletion = await prisma.iTPCompletion.findUniqueOrThrow({
      where: { id: completionId },
    });
    const subcontractor = await registerTestUser(
      'itp-view-only-subcontractor',
      'ITP View Only Subcontractor',
    );

    let subcontractorCompanyId: string | undefined;
    let existingAttachmentDocumentId: string | undefined;
    let newAttachmentDocumentId: string | undefined;
    let attachmentId: string | undefined;

    try {
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `ITP View Only Subcontractor ${suffix}`,
          status: 'approved',
          portalAccess: { itps: true },
        },
      });
      subcontractorCompanyId = subcontractorCompany.id;

      await prisma.user.update({
        where: { id: subcontractor.userId },
        data: { companyId: null, roleInCompany: 'subcontractor' },
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
          canCompleteITP: false,
        },
      });

      const existingAttachmentDocument = await prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'photo',
          category: 'itp_evidence',
          filename: `view-only-existing-${suffix}.jpg`,
          fileUrl: `/uploads/documents/view-only-existing-${suffix}.jpg`,
          fileSize: 1024,
          mimeType: 'image/jpeg',
          uploadedById: userId,
        },
      });
      existingAttachmentDocumentId = existingAttachmentDocument.id;
      const newAttachmentDocument = await prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'photo',
          category: 'itp_evidence',
          filename: `view-only-new-${suffix}.jpg`,
          fileUrl: `/uploads/documents/view-only-new-${suffix}.jpg`,
          fileSize: 1024,
          mimeType: 'image/jpeg',
          uploadedById: userId,
        },
      });
      newAttachmentDocumentId = newAttachmentDocument.id;

      const attachment = await prisma.iTPCompletionAttachment.create({
        data: {
          completionId,
          documentId: existingAttachmentDocument.id,
        },
      });
      attachmentId = attachment.id;

      const patchRes = await request(app)
        .patch(`/api/itp/completions/${completionId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({ notes: 'View-only subcontractor should not write notes' });
      expect(patchRes.status).toBe(403);

      for (const status of ['pending', 'completed', 'not_applicable', 'failed']) {
        const createRes = await request(app)
          .post('/api/itp/completions')
          .set('Authorization', `Bearer ${subcontractor.token}`)
          .send({
            itpInstanceId: instanceId,
            checklistItemId,
            status,
            notes: 'View-only subcontractor should not write completion state',
            naReason: 'Not applicable is not authorized',
            ncrDescription: 'Failed status is not authorized',
          });
        expect(createRes.status).toBe(403);
      }

      const attachRes = await request(app)
        .post(`/api/itp/completions/${completionId}/attachments`)
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({ documentId: newAttachmentDocument.id });
      expect(attachRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/api/itp/completions/${completionId}/attachments/${attachment.id}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(deleteRes.status).toBe(403);

      const afterCompletion = await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id: completionId },
      });
      expect(afterCompletion.status).toBe(beforeCompletion.status);
      expect(afterCompletion.notes).toBe(beforeCompletion.notes);
    } finally {
      await prisma.iTPCompletion
        .update({
          where: { id: completionId },
          data: {
            status: beforeCompletion.status,
            notes: beforeCompletion.notes,
            completedAt: beforeCompletion.completedAt,
            completedById: beforeCompletion.completedById,
            verificationStatus: beforeCompletion.verificationStatus,
          },
        })
        .catch(() => {});
      if (attachmentId) {
        await prisma.iTPCompletionAttachment.deleteMany({ where: { id: attachmentId } });
      }
      const testDocumentIds = [existingAttachmentDocumentId, newAttachmentDocumentId].filter(
        (id): id is string => Boolean(id),
      );
      if (testDocumentIds.length > 0) {
        await prisma.document.deleteMany({ where: { id: { in: testDocumentIds } } });
      }
      if (subcontractorCompanyId) {
        await prisma.lotSubcontractorAssignment.deleteMany({
          where: { subcontractorCompanyId },
        });
      }
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      if (subcontractorCompanyId) {
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompanyId } })
          .catch(() => {});
      }
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
      data: { companyId: null, roleInCompany: 'subcontractor' },
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

// Characterization coverage for the POST /api/itp/completions decision logic that is
// about to be extracted into completionWorkflow.ts. These tests pin the observable
// behaviour of each branch (status derivation, the two required-reason validations,
// witness-data persistence, the failed -> NCR transition guard, subcontractor
// verification-status resolution, and the subcontractor completion notification
// payload) against the UNCHANGED handler, so the extraction can be proven byte-for-byte
// behaviour preserving.
describe('ITP Completion Decision Logic (characterization)', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let templateId: string;
  let lotId: string;
  let instanceId: string;
  let contractorItemId: string;
  let subcontractorItemId: string;
  let holdPointItemId: string;
  let witnessItemId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `ITP Decision Company ${Date.now()}` },
    });
    companyId = company.id;

    const registered = await registerTestUser('itp-decision', 'ITP Decision User');
    authToken = registered.token;
    userId = registered.userId;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    const project = await prisma.project.create({
      data: {
        name: `ITP Decision Project ${Date.now()}`,
        projectNumber: `ITPDEC-${Date.now()}`,
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

    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: 'Decision Test ITP',
        activityType: 'Earthworks',
        specificationReference: 'SPEC-DECISION-1',
        checklistItems: {
          create: [
            {
              description: 'Contractor decision item',
              pointType: 'verification',
              responsibleParty: 'contractor',
              sequenceNumber: 1,
            },
            {
              description: 'Subcontractor decision item',
              pointType: 'verification',
              responsibleParty: 'subcontractor',
              sequenceNumber: 2,
            },
            {
              description: 'Hold point decision item',
              pointType: 'hold_point',
              responsibleParty: 'superintendent',
              sequenceNumber: 3,
            },
            {
              description: 'Witness decision item',
              pointType: 'witness',
              responsibleParty: 'superintendent',
              sequenceNumber: 4,
            },
          ],
        },
      },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
    });
    templateId = template.id;
    contractorItemId = template.checklistItems[0].id;
    subcontractorItemId = template.checklistItems[1].id;
    holdPointItemId = template.checklistItems[2].id;
    witnessItemId = template.checklistItems[3].id;

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ITP-DEC-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

    const instance = await prisma.iTPInstance.create({
      data: { lotId, templateId },
    });
    instanceId = instance.id;
  });

  afterAll(async () => {
    await prisma.nCRLot.deleteMany({ where: { lot: { projectId } } });
    await prisma.nCR.deleteMany({ where: { projectId } });
    await prisma.holdPoint.deleteMany({ where: { lotId } });
    await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lotId } } });
    await prisma.iTPInstance.deleteMany({ where: { lotId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await cleanupTestUser(userId);
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  async function resetContractorCompletion() {
    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
    });
    await prisma.lot.update({ where: { id: lotId }, data: { status: 'not_started' } });
  }

  // I1-core: a hold-point (superintendent sign-off) item must go through the
  // hold-point release flow before it can be completed via the bare path.
  it('rejects completing a hold-point item via the bare path and persists nothing', async () => {
    await prisma.holdPoint.deleteMany({ where: { lotId, itpChecklistItemId: holdPointItemId } });
    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: holdPointItemId },
    });

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: holdPointItemId,
        status: 'completed',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('hold-point release flow');

    const completion = await prisma.iTPCompletion.findFirst({
      where: { itpInstanceId: instanceId, checklistItemId: holdPointItemId },
    });
    expect(completion).toBeNull();
  });

  it('allows completing a hold-point item once its hold point has been released', async () => {
    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: holdPointItemId },
    });
    await prisma.holdPoint.deleteMany({ where: { lotId, itpChecklistItemId: holdPointItemId } });
    await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: holdPointItemId,
        pointType: 'hold_point',
        status: 'released',
        releasedByName: 'Released Superintendent',
        releasedAt: new Date(),
      },
    });

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: holdPointItemId,
        status: 'completed',
      });

    expect(res.status).toBe(200);
    expect(res.body.completion.status).toBe('completed');

    await prisma.holdPoint.deleteMany({ where: { lotId, itpChecklistItemId: holdPointItemId } });
    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: holdPointItemId },
    });
  });

  it('does not block N/A on a hold-point item (only completion is gated)', async () => {
    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: holdPointItemId },
    });
    await prisma.holdPoint.deleteMany({ where: { lotId, itpChecklistItemId: holdPointItemId } });

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: holdPointItemId,
        status: 'not_applicable',
        notes: 'Not applicable for this lot',
      });

    expect(res.status).toBe(200);
    expect(res.body.completion.status).toBe('not_applicable');

    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: holdPointItemId },
    });
  });

  it('still completes a standard/witness item via the bare path (regression)', async () => {
    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: witnessItemId },
    });

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: witnessItemId,
        status: 'completed',
      });

    expect(res.status).toBe(200);
    expect(res.body.completion.status).toBe('completed');
    expect(res.body.completion.completedById).toBe(userId);

    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: witnessItemId },
    });
  });

  it('requires a reason when marking an item N/A and persists nothing', async () => {
    await resetContractorCompletion();

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        status: 'not_applicable',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('A reason is required when marking an item as N/A');

    const completion = await prisma.iTPCompletion.findFirst({
      where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
    });
    expect(completion).toBeNull();
  });

  it('accepts an N/A completion when a reason note is supplied', async () => {
    await resetContractorCompletion();

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        status: 'not_applicable',
        notes: 'Not applicable for this chainage',
      });

    expect(res.status).toBe(200);
    expect(res.body.completion.status).toBe('not_applicable');
    expect(res.body.completion.isNotApplicable).toBe(true);
    expect(res.body.completion.isCompleted).toBe(true);
    expect(res.body.completion.completedById).toBe(userId);
    expect(res.body.completion.completedAt).not.toBeNull();
  });

  it('requires an NCR description when marking an item Failed and persists nothing', async () => {
    await resetContractorCompletion();

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        status: 'failed',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(
      'NCR description is required when marking an item as Failed',
    );

    const completion = await prisma.iTPCompletion.findFirst({
      where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
    });
    expect(completion).toBeNull();
  });

  it('derives completed status from the isCompleted flag when no explicit status is sent', async () => {
    await resetContractorCompletion();

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        isCompleted: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.completion.status).toBe('completed');
    expect(res.body.completion.isCompleted).toBe(true);
    expect(res.body.completion.completedById).toBe(userId);
  });

  it('derives pending status (no completedAt) when isCompleted is false and no status is sent', async () => {
    await resetContractorCompletion();

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        isCompleted: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.completion.status).toBe('pending');
    expect(res.body.completion.isCompleted).toBe(false);
    expect(res.body.completion.completedAt).toBeNull();
    expect(res.body.completion.completedById).toBeNull();
  });

  it('prefers the explicit status over the isCompleted flag', async () => {
    await resetContractorCompletion();

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        status: 'pending',
        isCompleted: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.completion.status).toBe('pending');
    expect(res.body.completion.completedAt).toBeNull();
  });

  it('persists only the witness fields that are supplied, coercing empties to null', async () => {
    await resetContractorCompletion();

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        status: 'completed',
        witnessPresent: true,
        witnessName: 'Jane Inspector',
        witnessCompany: '',
      });

    expect(res.status).toBe(200);

    const completion = await prisma.iTPCompletion.findFirstOrThrow({
      where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
    });
    expect(completion.witnessPresent).toBe(true);
    expect(completion.witnessName).toBe('Jane Inspector');
    expect(completion.witnessCompany).toBeNull();
  });

  it('creates an NCR on the first transition to failed and flips the lot to ncr_raised', async () => {
    await resetContractorCompletion();

    const res = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        status: 'failed',
        ncrDescription: 'Compaction below specification',
        ncrCategory: 'workmanship',
        ncrSeverity: 'major',
      });

    expect(res.status).toBe(200);
    expect(res.body.ncr).not.toBeNull();
    expect(res.body.completion.linkedNcr).not.toBeNull();
    expect(res.body.ncr.severity).toBe('major');
    expect(res.body.ncr.qmApprovalRequired).toBe(true);
    expect(res.body.ncr.clientNotificationRequired).toBe(true);
    expect(res.body.ncr.specificationReference).toBe('SPEC-DECISION-1');

    const persistedNcr = await prisma.nCR.findUniqueOrThrow({
      where: { id: res.body.ncr.id },
      select: { clientNotificationRequired: true, clientNotifiedAt: true },
    });
    expect(persistedNcr.clientNotificationRequired).toBe(true);
    expect(persistedNcr.clientNotifiedAt).toBeNull();

    const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
    expect(lot.status).toBe('ncr_raised');

    const ncrCountAfterFirst = await prisma.nCR.count({ where: { projectId } });
    expect(ncrCountAfterFirst).toBe(1);

    // Re-submitting failed for an item already failed must NOT create a second NCR
    // (shouldCreateFailedNcr guard: existingCompletion?.status !== 'failed').
    const repeat = await request(app)
      .post('/api/itp/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        status: 'failed',
        ncrDescription: 'Still below specification',
      });

    expect(repeat.status).toBe(200);
    expect(repeat.body.ncr).toBeNull();

    const ncrCountAfterRepeat = await prisma.nCR.count({ where: { projectId } });
    expect(ncrCountAfterRepeat).toBe(1);
  });

  it('rejects subcontractor completion writes to hidden superintendent checklist items', async () => {
    const suffix = Date.now();
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `ITP Hidden Completion ${suffix}`,
        status: 'approved',
        portalAccess: { itps: true },
      },
    });
    const subcontractor = await registerTestUser(
      'itp-hidden-completion-subcontractor',
      'ITP Hidden Completion Subcontractor',
    );

    await prisma.user.update({
      where: { id: subcontractor.userId },
      data: { companyId: null, roleInCompany: 'subcontractor' },
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
    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: witnessItemId },
    });

    try {
      const res = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({
          itpInstanceId: instanceId,
          checklistItemId: witnessItemId,
          status: 'completed',
        });

      expect(res.status).toBe(403);

      const completion = await prisma.iTPCompletion.findFirst({
        where: { itpInstanceId: instanceId, checklistItemId: witnessItemId },
      });
      expect(completion).toBeNull();
    } finally {
      await prisma.iTPCompletion.deleteMany({
        where: { itpInstanceId: instanceId, checklistItemId: witnessItemId },
      });
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

  it('rejects bare POST completion overwrites for verified checklist items', async () => {
    await resetContractorCompletion();
    await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        status: 'completed',
        notes: 'Verified completion baseline',
        completedById: userId,
        completedAt: new Date('2026-01-01T00:00:00.000Z'),
        verificationStatus: 'verified',
        verifiedById: userId,
        verifiedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    });

    try {
      const res = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itpInstanceId: instanceId,
          checklistItemId: contractorItemId,
          status: 'pending',
          notes: 'Unreviewed verified overwrite',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Verified ITP completions');

      const unchanged = await prisma.iTPCompletion.findFirstOrThrow({
        where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
        select: { status: true, notes: true, verificationStatus: true, verifiedAt: true },
      });
      expect(unchanged.status).toBe('completed');
      expect(unchanged.notes).toBe('Verified completion baseline');
      expect(unchanged.verificationStatus).toBe('verified');
      expect(unchanged.verifiedAt?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    } finally {
      await prisma.iTPCompletion.deleteMany({
        where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
      });
    }
  });

  it('rejects bare POST completion overwrites for failed checklist items', async () => {
    await resetContractorCompletion();
    await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        status: 'failed',
        notes: 'Failed baseline from server',
        completedById: userId,
        completedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    try {
      const res = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itpInstanceId: instanceId,
          checklistItemId: contractorItemId,
          status: 'completed',
          notes: 'Stale offline pass',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Failed ITP completions');

      const unchanged = await prisma.iTPCompletion.findFirstOrThrow({
        where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
        select: { status: true, notes: true, completedAt: true, completedById: true },
      });
      expect(unchanged.status).toBe('failed');
      expect(unchanged.notes).toBe('Failed baseline from server');
      expect(unchanged.completedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(unchanged.completedById).toBe(userId);
    } finally {
      await prisma.iTPCompletion.deleteMany({
        where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
      });
    }
  });

  it('rejects stale queued offline completion writes when the server row changed since the user cached it', async () => {
    await resetContractorCompletion();
    await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        status: 'completed',
        notes: 'Server pass from another user',
        completedById: userId,
        completedAt: new Date('2026-06-12T00:00:00.000Z'),
      },
    });

    try {
      const res = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itpInstanceId: instanceId,
          checklistItemId: contractorItemId,
          status: 'pending',
          notes: 'Stale offline untick',
          expectedPreviousCompletion: {
            exists: true,
            status: 'pending',
            notes: null,
            completedAt: null,
          },
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain(
        'ITP completion changed while this offline update was queued',
      );

      const unchanged = await prisma.iTPCompletion.findFirstOrThrow({
        where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
        select: { status: true, notes: true, completedAt: true, completedById: true },
      });
      expect(unchanged.status).toBe('completed');
      expect(unchanged.notes).toBe('Server pass from another user');
      expect(unchanged.completedAt?.toISOString()).toBe('2026-06-12T00:00:00.000Z');
      expect(unchanged.completedById).toBe(userId);
    } finally {
      await prisma.iTPCompletion.deleteMany({
        where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
      });
    }
  });

  it('rejects queued offline completion writes that started from no row after a server row appears', async () => {
    await resetContractorCompletion();
    await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instanceId,
        checklistItemId: contractorItemId,
        status: 'not_applicable',
        notes: 'Server N/A from supervisor',
        completedById: userId,
        completedAt: new Date('2026-06-12T00:00:00.000Z'),
      },
    });

    try {
      const res = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itpInstanceId: instanceId,
          checklistItemId: contractorItemId,
          status: 'completed',
          notes: 'Stale offline pass',
          expectedPreviousCompletion: { exists: false },
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain(
        'ITP completion changed while this offline update was queued',
      );

      const unchanged = await prisma.iTPCompletion.findFirstOrThrow({
        where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
        select: { status: true, notes: true, completedAt: true, completedById: true },
      });
      expect(unchanged.status).toBe('not_applicable');
      expect(unchanged.notes).toBe('Server N/A from supervisor');
      expect(unchanged.completedAt?.toISOString()).toBe('2026-06-12T00:00:00.000Z');
      expect(unchanged.completedById).toBe(userId);
    } finally {
      await prisma.iTPCompletion.deleteMany({
        where: { itpInstanceId: instanceId, checklistItemId: contractorItemId },
      });
    }
  });

  it('auto-verifies a subcontractor completion when the project does not require verification', async () => {
    const suffix = Date.now();
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `ITP Decision Auto Verify ${suffix}`,
        status: 'approved',
        portalAccess: { itps: true },
      },
    });
    const subcontractor = await registerTestUser(
      'itp-decision-autoverify',
      'ITP Decision Auto Verify Subcontractor',
    );

    await prisma.user.update({
      where: { id: subcontractor.userId },
      data: { companyId: null, roleInCompany: 'subcontractor' },
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
        itpRequiresVerification: true,
      },
    });
    await prisma.project.update({ where: { id: projectId }, data: { settings: null } });
    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: subcontractorItemId },
    });

    try {
      const res = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({
          itpInstanceId: instanceId,
          checklistItemId: subcontractorItemId,
          status: 'completed',
        });

      expect(res.status).toBe(200);
      expect(res.body.completion.verificationStatus).toBe('verified');
      expect(res.body.completion.isVerified).toBe(true);
      expect(res.body.subbieCompletionNotification).toBeNull();
    } finally {
      await prisma.iTPCompletion.deleteMany({
        where: { itpInstanceId: instanceId, checklistItemId: subcontractorItemId },
      });
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

  it('sets pending_verification and notifies the HC team when the project requires verification', async () => {
    const suffix = Date.now();
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `ITP Decision Pending Verify ${suffix}`,
        status: 'approved',
        portalAccess: { itps: true },
      },
    });
    const subcontractor = await registerTestUser(
      'itp-decision-pendingverify',
      'ITP Decision Pending Verify Subcontractor',
    );

    await prisma.user.update({
      where: { id: subcontractor.userId },
      data: { companyId: null, roleInCompany: 'subcontractor' },
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
        itpRequiresVerification: true,
      },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { settings: JSON.stringify({ requireSubcontractorVerification: true }) },
    });
    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: subcontractorItemId },
    });
    await prisma.notification.deleteMany({
      where: { projectId, type: 'itp_subbie_completion' },
    });

    try {
      const res = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({
          itpInstanceId: instanceId,
          checklistItemId: subcontractorItemId,
          status: 'completed',
        });

      expect(res.status).toBe(200);
      expect(res.body.completion.verificationStatus).toBe('pending_verification');
      expect(res.body.completion.isPendingVerification).toBe(true);
      expect(res.body.subbieCompletionNotification).toMatchObject({
        notificationsSent: 1,
        subcontractorCompany: subcontractorCompany.companyName,
        lotNumber: expect.any(String),
        itemDescription: 'Subcontractor decision item',
      });

      const notifications = await prisma.notification.findMany({
        where: { projectId, type: 'itp_subbie_completion', userId },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Subcontractor ITP Item Completed');
      expect(notifications[0].message).toContain(subcontractorCompany.companyName);
    } finally {
      await prisma.notification.deleteMany({
        where: { projectId, type: 'itp_subbie_completion' },
      });
      await prisma.iTPCompletion.deleteMany({
        where: { itpInstanceId: instanceId, checklistItemId: subcontractorItemId },
      });
      await prisma.lotSubcontractorAssignment.deleteMany({
        where: { subcontractorCompanyId: subcontractorCompany.id },
      });
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await cleanupTestUser(subcontractor.userId);
      await prisma.project.update({ where: { id: projectId }, data: { settings: null } });
    }
  });

  it('auto-verifies (no notification) when the project requires verification but the lot assignment does not', async () => {
    const suffix = Date.now();
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `ITP Decision Lot Override ${suffix}`,
        status: 'approved',
        portalAccess: { itps: true },
      },
    });
    const subcontractor = await registerTestUser(
      'itp-decision-lotoverride',
      'ITP Decision Lot Override Subcontractor',
    );

    await prisma.user.update({
      where: { id: subcontractor.userId },
      data: { companyId: null, roleInCompany: 'subcontractor' },
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
        itpRequiresVerification: false,
      },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { settings: JSON.stringify({ requireSubcontractorVerification: true }) },
    });
    await prisma.iTPCompletion.deleteMany({
      where: { itpInstanceId: instanceId, checklistItemId: subcontractorItemId },
    });
    await prisma.notification.deleteMany({
      where: { projectId, type: 'itp_subbie_completion' },
    });

    try {
      const res = await request(app)
        .post('/api/itp/completions')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({
          itpInstanceId: instanceId,
          checklistItemId: subcontractorItemId,
          status: 'completed',
        });

      expect(res.status).toBe(200);
      expect(res.body.completion.verificationStatus).toBe('verified');
      expect(res.body.subbieCompletionNotification).toBeNull();

      const notifications = await prisma.notification.findMany({
        where: { projectId, type: 'itp_subbie_completion' },
      });
      expect(notifications).toHaveLength(0);
    } finally {
      await prisma.notification.deleteMany({
        where: { projectId, type: 'itp_subbie_completion' },
      });
      await prisma.iTPCompletion.deleteMany({
        where: { itpInstanceId: instanceId, checklistItemId: subcontractorItemId },
      });
      await prisma.lotSubcontractorAssignment.deleteMany({
        where: { subcontractorCompanyId: subcontractorCompany.id },
      });
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await cleanupTestUser(subcontractor.userId);
      await prisma.project.update({ where: { id: projectId }, data: { settings: null } });
    }
  });
});
