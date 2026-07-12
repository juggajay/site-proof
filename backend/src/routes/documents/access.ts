import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import {
  activeSubcontractorCompanyWhere,
  assertProjectAllowsWrite,
  checkProjectAccess,
  getSubcontractorPortalModuleAccessDeniedMessage,
  hasSubcontractorPortalModuleAccess,
  hasPortalModuleEnabled,
  isStandaloneSubcontractorPortalIdentity,
  requireSubcontractorPortalModuleAccess,
} from '../../lib/projectAccess.js';
import type { SubcontractorPortalAccessKey } from '../../lib/projectAccess.js';
import { canReadNcr } from '../ncrs/ncrAccess.js';
import {
  LOCKED_ITP_EVIDENCE_MESSAGE,
  isItpCompletionEvidenceLocked,
} from '../itp/helpers/evidenceLock.js';
import { assertEvidenceMetadataMutable } from './evidenceLinkGuards.js';

type AuthUser = NonNullable<Express.Request['user']>;

export type DocumentAccessRecord = {
  id?: string;
  projectId: string;
  lotId: string | null;
  uploadedById: string | null;
  documentType?: string | null;
  category?: string | null;
};

type SubcontractorDocumentCompany = {
  id: string;
  portalAccess: Prisma.JsonValue | null;
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

const DOCUMENT_SPECIAL_PORTAL_CATEGORIES = [
  'itp_evidence',
  'test_results',
  'ncr_evidence',
] as const;
const DOCUMENT_CATEGORY_PORTAL_MODULES: Record<
  (typeof DOCUMENT_SPECIAL_PORTAL_CATEGORIES)[number],
  SubcontractorPortalAccessKey
> = {
  itp_evidence: 'itps',
  test_results: 'testResults',
  ncr_evidence: 'ncrs',
};
const GENERIC_DOCUMENT_MUTATION_BLOCKED_MESSAGES: Record<string, string> = {
  test_certificate:
    'Test result certificates must be replaced or removed from the test result workflow.',
  drawing: 'Drawing files must be managed from the drawing register.',
};

function isDocumentSubcontractorUser(user: AuthUser): boolean {
  return isStandaloneSubcontractorPortalIdentity(user);
}

function isDrawingBackedDocument(documentType?: string | null): boolean {
  return documentType === 'drawing';
}

function isNcrEvidenceCategory(category?: string | null): boolean {
  return category === 'ncr_evidence';
}

function getDocumentPortalModule(category?: string | null): SubcontractorPortalAccessKey {
  if (category && Object.hasOwn(DOCUMENT_CATEGORY_PORTAL_MODULES, category)) {
    return DOCUMENT_CATEGORY_PORTAL_MODULES[
      category as (typeof DOCUMENT_SPECIAL_PORTAL_CATEGORIES)[number]
    ];
  }

  return 'documents';
}

export async function requireNoLockedItpEvidenceAttachment(
  document: DocumentAccessRecord,
): Promise<void> {
  if (!document.id) {
    return;
  }

  const lockedAttachment = await prisma.iTPCompletionAttachment.findFirst({
    where: {
      documentId: document.id,
      completion: {
        OR: [{ verificationStatus: 'verified' }, { status: 'not_applicable' }],
      },
    },
    select: {
      completion: {
        select: {
          status: true,
          verificationStatus: true,
        },
      },
    },
  });

  if (lockedAttachment && isItpCompletionEvidenceLocked(lockedAttachment.completion)) {
    throw AppError.conflict(LOCKED_ITP_EVIDENCE_MESSAGE, {
      status: lockedAttachment.completion.status,
      verificationStatus: lockedAttachment.completion.verificationStatus,
    });
  }
}

async function canReadNcrEvidenceDocument(
  user: AuthUser,
  document: DocumentAccessRecord,
): Promise<boolean> {
  if (document.uploadedById === user.id) {
    return true;
  }

  if (!document.id) {
    return false;
  }

  const evidenceLink = await prisma.nCREvidence.findFirst({
    where: { documentId: document.id },
    select: {
      ncr: {
        select: {
          projectId: true,
          responsibleUserId: true,
          responsibleSubcontractorId: true,
          ncrLots: { select: { lotId: true } },
        },
      },
    },
  });

  if (!evidenceLink) {
    return false;
  }

  return canReadNcr(evidenceLink.ncr, user);
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

async function getProjectSubcontractorCompanies(
  userId: string,
  projectId: string,
  requestedSubcontractorCompanyId?: string | null,
): Promise<SubcontractorDocumentCompany[]> {
  const subcontractorUsers = await prisma.subcontractorUser.findMany({
    where: {
      userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: {
      subcontractorCompany: {
        select: { id: true, portalAccess: true },
      },
    },
  });

  const companies = subcontractorUsers.map((link) => link.subcontractorCompany);
  return requestedSubcontractorCompanyId
    ? companies.filter((company) => company.id === requestedSubcontractorCompanyId)
    : companies;
}

async function getAssignedDocumentLotIds(
  projectId: string,
  subcontractorCompanyIds: string[],
): Promise<string[]> {
  if (subcontractorCompanyIds.length === 0) {
    return [];
  }

  const [assignments, legacyLots] = await Promise.all([
    prisma.lotSubcontractorAssignment.findMany({
      where: {
        projectId,
        subcontractorCompanyId: { in: subcontractorCompanyIds },
        status: 'active',
      },
      select: { lotId: true },
    }),
    prisma.lot.findMany({
      where: {
        projectId,
        assignedSubcontractorId: { in: subcontractorCompanyIds },
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

function getDocumentModuleCompanyIds(
  companies: SubcontractorDocumentCompany[],
  category?: string | null,
): string[] {
  const module = getDocumentPortalModule(category);
  return companies
    .filter((company) => hasPortalModuleEnabled(company.portalAccess, module))
    .map((company) => company.id);
}

function getGeneralDocumentCategoryScope(): Prisma.DocumentWhereInput {
  return {
    OR: [{ category: null }, { category: { notIn: [...DOCUMENT_SPECIAL_PORTAL_CATEGORIES] } }],
  };
}

function getLotDocumentAccessScope(
  assignedLotIds: string[],
  userId: string,
): Prisma.DocumentWhereInput {
  return {
    OR: [
      { lotId: null },
      { uploadedById: userId },
      ...(assignedLotIds.length > 0 ? [{ lotId: { in: assignedLotIds } }] : []),
    ],
  };
}

export async function applyDocumentReadScope(
  user: AuthUser,
  projectId: string,
  where: Prisma.DocumentWhereInput,
  requestedSubcontractorCompanyId?: string | null,
): Promise<void> {
  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  const subcontractorCompanies = await getProjectSubcontractorCompanies(
    user.id,
    projectId,
    requestedSubcontractorCompanyId,
  );
  if (subcontractorCompanies.length === 0) {
    where.id = '__no_subcontractor_document_access__';
    return;
  }

  const generalCompanyIds = getDocumentModuleCompanyIds(subcontractorCompanies, null);
  const itpCompanyIds = getDocumentModuleCompanyIds(subcontractorCompanies, 'itp_evidence');
  const testResultCompanyIds = getDocumentModuleCompanyIds(subcontractorCompanies, 'test_results');
  const [generalAssignedLotIds, itpAssignedLotIds, testResultAssignedLotIds] = await Promise.all([
    getAssignedDocumentLotIds(projectId, generalCompanyIds),
    getAssignedDocumentLotIds(projectId, itpCompanyIds),
    getAssignedDocumentLotIds(projectId, testResultCompanyIds),
  ]);

  const scopedAccess: Prisma.DocumentWhereInput[] = [];
  if (generalCompanyIds.length > 0) {
    scopedAccess.push({
      AND: [
        getGeneralDocumentCategoryScope(),
        getLotDocumentAccessScope(generalAssignedLotIds, user.id),
      ],
    });
  }
  if (itpCompanyIds.length > 0) {
    scopedAccess.push({
      AND: [{ category: 'itp_evidence' }, getLotDocumentAccessScope(itpAssignedLotIds, user.id)],
    });
  }
  if (testResultCompanyIds.length > 0) {
    scopedAccess.push({
      AND: [
        { category: 'test_results' },
        getLotDocumentAccessScope(testResultAssignedLotIds, user.id),
      ],
    });
  }

  if (scopedAccess.length === 0) {
    where.id = '__no_subcontractor_document_access__';
    return;
  }

  appendDocumentWhereClause(where, { OR: scopedAccess });
  appendDocumentWhereClause(where, { NOT: { documentType: 'drawing' } });
}

export async function applyDocumentPortalCategoryScope(
  user: AuthUser,
  projectId: string,
  where: Prisma.DocumentWhereInput,
  requestedSubcontractorCompanyId?: string | null,
): Promise<void> {
  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  const subcontractorCompanies = await getProjectSubcontractorCompanies(
    user.id,
    projectId,
    requestedSubcontractorCompanyId,
  );
  const canReadGeneralDocuments =
    getDocumentModuleCompanyIds(subcontractorCompanies, null).length > 0;
  const canReadItpEvidence =
    getDocumentModuleCompanyIds(subcontractorCompanies, 'itp_evidence').length > 0;
  const canReadTestResults =
    getDocumentModuleCompanyIds(subcontractorCompanies, 'test_results').length > 0;

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

  if (isNcrEvidenceCategory(document.category)) {
    return canReadNcrEvidenceDocument(user, document);
  }

  if (!document.lotId || document.uploadedById === user.id) {
    return true;
  }

  const subcontractorCompanies = await getProjectSubcontractorCompanies(
    user.id,
    document.projectId,
  );
  const moduleCompanyIds = getDocumentModuleCompanyIds(subcontractorCompanies, document.category);
  const assignedLotIds = await getAssignedDocumentLotIds(document.projectId, moduleCompanyIds);
  return assignedLotIds.includes(document.lotId);
}

async function hasAssignedDocumentLotAccess(
  user: AuthUser,
  projectId: string,
  lotId: string,
  category?: string | null,
): Promise<'allowed' | 'module-disabled' | 'not-assigned'> {
  const subcontractorCompanies = await getProjectSubcontractorCompanies(user.id, projectId);
  if (subcontractorCompanies.length === 0) {
    return 'not-assigned';
  }

  const allCompanyIds = subcontractorCompanies.map((company) => company.id);
  const moduleCompanyIds = getDocumentModuleCompanyIds(subcontractorCompanies, category);
  const [allAssignedLotIds, moduleAssignedLotIds] = await Promise.all([
    getAssignedDocumentLotIds(projectId, allCompanyIds),
    getAssignedDocumentLotIds(projectId, moduleCompanyIds),
  ]);

  if (!allAssignedLotIds.includes(lotId)) {
    return 'not-assigned';
  }

  return moduleAssignedLotIds.includes(lotId) ? 'allowed' : 'module-disabled';
}

function throwDocumentPortalModuleAccessDenied(category?: string | null): never {
  throw AppError.forbidden(
    getSubcontractorPortalModuleAccessDeniedMessage(getDocumentPortalModule(category)),
  );
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
  category?: string | null,
  message = 'Subcontractor document writes must be linked to an assigned lot',
): Promise<void> {
  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  if (isNcrEvidenceCategory(category)) {
    return;
  }

  if (!lotId) {
    throw AppError.forbidden(message);
  }

  const lotAccess = await hasAssignedDocumentLotAccess(user, projectId, lotId, category);
  if (lotAccess === 'not-assigned') {
    throw AppError.forbidden(message);
  }
  if (lotAccess === 'module-disabled') {
    throwDocumentPortalModuleAccessDenied(category);
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
  await requireSubcontractorAssignedLotWriteScope(user, projectId, lotId, category);
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
  await requireNoLockedItpEvidenceAttachment(document);
  if (document.id) {
    await assertEvidenceMetadataMutable(prisma, document.id);
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
    effectiveCategory,
    'Subcontractor documents must stay linked to an assigned lot',
  );
}
