import { describe, expect, it } from 'vitest';
import { prisma } from './prisma.js';
import {
  checkProjectAccess,
  hasSubcontractorPortalModuleAccess,
  requireSubcontractorPortalModuleAccess,
} from './projectAccess.js';

describe('checkProjectAccess', () => {
  it('does not grant subcontractor roles project access through project memberships', async () => {
    const suffix = Date.now();
    const company = await prisma.company.create({
      data: { name: `Project Membership Bypass Company ${suffix}` },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: `Project Membership Bypass ${suffix}`,
        projectNumber: `PMB-${suffix}`,
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `project-membership-bypass-sub-${suffix}@example.com`,
        fullName: 'Project Membership Bypass Subcontractor',
        roleInCompany: 'subcontractor',
        companyId: company.id,
      },
    });
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId: project.id,
        companyName: `Project Membership Bypass Sub ${suffix}`,
        primaryContactName: 'Project Membership Bypass Subcontractor',
        primaryContactEmail: `project-membership-bypass-company-${suffix}@example.com`,
        status: 'suspended',
        portalAccess: {
          lots: true,
          itps: true,
          holdPoints: true,
          testResults: true,
          ncrs: true,
          documents: true,
        },
      },
    });

    try {
      await prisma.subcontractorUser.create({
        data: {
          userId: user.id,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'user',
        },
      });
      await prisma.projectUser.create({
        data: {
          projectId: project.id,
          userId: user.id,
          role: 'project_manager',
          status: 'active',
        },
      });

      await expect(checkProjectAccess(user.id, project.id)).resolves.toBe(false);
      await expect(
        hasSubcontractorPortalModuleAccess({
          userId: user.id,
          role: user.roleInCompany,
          projectId: project.id,
          module: 'documents',
        }),
      ).resolves.toBe(false);

      await prisma.subcontractorUser.deleteMany({ where: { userId: user.id } });
      await expect(checkProjectAccess(user.id, project.id)).resolves.toBe(false);
      await expect(
        hasSubcontractorPortalModuleAccess({
          userId: user.id,
          role: user.roleInCompany,
          projectId: project.id,
          module: 'documents',
        }),
      ).resolves.toBe(false);
    } finally {
      await prisma.projectUser.deleteMany({ where: { projectId: project.id, userId: user.id } });
      await prisma.subcontractorUser.deleteMany({ where: { userId: user.id } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });

  it('denies suspended and removed subcontractor project links', async () => {
    const suffix = Date.now();
    const company = await prisma.company.create({
      data: { name: `Project Access Company ${suffix}` },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: `Project Access ${suffix}`,
        projectNumber: `PA-${suffix}`,
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `project-access-sub-${suffix}@example.com`,
        fullName: 'Project Access Subcontractor',
        roleInCompany: 'subcontractor',
        companyId: company.id,
      },
    });
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId: project.id,
        companyName: `Project Access Sub ${suffix}`,
        primaryContactName: 'Project Access Subcontractor',
        primaryContactEmail: `project-access-company-${suffix}@example.com`,
        status: 'approved',
      },
    });

    try {
      await prisma.subcontractorUser.create({
        data: {
          userId: user.id,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'user',
        },
      });

      await expect(checkProjectAccess(user.id, project.id)).resolves.toBe(true);

      await prisma.subcontractorCompany.update({
        where: { id: subcontractorCompany.id },
        data: { status: 'suspended' },
      });
      await expect(checkProjectAccess(user.id, project.id)).resolves.toBe(false);

      await prisma.subcontractorCompany.update({
        where: { id: subcontractorCompany.id },
        data: { status: 'removed' },
      });
      await expect(checkProjectAccess(user.id, project.id)).resolves.toBe(false);
    } finally {
      await prisma.subcontractorUser.deleteMany({
        where: { subcontractorCompanyId: subcontractorCompany.id },
      });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });

  it('enforces subcontractor portal module switches without removing project access', async () => {
    const suffix = Date.now();
    const company = await prisma.company.create({
      data: { name: `Portal Access Company ${suffix}` },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: `Portal Access ${suffix}`,
        projectNumber: `PMA-${suffix}`,
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `portal-module-sub-${suffix}@example.com`,
        fullName: 'Portal Module Subcontractor',
        roleInCompany: 'subcontractor_admin',
        companyId: company.id,
      },
    });
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId: project.id,
        companyName: `Portal Module Sub ${suffix}`,
        primaryContactName: 'Portal Module Subcontractor',
        primaryContactEmail: `portal-module-company-${suffix}@example.com`,
        status: 'approved',
        portalAccess: {
          lots: true,
          itps: false,
          holdPoints: false,
          testResults: false,
          ncrs: true,
          documents: false,
        },
      },
    });

    try {
      await prisma.subcontractorUser.create({
        data: {
          userId: user.id,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'admin',
        },
      });

      await expect(checkProjectAccess(user.id, project.id)).resolves.toBe(true);
      await expect(
        hasSubcontractorPortalModuleAccess({
          userId: user.id,
          role: user.roleInCompany,
          projectId: project.id,
          module: 'ncrs',
        }),
      ).resolves.toBe(true);
      await expect(
        hasSubcontractorPortalModuleAccess({
          userId: user.id,
          role: user.roleInCompany,
          projectId: project.id,
          module: 'itps',
        }),
      ).resolves.toBe(false);
      await expect(
        requireSubcontractorPortalModuleAccess({
          userId: user.id,
          role: user.roleInCompany,
          projectId: project.id,
          module: 'itps',
        }),
      ).rejects.toThrow('ITPs portal access is not enabled');
    } finally {
      await prisma.subcontractorUser.deleteMany({
        where: { subcontractorCompanyId: subcontractorCompany.id },
      });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });
});
