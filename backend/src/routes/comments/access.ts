import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import {
  activeSubcontractorCompanyWhere,
  checkProjectAccess,
  getSubcontractorPortalModuleAccessDeniedMessage,
  hasPortalModuleEnabled,
  isStandaloneSubcontractorPortalIdentity,
  type SubcontractorPortalAccessKey,
} from '../../lib/projectAccess.js';

const COMMENT_ENTITY_TYPE_ALIASES: Record<string, string> = {
  lot: 'Lot',
  ncr: 'NCR',
  document: 'Document',
  drawing: 'Drawing',
  docket: 'Docket',
  daily_docket: 'Docket',
  dailydocket: 'Docket',
  diary: 'Diary',
  daily_diary: 'Diary',
  dailydiary: 'Diary',
  test: 'TestResult',
  test_result: 'TestResult',
  testresult: 'TestResult',
  holdpoint: 'HoldPoint',
  hold_point: 'HoldPoint',
  itp: 'ITP',
  itp_instance: 'ITP',
  itpinstance: 'ITP',
  itp_completion: 'ITPCompletion',
  itpcompletion: 'ITPCompletion',
  progress_claim: 'ProgressClaim',
  progressclaim: 'ProgressClaim',
};

type AuthUser = NonNullable<Express.Request['user']>;

interface CommentEntityAccessTarget {
  projectId: string;
  lotId?: string | null;
  subcontractorLotScoped: boolean;
  subcontractorPortalModule?: SubcontractorPortalAccessKey | null;
}

function isSubcontractorUser(user: AuthUser): boolean {
  return isStandaloneSubcontractorPortalIdentity(user);
}

function normalizeCommentEntityType(entityType: string): string {
  return entityType.toLowerCase().replace(/[\s-]/g, '_');
}

export function getCanonicalCommentEntityType(entityType: string): string {
  const canonicalType = COMMENT_ENTITY_TYPE_ALIASES[normalizeCommentEntityType(entityType)];
  if (!canonicalType) {
    throw AppError.badRequest('Unsupported comment entityType');
  }

  return canonicalType;
}

export function getCommentEntityTypeQueryValues(entityType: string): string[] {
  const canonicalType = getCanonicalCommentEntityType(entityType);
  const variants = new Set<string>([entityType, canonicalType]);

  Object.entries(COMMENT_ENTITY_TYPE_ALIASES)
    .filter(([, mappedType]) => mappedType === canonicalType)
    .forEach(([alias]) => variants.add(alias));

  return Array.from(variants);
}

async function hasAssignedSubcontractorLotAccess(
  userId: string,
  projectId: string,
  lotId: string,
  module: SubcontractorPortalAccessKey,
): Promise<'allowed' | 'module-disabled' | 'not-assigned'> {
  const subcontractorUsers = await prisma.subcontractorUser.findMany({
    where: {
      userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: {
      subcontractorCompanyId: true,
      subcontractorCompany: {
        select: { portalAccess: true },
      },
    },
  });

  if (subcontractorUsers.length === 0) {
    return 'not-assigned';
  }

  const subcontractorCompanyIds = subcontractorUsers.map((link) => link.subcontractorCompanyId);
  const [assignment, legacyLot] = await Promise.all([
    prisma.lotSubcontractorAssignment.findMany({
      where: {
        projectId,
        lotId,
        subcontractorCompanyId: { in: subcontractorCompanyIds },
        status: 'active',
      },
      select: { subcontractorCompanyId: true },
    }),
    prisma.lot.findFirst({
      where: {
        id: lotId,
        projectId,
        assignedSubcontractorId: { in: subcontractorCompanyIds },
      },
      select: { assignedSubcontractorId: true },
    }),
  ]);

  const assignedCompanyIds = new Set([
    ...assignment.map((record) => record.subcontractorCompanyId),
    ...(legacyLot?.assignedSubcontractorId ? [legacyLot.assignedSubcontractorId] : []),
  ]);

  if (assignedCompanyIds.size === 0) {
    return 'not-assigned';
  }

  const assignedCompanyHasModule = subcontractorUsers.some(
    (link) =>
      assignedCompanyIds.has(link.subcontractorCompanyId) &&
      hasPortalModuleEnabled(link.subcontractorCompany.portalAccess, module),
  );

  return assignedCompanyHasModule ? 'allowed' : 'module-disabled';
}

async function getCommentEntityAccessTarget(
  entityType: string,
  entityId: string,
): Promise<CommentEntityAccessTarget> {
  const normalizedType = normalizeCommentEntityType(entityType);

  if (normalizedType === 'lot') {
    const entity = await prisma.lot.findUnique({
      where: { id: entityId },
      select: { projectId: true },
    });
    if (!entity) throw AppError.notFound('Comment entity');
    return {
      projectId: entity.projectId,
      lotId: entityId,
      subcontractorLotScoped: true,
      subcontractorPortalModule: 'lots',
    };
  }

  if (normalizedType === 'ncr') {
    const entity = await prisma.nCR.findUnique({
      where: { id: entityId },
      select: { projectId: true },
    });
    if (!entity) throw AppError.notFound('Comment entity');
    return { projectId: entity.projectId, subcontractorLotScoped: false };
  }

  if (normalizedType === 'document') {
    const entity = await prisma.document.findUnique({
      where: { id: entityId },
      select: { projectId: true },
    });
    if (!entity) throw AppError.notFound('Comment entity');
    return { projectId: entity.projectId, subcontractorLotScoped: false };
  }

  if (normalizedType === 'drawing') {
    const entity = await prisma.drawing.findUnique({
      where: { id: entityId },
      select: { projectId: true },
    });
    if (!entity) throw AppError.notFound('Comment entity');
    return { projectId: entity.projectId, subcontractorLotScoped: false };
  }

  if (['docket', 'daily_docket', 'dailydocket'].includes(normalizedType)) {
    const entity = await prisma.dailyDocket.findUnique({
      where: { id: entityId },
      select: { projectId: true },
    });
    if (!entity) throw AppError.notFound('Comment entity');
    return { projectId: entity.projectId, subcontractorLotScoped: false };
  }

  if (['diary', 'daily_diary', 'dailydiary'].includes(normalizedType)) {
    const entity = await prisma.dailyDiary.findUnique({
      where: { id: entityId },
      select: { projectId: true },
    });
    if (!entity) throw AppError.notFound('Comment entity');
    return { projectId: entity.projectId, subcontractorLotScoped: false };
  }

  if (['test', 'test_result', 'testresult'].includes(normalizedType)) {
    const entity = await prisma.testResult.findUnique({
      where: { id: entityId },
      select: { projectId: true },
    });
    if (!entity) throw AppError.notFound('Comment entity');
    return { projectId: entity.projectId, subcontractorLotScoped: false };
  }

  if (['holdpoint', 'hold_point'].includes(normalizedType)) {
    const entity = await prisma.holdPoint.findUnique({
      where: { id: entityId },
      select: { lotId: true, lot: { select: { projectId: true } } },
    });
    if (!entity) throw AppError.notFound('Comment entity');
    return { projectId: entity.lot.projectId, lotId: entity.lotId, subcontractorLotScoped: false };
  }

  if (['itp', 'itp_instance', 'itpinstance'].includes(normalizedType)) {
    const entity = await prisma.iTPInstance.findUnique({
      where: { id: entityId },
      select: { lotId: true, lot: { select: { projectId: true } } },
    });
    if (entity)
      return {
        projectId: entity.lot.projectId,
        lotId: entity.lotId,
        subcontractorLotScoped: false,
      };

    const lot = await prisma.lot.findUnique({
      where: { id: entityId },
      select: { projectId: true },
    });
    if (!lot) throw AppError.notFound('Comment entity');
    return {
      projectId: lot.projectId,
      lotId: entityId,
      subcontractorLotScoped: true,
      subcontractorPortalModule: 'itps',
    };
  }

  if (['itp_completion', 'itpcompletion'].includes(normalizedType)) {
    const entity = await prisma.iTPCompletion.findUnique({
      where: { id: entityId },
      select: { itpInstance: { select: { lotId: true, lot: { select: { projectId: true } } } } },
    });
    if (!entity) throw AppError.notFound('Comment entity');
    return {
      projectId: entity.itpInstance.lot.projectId,
      lotId: entity.itpInstance.lotId,
      subcontractorLotScoped: false,
    };
  }

  if (['progress_claim', 'progressclaim'].includes(normalizedType)) {
    const entity = await prisma.progressClaim.findUnique({
      where: { id: entityId },
      select: { projectId: true },
    });
    if (!entity) throw AppError.notFound('Comment entity');
    return { projectId: entity.projectId, subcontractorLotScoped: false };
  }

  throw AppError.badRequest('Unsupported comment entityType');
}

export async function requireCommentEntityAccess(
  user: AuthUser,
  entityType: string,
  entityId: string,
): Promise<string> {
  const target = await getCommentEntityAccessTarget(entityType, entityId);

  if (isSubcontractorUser(user)) {
    if (!target.subcontractorLotScoped || !target.lotId || !target.subcontractorPortalModule) {
      throw AppError.forbidden('Access denied');
    }

    const lotAccess = await hasAssignedSubcontractorLotAccess(
      user.id,
      target.projectId,
      target.lotId,
      target.subcontractorPortalModule,
    );
    if (lotAccess === 'not-assigned') {
      throw AppError.forbidden('Access denied');
    }

    if (lotAccess === 'module-disabled') {
      throw AppError.forbidden(
        getSubcontractorPortalModuleAccessDeniedMessage(target.subcontractorPortalModule),
      );
    }

    return target.projectId;
  }

  const hasAccess = await checkProjectAccess(user.id, target.projectId);
  if (!hasAccess) {
    throw AppError.forbidden('Access denied');
  }

  return target.projectId;
}
