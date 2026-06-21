import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import {
  activeSubcontractorCompanyWhere,
  assertProjectAllowsWrite,
  checkProjectAccess,
  hasSubcontractorPortalModuleAccess,
  requireSubcontractorPortalModuleAccess,
} from '../../lib/projectAccess.js';
import type { SubcontractorPortalAccessKey } from '../../lib/projectAccess.js';

type AuthUser = NonNullable<Express.Request['user']>;

export type DocumentAccessRecord = {
  projectId: string;
  lotId: string | null;
  uploadedById: string | null;
  documentType?: string | null;
  category?: string | null;
};

const DOCUMENT_WRITE_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'site_engineer',
  'foreman',
  'subcontractor_admin',
  'subcontractor',
];

const DOCUMENT_SPECIAL_PORTAL_CATEGORIES = ['itp_evidence', 'test_results'] as const;
const DOCUMENT_CATEGORY_PORTAL_MODULES: Record<
  (typeof DOCUMENT_SPECIAL_PORTAL_CATEGORIES)[number],
  SubcontractorPortalAccessKey
> = {
  itp_evidence: 'itps',
  test_results: 'testResults',
};
const GENERIC_DOCUMENT_MUTATION_BLOCKED_MESSAGES: Record<string, string> = {
  test_certificate:
    'Test result certificates must be replaced or removed from the test result workflow.',
  drawing: 'Drawing files must be managed from the drawing register.',
};

function isDocumentSubcontractorUser(user: AuthUser): boolean {
  return user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin';
}

function isDrawingBackedDocument(documentType?: string | null): boolean {
  return documentType === 'drawing';
}

function getDocumentPortalModule(category?: string | null): SubcontractorPortalAccessKey {
  if (category && Object.hasOwn(DOCUMENT_CATEGORY_PORTAL_MODULES, category)) {
    return DOCUMENT_CATEGORY_PORTAL_MODULES[
      category as (typeof DOCUMENT_SPECIAL_PORTAL_CATEGORIES)[number]
    ];
  }

  return 'documents';
}

function appendDocumentWhereClause(
  where: Prisma.DocumentWhereInput,
  clause: Prisma.DocumentWhereInput,
): void {
  where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), clause];
}

async function hasSubcontractorDocumentPortalAccess(
  user: AuthUser,
  projectId: string,
  category?: string | null,
): Promise<boolean> {
  if (!isDocumentSubcontractorUser(user)) {
    return true;
  }

  return hasSubcontractorPortalModuleAccess({
    userId: user.id,
    role: user.roleInCompany,
    projectId,
    module: getDocumentPortalModule(category),
  });
}

export async function requireSubcontractorDocumentPortalAccess(
  user: AuthUser,
  projectId: string,
  category?: string | null,
): Promise<void> {
  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  await requireSubcontractorPortalModuleAccess({
    userId: user.id,
    role: user.roleInCompany,
    projectId,
    module: getDocumentPortalModule(category),
  });
}

async function getProjectSubcontractorCompanyId(
  userId: string,
  projectId: string,
): Promise<string | null> {
  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { subcontractorCompanyId: true },
  });

  return subcontractorUser?.subcontractorCompanyId ?? null;
}

async function getAssignedDocumentLotIds(
  projectId: string,
  subcontractorCompanyId: string,
): Promise<string[]> {
  const [assignments, legacyLots] = await Promise.all([
    prisma.lotSubcontractorAssignment.findMany({
      where: {
        projectId,
        subcontractorCompanyId,
        status: 'active',
      },
      select: { lotId: true },
    }),
    prisma.lot.findMany({
      where: {
        projectId,
        assignedSubcontractorId: subcontractorCompanyId,
      },
      select: { id: true },
    }),
  ]);

  return [
    ...new Set([
      ...assignments.map((assignment) => assignment.lotId),
      ...legacyLots.map((lot) => lot.id),
    ]),
  ];
}

export async function applyDocumentReadScope(
  user: AuthUser,
  projectId: string,
  where: Prisma.DocumentWhereInput,
): Promise<void> {
  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  const subcontractorCompanyId = await getProjectSubcontractorCompanyId(user.id, projectId);
  if (!subcontractorCompanyId) {
    where.id = '__no_subcontractor_document_access__';
    return;
  }

  const assignedLotIds = await getAssignedDocumentLotIds(projectId, subcontractorCompanyId);
  const scopedAccess: Prisma.DocumentWhereInput = {
    OR: [
      { lotId: null },
      { uploadedById: user.id },
      ...(assignedLotIds.length > 0 ? [{ lotId: { in: assignedLotIds } }] : []),
    ],
  };

  appendDocumentWhereClause(where, scopedAccess);
  appendDocumentWhereClause(where, { NOT: { documentType: 'drawing' } });
}

export async function applyDocumentPortalCategoryScope(
  user: AuthUser,
  projectId: string,
  where: Prisma.DocumentWhereInput,
): Promise<void> {
  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  const [canReadGeneralDocuments, canReadItpEvidence, canReadTestResults] = await Promise.all([
    hasSubcontractorDocumentPortalAccess(user, projectId, null),
    hasSubcontractorDocumentPortalAccess(user, projectId, 'itp_evidence'),
    hasSubcontractorDocumentPortalAccess(user, projectId, 'test_results'),
  ]);

  const categoryAccess: Prisma.DocumentWhereInput[] = [];
  if (canReadGeneralDocuments) {
    categoryAccess.push(
      { category: null },
      { category: { notIn: [...DOCUMENT_SPECIAL_PORTAL_CATEGORIES] } },
    );
  }
  if (canReadItpEvidence) {
    categoryAccess.push({ category: 'itp_evidence' });
  }
  if (canReadTestResults) {
    categoryAccess.push({ category: 'test_results' });
  }

  if (categoryAccess.length === 0) {
    where.id = '__no_subcontractor_document_portal_access__';
    return;
  }

  appendDocumentWhereClause(where, { OR: categoryAccess });
}

export async function canReadDocument(
  user: AuthUser,
  document: DocumentAccessRecord,
): Promise<boolean> {
  if (!(await checkProjectAccess(user.id, document.projectId))) {
    return false;
  }

  if (!isDocumentSubcontractorUser(user)) {
    return true;
  }

  if (isDrawingBackedDocument(document.documentType)) {
    return false;
  }

  if (!(await hasSubcontractorDocumentPortalAccess(user, document.projectId, document.category))) {
    return false;
  }

  if (!document.lotId || document.uploadedById === user.id) {
    return true;
  }

  const subcontractorCompanyId = await getProjectSubcontractorCompanyId(
    user.id,
    document.projectId,
  );
  if (!subcontractorCompanyId) {
    return false;
  }

  const assignedLotIds = await getAssignedDocumentLotIds(
    document.projectId,
    subcontractorCompanyId,
  );
  return assignedLotIds.includes(document.lotId);
}

async function getEffectiveProjectRole(user: AuthUser, projectId: string): Promise<string | null> {
  const isSubcontractor = isDocumentSubcontractorUser(user);
  const [project, projectUser] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    }),
    isSubcontractor
      ? null
      : prisma.projectUser.findFirst({
          where: {
            projectId,
            userId: user.id,
            status: 'active',
          },
          select: { role: true },
        }),
  ]);

  if (!project) {
    throw AppError.notFound('Project');
  }

  if (
    !isSubcontractor &&
    (user.roleInCompany === 'owner' || user.roleInCompany === 'admin') &&
    project.companyId === user.companyId
  ) {
    return user.roleInCompany;
  }

  if (projectUser) {
    return projectUser.role;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId: user.id,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { role: true },
  });

  return subcontractorUser ? user.roleInCompany : null;
}

async function requireProjectWriteAccess(user: AuthUser, projectId: string): Promise<void> {
  if (!(await checkProjectAccess(user.id, projectId))) {
    throw AppError.forbidden('Access denied');
  }

  const effectiveRole = await getEffectiveProjectRole(user, projectId);
  if (!effectiveRole || !DOCUMENT_WRITE_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Document write access required');
  }

  await assertProjectAllowsWrite(projectId);
}

async function requireLotInProject(projectId: string, lotId?: string | null): Promise<void> {
  if (!lotId) return;

  const lot = await prisma.lot.findFirst({
    where: { id: lotId, projectId },
    select: { id: true },
  });

  if (!lot) {
    throw AppError.badRequest('lotId must belong to the document project');
  }
}

async function requireSubcontractorAssignedLotWriteScope(
  user: AuthUser,
  projectId: string,
  lotId?: string | null,
  message = 'Subcontractor document writes must be linked to an assigned lot',
): Promise<void> {
  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  if (!lotId) {
    throw AppError.forbidden(message);
  }

  const subcontractorCompanyId = await getProjectSubcontractorCompanyId(user.id, projectId);
  if (!subcontractorCompanyId) {
    throw AppError.forbidden('Access denied');
  }

  const assignedLotIds = await getAssignedDocumentLotIds(projectId, subcontractorCompanyId);
  if (!assignedLotIds.includes(lotId)) {
    throw AppError.forbidden('Subcontractor document writes are limited to assigned lots');
  }
}

export async function requireDocumentUploadAccess(
  user: AuthUser,
  projectId: string,
  lotId?: string | null,
  category?: string | null,
): Promise<void> {
  await requireProjectWriteAccess(user, projectId);
  await requireSubcontractorDocumentPortalAccess(user, projectId, category);
  await requireLotInProject(projectId, lotId);
  await requireSubcontractorAssignedLotWriteScope(user, projectId, lotId);
}

export async function requireDocumentMutationAccess(
  user: AuthUser,
  document: DocumentAccessRecord,
  targetLotId?: string | null,
  targetCategory?: string | null,
): Promise<void> {
  await requireProjectWriteAccess(user, document.projectId);

  if (targetLotId !== undefined) {
    await requireLotInProject(document.projectId, targetLotId);
  }

  const blockedMessage = document.documentType
    ? GENERIC_DOCUMENT_MUTATION_BLOCKED_MESSAGES[document.documentType]
    : null;
  if (blockedMessage) {
    throw AppError.conflict(blockedMessage, {
      documentType: document.documentType,
    });
  }

  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  if (document.uploadedById !== user.id) {
    throw AppError.forbidden('Only the uploading subcontractor can modify this document');
  }

  const effectiveCategory = targetCategory !== undefined ? targetCategory : document.category;
  await requireSubcontractorDocumentPortalAccess(user, document.projectId, effectiveCategory);

  const effectiveLotId = targetLotId !== undefined ? targetLotId : document.lotId;
  await requireSubcontractorAssignedLotWriteScope(
    user,
    document.projectId,
    effectiveLotId,
    'Subcontractor documents must stay linked to an assigned lot',
  );
}
