import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { activeSubcontractorCompanyWhere } from '../../lib/projectAccess.js';

export async function requireSubcontractorInProject(subcontractorId: string, projectId: string) {
  const subcontractor = await prisma.subcontractorCompany.findFirst({
    where: activeSubcontractorCompanyWhere({ id: subcontractorId, projectId }),
    select: { id: true },
  });

  if (!subcontractor) {
    throw AppError.notFound('Subcontractor company');
  }
}

export async function requireItpTemplateForProject(templateId: string, projectId: string) {
  const template = await prisma.iTPTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, projectId: true, isActive: true },
  });

  if (!template) {
    throw AppError.notFound('ITP template');
  }

  if (!template.isActive) {
    throw AppError.badRequest('ITP template is archived and cannot be assigned');
  }

  if (template.projectId && template.projectId !== projectId) {
    throw AppError.badRequest('ITP template is not available for this project');
  }
}

export async function syncPrimaryLotSubcontractorAssignment(
  tx: Prisma.TransactionClient,
  options: {
    lotId: string;
    projectId: string;
    subcontractorId: string | null | undefined;
    assignedById: string;
    canCompleteITP?: boolean;
    itpRequiresVerification?: boolean;
  },
) {
  const {
    lotId,
    projectId,
    subcontractorId,
    assignedById,
    canCompleteITP,
    itpRequiresVerification,
  } = options;

  await tx.lotSubcontractorAssignment.updateMany({
    where: {
      lotId,
      status: 'active',
      ...(subcontractorId ? { subcontractorCompanyId: { not: subcontractorId } } : {}),
    },
    data: { status: 'removed' },
  });

  if (!subcontractorId) {
    return;
  }

  await tx.lotSubcontractorAssignment.upsert({
    where: {
      lotId_subcontractorCompanyId: {
        lotId,
        subcontractorCompanyId: subcontractorId,
      },
    },
    update: {
      projectId,
      status: 'active',
      assignedById,
      assignedAt: new Date(),
      ...(canCompleteITP !== undefined ? { canCompleteITP } : {}),
      ...(itpRequiresVerification !== undefined ? { itpRequiresVerification } : {}),
    },
    create: {
      lotId,
      projectId,
      subcontractorCompanyId: subcontractorId,
      canCompleteITP: canCompleteITP ?? false,
      itpRequiresVerification: itpRequiresVerification ?? true,
      assignedById,
      status: 'active',
    },
  });
}
