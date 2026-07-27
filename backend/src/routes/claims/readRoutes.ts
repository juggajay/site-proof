import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError, ErrorCodes } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildLotReadinessFromInputs } from '../../lib/evidenceReadiness.js';
import { checkConformancePrerequisitesBatch } from '../../lib/conformancePrerequisites.js';
import { holdPointReleased, testPendingByStatus } from '../../lib/readiness/predicates.js';
import { prismaRegimeStreamFetcher } from '../../lib/readiness/sufficiency/prismaStream.js';
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

// The lot fields the claim-readiness computation reads. Shared by the legacy
// full-list query and the paginated query so both fetch an identical shape.
const CLAIM_READINESS_LOT_SELECT = {
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
      // passFail is unused by the pendingTests count itself (testPendingByStatus
      // reads only status) but keeps the row a full TestResultRow for the shared
      // predicate; it is not rendered, so the response is unchanged.
      passFail: true,
    },
  },
  documents: {
    select: {
      id: true,
      documentType: true,
    },
  },
} satisfies Prisma.LotSelect;

type ClaimReadinessLotRow = Prisma.LotGetPayload<{ select: typeof CLAIM_READINESS_LOT_SELECT }>;

// Claim-readiness pagination (execution spec Rev 2 §4). The cursor is an opaque
// base64 of the register's natural key `(lotNumber, id)` under the stable order
// `lotNumber ASC, id ASC`; `take` is capped at 500 server-side.
const CLAIM_READINESS_MAX_PAGE_SIZE = 500;

interface ClaimReadinessCursor {
  lotNumber: string;
  id: string;
}

interface ClaimReadinessPagination {
  limit: number;
  cursor: ClaimReadinessCursor | null;
}

function encodeClaimReadinessCursor(row: ClaimReadinessCursor): string {
  return Buffer.from(JSON.stringify({ lotNumber: row.lotNumber, id: row.id }), 'utf8').toString(
    'base64',
  );
}

function decodeClaimReadinessCursor(value: string): ClaimReadinessCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
  } catch {
    throw new AppError(400, 'Invalid pagination cursor', ErrorCodes.INVALID_CURSOR);
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as ClaimReadinessCursor).lotNumber !== 'string' ||
    typeof (parsed as ClaimReadinessCursor).id !== 'string'
  ) {
    throw new AppError(400, 'Invalid pagination cursor', ErrorCodes.INVALID_CURSOR);
  }
  const { lotNumber, id } = parsed as ClaimReadinessCursor;
  return { lotNumber, id };
}

// Returns null when the request opts out of pagination (no cursor/limit params),
// preserving the historical full-list response for existing callers.
function parseClaimReadinessPagination(query: {
  cursor?: unknown;
  limit?: unknown;
}): ClaimReadinessPagination | null {
  const cursorParam = getOptionalClaimQueryString(query.cursor, 'cursor');
  const limitParam = getOptionalClaimQueryString(query.limit, 'limit');
  if (cursorParam === undefined && limitParam === undefined) {
    return null;
  }

  let limit = CLAIM_READINESS_MAX_PAGE_SIZE;
  if (limitParam !== undefined) {
    const parsedLimit = Number(limitParam);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      throw AppError.badRequest('limit must be a positive integer');
    }
    limit = Math.min(parsedLimit, CLAIM_READINESS_MAX_PAGE_SIZE);
  }

  return {
    limit,
    cursor: cursorParam === undefined ? null : decodeClaimReadinessCursor(cursorParam),
  };
}

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

// Build the claim-readiness view-models for a set of lot rows. Shared by the
// legacy full-list path and the paginated path so both produce identical items;
// only the response envelope differs. Byte-identical to the prior inline block.
async function computeClaimReadinessItems(lots: ClaimReadinessLotRow[]) {
  // Cumulative claiming: a conformed lot can appear on multiple claims, so its
  // readiness must reflect how much has already been claimed.
  const cumulativeClaimedByLotId = await getCumulativeClaimedPercentByLot(
    lots.map((lot) => lot.id),
  );

  // M39: resolve conformance for every lot in a constant number of queries
  // (one lot.findMany + at most one holdPoint.findMany) instead of the old
  // per-lot ~2N+1 fan-out.
  // Wave C1.2 (§11 C1.2, §12): this path runs OUTSIDE any transaction, so it is
  // the one that may supply the regime fetcher. The batch groups (lot, rule)
  // pairs by stream and issues at most ONE read per stream — never one per
  // member, which a per-lot loop would have made N reads on this page.
  const conformStatusByLotId = await checkConformancePrerequisitesBatch(
    lots.map((lot) => lot.id),
    prisma,
    { regimeFetcher: prismaRegimeStreamFetcher() },
  );

  return lots.map((lot) => {
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
      // Wave C1 (§5.3): sufficiency joins the claim-readiness view as an
      // ADVISORY. It never blocks a claim, and it never enters
      // `getClaimBlockingReasonsForConformedLot` — enforced by §14 AT-11.
      sufficiency: conformStatus.sufficiency ?? null,
      evidenceCounts: {
        unreleasedHoldPoints: lot.holdPoints.filter((holdPoint) => !holdPointReleased(holdPoint))
          .length,
        releasedHoldPoints: lot.holdPoints.filter(holdPointReleased).length,
        approvedDockets: 0,
        diaryEntries: 0,
        documents: lot.documents.length,
        photos: lot.documents.filter((document) => document.documentType === 'photo').length,
        pendingTests: lot.testResults.filter(testPendingByStatus).length,
      },
    });

    return mapClaimReadinessItem(lot, readiness);
  });
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

      const pagination = parseClaimReadinessPagination(req.query);
      const baseWhere: Prisma.LotWhereInput = {
        projectId,
        status: { in: [...CLAIM_LOT_QUERYABLE_STATUSES] },
      };

      // Legacy full-list behaviour (no cursor/limit params): unchanged for
      // existing callers. Its removal is an F0.2a exit item.
      if (!pagination) {
        const lots = await prisma.lot.findMany({
          where: baseWhere,
          select: CLAIM_READINESS_LOT_SELECT,
          orderBy: { lotNumber: 'asc' },
        });
        res.json(buildClaimReadinessResponse(await computeClaimReadinessItems(lots)));
        return;
      }

      // A deleted cursor (its anchor lot no longer exists in this project) is a
      // hard restart signal, not a silent skip — surface INVALID_CURSOR so the
      // client restarts from page one.
      if (pagination.cursor) {
        const anchor = await prisma.lot.findFirst({
          where: { id: pagination.cursor.id, projectId },
          select: { id: true },
        });
        if (!anchor) {
          throw new AppError(400, 'Invalid pagination cursor', ErrorCodes.INVALID_CURSOR);
        }
      }

      // Keyset pagination on the register's natural key (lotNumber ASC, id ASC).
      const where: Prisma.LotWhereInput = pagination.cursor
        ? {
            ...baseWhere,
            OR: [
              { lotNumber: { gt: pagination.cursor.lotNumber } },
              { lotNumber: pagination.cursor.lotNumber, id: { gt: pagination.cursor.id } },
            ],
          }
        : baseWhere;

      // Over-fetch by one to detect whether a further page exists.
      const pageLots = await prisma.lot.findMany({
        where,
        select: CLAIM_READINESS_LOT_SELECT,
        orderBy: [{ lotNumber: 'asc' }, { id: 'asc' }],
        take: pagination.limit + 1,
      });

      const hasMore = pageLots.length > pagination.limit;
      const lots = hasMore ? pageLots.slice(0, pagination.limit) : pageLots;
      const nextCursor =
        hasMore && lots.length > 0 ? encodeClaimReadinessCursor(lots[lots.length - 1]) : null;

      const items = await computeClaimReadinessItems(lots);

      const body: { items: typeof items; nextCursor: string | null; total?: number } = {
        items,
        nextCursor,
      };
      // `total` is a first-page-only convenience (no cursor supplied).
      if (!pagination.cursor) {
        body.total = await prisma.lot.count({ where: baseWhere });
      }

      res.json(body);
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
