import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildLotReadinessFromInputs } from '../../lib/evidenceReadiness.js';
import { checkConformancePrerequisitesBatch } from '../../lib/conformancePrerequisites.js';
import { isPendingTestResultStatus } from '../../lib/testResultStatus.js';
import { getCumulativeClaimedPercentByLot } from './cumulativeClaims.js';
import {
  buildClaimCertificationView,
  buildClaimDetailResponse,
  buildClaimReadinessResponse,
  buildClaimableLotsResponse,
  buildClaimsListResponse,
  getClaimReadDisputeNotes,
  mapClaimListItem,
  mapClaimReadinessItem,
  mapClaimableLot,
  parseClaimCertificationMetadata,
} from './presentation.js';

const CLAIM_LOT_QUERYABLE_STATUSES = [
  'not_started',
  'in_progress',
  'awaiting_test',
  'hold_point',
  'ncr_raised',
  'completed',
  'conformed',
  'claimed',
] as const;

type AuthUser = NonNullable<Express.Request['user']>;

interface ClaimReadRouterDependencies {
  requireAuth: RequestHandler;
  parseClaimRouteParam: (value: unknown, field: string) => string;
  requireCommercialProjectAccess: (user: AuthUser, projectId: string) => Promise<void>;
}

function getOptionalClaimQueryString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} query parameter must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${field} query parameter must not be empty`);
  }

  return trimmed;
}

function parseClaimLotStatusFilter(value: unknown): Prisma.StringFilter | string | undefined {
  const status = getOptionalClaimQueryString(value, 'status');
  if (status === undefined) {
    return undefined;
  }

  const statuses = status
    .split(',')
    .map((statusValue) => statusValue.trim())
    .filter(Boolean);
  if (statuses.length === 0) {
    throw AppError.badRequest('status query parameter must not be empty');
  }

  const invalidStatuses = statuses.filter(
    (statusValue) =>
      !CLAIM_LOT_QUERYABLE_STATUSES.includes(
        statusValue as (typeof CLAIM_LOT_QUERYABLE_STATUSES)[number],
      ),
  );
  if (invalidStatuses.length > 0) {
    throw AppError.badRequest(`status must be one of: ${CLAIM_LOT_QUERYABLE_STATUSES.join(', ')}`);
  }

  const uniqueStatuses = [...new Set(statuses)];
  return uniqueStatuses.length === 1 ? uniqueStatuses[0] : { in: uniqueStatuses };
}

function parseOptionalClaimBooleanQuery(value: unknown, field: string): boolean | undefined {
  const normalized = getOptionalClaimQueryString(value, field);
  if (normalized === undefined) {
    return undefined;
  }

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw AppError.badRequest(`${field} must be true or false`);
}

export function createClaimReadRouter({
  requireAuth,
  parseClaimRouteParam,
  requireCommercialProjectAccess,
}: ClaimReadRouterDependencies) {
  const readRouter = Router();

  readRouter.use(requireAuth);

  // GET /api/projects/:projectId/lots - Get conformed lots for claiming
  readRouter.get(
    '/:projectId/lots',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const status = parseClaimLotStatusFilter(req.query.status);
      const unclaimed = parseOptionalClaimBooleanQuery(req.query.unclaimed, 'unclaimed');
      await requireCommercialProjectAccess(req.user!, projectId);

      const whereClause: Prisma.LotWhereInput = { projectId };

      // Filter by status if provided
      if (status) {
        whereClause.status = status;
      }

      // Filter for unclaimed lots (no claimedInId)
      if (unclaimed === true) {
        whereClause.claimedInId = null;
      }

      const lots = await prisma.lot.findMany({
        where: whereClause,
        select: {
          id: true,
          lotNumber: true,
          description: true,
          status: true,
          activityType: true,
          budgetAmount: true,
        },
        orderBy: { lotNumber: 'asc' },
      });

      const transformedLots = lots.map((lot) => mapClaimableLot(lot));

      res.json(buildClaimableLotsResponse(transformedLots));
    }),
  );

  // GET /api/projects/:projectId/claim-readiness - Read-only lot readiness for claim creation
  readRouter.get(
    '/:projectId/claim-readiness',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      await requireCommercialProjectAccess(req.user!, projectId);

      const lots = await prisma.lot.findMany({
        where: {
          projectId,
          status: {
            in: [
              'not_started',
              'in_progress',
              'awaiting_test',
              'hold_point',
              'ncr_raised',
              'completed',
              'conformed',
              'claimed',
            ],
          },
        },
        select: {
          id: true,
          lotNumber: true,
          status: true,
          activityType: true,
          budgetAmount: true,
          claimedInId: true,
          conformanceOverriddenAt: true,
          holdPoints: {
            select: {
              id: true,
              status: true,
            },
          },
          testResults: {
            select: {
              id: true,
              status: true,
            },
          },
          documents: {
            select: {
              id: true,
              documentType: true,
            },
          },
        },
        orderBy: { lotNumber: 'asc' },
      });

      // Cumulative claiming: a conformed lot can appear on multiple claims, so
      // its readiness must reflect how much has already been claimed.
      const cumulativeClaimedByLotId = await getCumulativeClaimedPercentByLot(
        lots.map((lot) => lot.id),
      );

      // M39: resolve conformance for every lot in a constant number of queries
      // (one lot.findMany + at most one holdPoint.findMany) instead of the old
      // per-lot ~2N+1 fan-out.
      const conformStatusByLotId = await checkConformancePrerequisitesBatch(
        lots.map((lot) => lot.id),
      );

      const readinessLots = lots.map((lot) => {
        const conformStatus = conformStatusByLotId.get(lot.id);
        if (!conformStatus?.prerequisites) {
          throw AppError.notFound('Lot');
        }

        const readiness = buildLotReadinessFromInputs({
          lot: {
            id: lot.id,
            lotNumber: lot.lotNumber,
            status: lot.status,
            budgetAmount: lot.budgetAmount ? Number(lot.budgetAmount) : null,
            claimedInId: lot.claimedInId,
            claimedPercentage: cumulativeClaimedByLotId.get(lot.id) ?? 0,
            conformanceOverriddenAt: lot.conformanceOverriddenAt
              ? lot.conformanceOverriddenAt.toISOString()
              : null,
          },
          canViewCommercial: true,
          conformStatus: {
            canConform: Boolean(conformStatus.canConform),
            blockingReasons: conformStatus.blockingReasons ?? [],
            prerequisites: conformStatus.prerequisites,
          },
          evidenceCounts: {
            unreleasedHoldPoints: lot.holdPoints.filter(
              (holdPoint) => holdPoint.status !== 'released',
            ).length,
            releasedHoldPoints: lot.holdPoints.filter(
              (holdPoint) => holdPoint.status === 'released',
            ).length,
            approvedDockets: 0,
            diaryEntries: 0,
            documents: lot.documents.length,
            photos: lot.documents.filter((document) => document.documentType === 'photo').length,
            pendingTests: lot.testResults.filter((testResult) =>
              isPendingTestResultStatus(testResult.status),
            ).length,
          },
        });

        return mapClaimReadinessItem(lot, readiness);
      });

      res.json(buildClaimReadinessResponse(readinessLots));
    }),
  );

  // GET /api/projects/:projectId/claims - List all claims for a project
  readRouter.get(
    '/:projectId/claims',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      await requireCommercialProjectAccess(req.user!, projectId);

      // The project's state drives the per-jurisdiction SOPA certification and
      // payment-due timeframes the frontend renders. Select it cheaply alongside
      // the claims so every row reports the correct (e.g. WA) due dates instead
      // of silently defaulting to NSW.
      const [project, claims] = await Promise.all([
        prisma.project.findUnique({
          where: { id: projectId },
          select: { state: true },
        }),
        prisma.progressClaim.findMany({
          where: { projectId },
          orderBy: { claimNumber: 'desc' },
          include: {
            _count: {
              select: { claimedLots: true, variations: true },
            },
          },
        }),
      ]);

      // The certifier id lives inside the certification JSON stored in each
      // claim's disputeNotes column. Resolve those ids to display names in one
      // batched query so the read-back can surface who recorded the external
      // certificate (mirrors the PM-name lookup in the certify workflow).
      const certifierIds = [
        ...new Set(
          claims
            .map((claim) => parseClaimCertificationMetadata(claim.disputeNotes)?.certifiedById)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const certifierNameById = new Map<string, string | null>();
      if (certifierIds.length > 0) {
        const certifiers = await prisma.user.findMany({
          where: { id: { in: certifierIds } },
          select: { id: true, fullName: true, email: true },
        });
        for (const certifier of certifiers) {
          certifierNameById.set(certifier.id, certifier.fullName || certifier.email || null);
        }
      }

      const transformedClaims = claims.map((claim) =>
        mapClaimListItem(claim, project?.state ?? null, certifierNameById),
      );

      res.json(buildClaimsListResponse(transformedClaims));
    }),
  );

  // GET /api/projects/:projectId/claims/:claimId - Get a single claim
  readRouter.get(
    '/:projectId/claims/:claimId',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const claimId = parseClaimRouteParam(req.params.claimId, 'claimId');
      await requireCommercialProjectAccess(req.user!, projectId);

      const claim = await prisma.progressClaim.findFirst({
        where: { id: claimId, projectId },
        include: {
          claimedLots: {
            include: {
              lot: true,
            },
          },
          preparedBy: {
            select: { id: true, fullName: true, email: true },
          },
          variations: {
            select: {
              id: true,
              variationNumber: true,
              title: true,
              clientReference: true,
              approvedAmount: true,
            },
            orderBy: { variationNumber: 'asc' },
          },
        },
      });

      if (!claim) {
        throw AppError.notFound('Claim');
      }

      // Surface the parsed external-certificate metadata (who recorded it, the
      // notes, and the attached certificate document) without altering the raw
      // disputeNotes field other consumers and the PUT path still rely on.
      const certifierId = parseClaimCertificationMetadata(claim.disputeNotes)?.certifiedById;
      const certifierNameById = new Map<string, string | null>();
      if (certifierId) {
        const certifier = await prisma.user.findUnique({
          where: { id: certifierId },
          select: { id: true, fullName: true, email: true },
        });
        if (certifier) {
          certifierNameById.set(certifier.id, certifier.fullName || certifier.email || null);
        }
      }
      const certification = buildClaimCertificationView(claim.disputeNotes, certifierNameById);

      res.json(
        buildClaimDetailResponse({
          ...claim,
          variations: claim.variations.map((variation) => ({
            id: variation.id,
            variationNumber: variation.variationNumber,
            title: variation.title,
            clientReference: variation.clientReference,
            approvedAmount:
              variation.approvedAmount == null ? null : Number(variation.approvedAmount),
          })),
          disputeNotes: getClaimReadDisputeNotes(claim.disputeNotes),
          certification,
        }),
      );
    }),
  );

  return readRouter;
}
