import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { escapeCsvFormulaValue } from '../../lib/csvSafe.js';
import { roundClaimAmountToCents } from '../claims/workflowValidation.js';

const CLAIM_REPORT_STATUSES = [
  'draft',
  'submitted',
  'certified',
  'disputed',
  'paid',
  'partially_paid',
] as const;

type ParsedDateQuery = {
  raw: string;
  date: Date;
};

type AuthUser = NonNullable<Express.Request['user']>;

type ClaimReportRouterDependencies = {
  parseRequiredString: (value: unknown, fieldName: string, maxLength?: number) => string;
  parseOptionalDateQuery: (
    value: unknown,
    fieldName: string,
    endOfDay?: boolean,
    timeZone?: string,
  ) => ParsedDateQuery | undefined;
  parseOptionalCommaSeparatedQuery: (value: unknown, fieldName: string) => string[];
  validateDateRange: (
    startDate: ParsedDateQuery | undefined,
    endDate: ParsedDateQuery | undefined,
  ) => void;
  requireClaimsReportAccess: (user: AuthUser | undefined, projectId: string) => Promise<void>;
  resolveReportProjectTimeZone: (projectId: string) => Promise<string>;
};

function escapeOptionalCsvExportValue(value: string | null | undefined): string | null | undefined {
  return value === null || value === undefined ? value : escapeCsvFormulaValue(value);
}

function parseClaimReportStatuses(
  value: unknown,
  parseOptionalCommaSeparatedQuery: ClaimReportRouterDependencies['parseOptionalCommaSeparatedQuery'],
): string[] {
  const statuses = parseOptionalCommaSeparatedQuery(value, 'status');
  if (statuses.length === 0) {
    return [];
  }

  const invalidStatuses = statuses.filter(
    (status) => !CLAIM_REPORT_STATUSES.includes(status as (typeof CLAIM_REPORT_STATUSES)[number]),
  );
  if (invalidStatuses.length > 0) {
    throw AppError.badRequest(`status must be one of: ${CLAIM_REPORT_STATUSES.join(', ')}`);
  }

  return [...new Set(statuses)];
}

type ClaimReportAmountInput = {
  totalClaimedAmount: unknown;
  certifiedAmount: unknown;
  paidAmount: unknown;
};

type ClaimReportAmounts = {
  totalClaimedAmount: number;
  certifiedAmount: number | null;
  paidAmount: number | null;
  variance: number | null;
  outstanding: number | null;
};

type ClaimReportFinancialSummaryInput = {
  status: string | null;
  totalClaimedAmount: unknown;
  certifiedAmount: unknown;
  paidAmount: unknown;
  lotCount: number;
};

type ClaimReportFinancialSummary = {
  totalClaimed: number;
  totalCertified: number;
  totalPaid: number;
  outstanding: number;
  certificationRate: string;
  collectionRate: string;
  totalLots: number;
};

function hasReportAmount(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function reportAmountOrZero(value: unknown): number {
  return hasReportAmount(value) ? roundClaimAmountToCents(Number(value)) : 0;
}

function reportAmountOrNull(value: unknown): number | null {
  return hasReportAmount(value) ? roundClaimAmountToCents(Number(value)) : null;
}

export function buildClaimReportAmounts({
  totalClaimedAmount,
  certifiedAmount,
  paidAmount,
}: ClaimReportAmountInput): ClaimReportAmounts {
  const reportedTotalClaimedAmount = reportAmountOrZero(totalClaimedAmount);
  const reportedCertifiedAmount = reportAmountOrNull(certifiedAmount);
  const reportedPaidAmount = reportAmountOrNull(paidAmount);

  return {
    totalClaimedAmount: reportedTotalClaimedAmount,
    certifiedAmount: reportedCertifiedAmount,
    paidAmount: reportedPaidAmount,
    variance:
      hasReportAmount(totalClaimedAmount) && hasReportAmount(certifiedAmount)
        ? roundClaimAmountToCents(Number(totalClaimedAmount) - Number(certifiedAmount))
        : null,
    outstanding:
      reportedCertifiedAmount === null
        ? null
        : roundClaimAmountToCents(reportedCertifiedAmount - (reportedPaidAmount ?? 0)),
  };
}

export function buildClaimReportFinancialSummary(
  claims: ClaimReportFinancialSummaryInput[],
): ClaimReportFinancialSummary {
  let totalClaimed = 0;
  let totalCertified = 0;
  let totalPaid = 0;
  let totalNonDisputedPaid = 0;
  let totalLots = 0;

  for (const claim of claims) {
    totalClaimed = roundClaimAmountToCents(
      totalClaimed + reportAmountOrZero(claim.totalClaimedAmount),
    );
    totalPaid = roundClaimAmountToCents(totalPaid + reportAmountOrZero(claim.paidAmount));
    totalLots += claim.lotCount;

    if (claim.status !== 'disputed') {
      totalCertified = roundClaimAmountToCents(
        totalCertified + reportAmountOrZero(claim.certifiedAmount),
      );
      totalNonDisputedPaid = roundClaimAmountToCents(
        totalNonDisputedPaid + reportAmountOrZero(claim.paidAmount),
      );
    }
  }

  const outstanding = Math.max(0, roundClaimAmountToCents(totalCertified - totalNonDisputedPaid));

  return {
    totalClaimed,
    totalCertified,
    totalPaid,
    outstanding,
    certificationRate:
      totalClaimed > 0 ? ((totalCertified / totalClaimed) * 100).toFixed(1) : '0.0',
    collectionRate:
      totalCertified > 0 ? ((totalNonDisputedPaid / totalCertified) * 100).toFixed(1) : '0.0',
    totalLots,
  };
}

export function createClaimReportRouter({
  parseRequiredString,
  parseOptionalDateQuery,
  parseOptionalCommaSeparatedQuery,
  validateDateRange,
  requireClaimsReportAccess,
  resolveReportProjectTimeZone,
}: ClaimReportRouterDependencies): Router {
  const router = Router();

  router.use(requireAuth);

  // Feature #287: GET /api/reports/claims - Claim history report
  router.get(
    '/claims',
    asyncHandler(async (req, res) => {
      const { startDate, endDate, status } = req.query;
      const projectId = parseRequiredString(req.query.projectId, 'projectId');

      await requireClaimsReportAccess(req.user, projectId);
      const projectTimeZone = await resolveReportProjectTimeZone(projectId);

      // Build where clause with optional filters
      const whereClause: Prisma.ProgressClaimWhereInput = { projectId };

      // Filter by date range (using claimPeriodEnd)
      const parsedStartDate = parseOptionalDateQuery(
        startDate,
        'startDate',
        false,
        projectTimeZone,
      );
      const parsedEndDate = parseOptionalDateQuery(endDate, 'endDate', true, projectTimeZone);
      validateDateRange(parsedStartDate, parsedEndDate);
      if (parsedStartDate || parsedEndDate) {
        const claimPeriodEnd: Prisma.DateTimeFilter = {};
        if (parsedStartDate) {
          claimPeriodEnd.gte = parsedStartDate.date;
        }
        if (parsedEndDate) {
          claimPeriodEnd.lte = parsedEndDate.date;
        }
        whereClause.claimPeriodEnd = claimPeriodEnd;
      }

      // Filter by status
      const statuses = parseClaimReportStatuses(status, parseOptionalCommaSeparatedQuery);
      if (statuses.length > 0) {
        whereClause.status = { in: statuses };
      }

      // Get all claims for the project
      const claims = await prisma.progressClaim.findMany({
        where: whereClause,
        include: {
          claimedLots: {
            include: {
              lot: {
                select: { id: true, lotNumber: true, description: true, activityType: true },
              },
            },
          },
          preparedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { claimNumber: 'desc' },
      });

      // Calculate status counts
      const statusCounts = claims.reduce((acc: Record<string, number>, claim) => {
        const claimStatus = claim.status || 'draft';
        acc[claimStatus] = (acc[claimStatus] || 0) + 1;
        return acc;
      }, {});

      const financialSummary = buildClaimReportFinancialSummary(
        claims.map((claim) => ({
          status: claim.status,
          totalClaimedAmount: claim.totalClaimedAmount,
          certifiedAmount: claim.certifiedAmount,
          paidAmount: claim.paidAmount,
          lotCount: claim.claimedLots.length,
        })),
      );

      // Calculate monthly breakdown
      const monthlyData: Record<
        string,
        { claimed: number; certified: number; paid: number; count: number }
      > = {};
      for (const claim of claims) {
        const monthKey = claim.claimPeriodEnd.toISOString().slice(0, 7); // YYYY-MM
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { claimed: 0, certified: 0, paid: 0, count: 0 };
        }
        monthlyData[monthKey].claimed = roundClaimAmountToCents(
          monthlyData[monthKey].claimed + reportAmountOrZero(claim.totalClaimedAmount),
        );
        monthlyData[monthKey].certified = roundClaimAmountToCents(
          monthlyData[monthKey].certified + reportAmountOrZero(claim.certifiedAmount),
        );
        monthlyData[monthKey].paid = roundClaimAmountToCents(
          monthlyData[monthKey].paid + reportAmountOrZero(claim.paidAmount),
        );
        monthlyData[monthKey].count++;
      }

      // Convert monthly data to sorted array
      const monthlyBreakdown = Object.entries(monthlyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => ({
          month,
          ...data,
          variance: roundClaimAmountToCents(data.claimed - data.certified),
        }));

      // Transform claims for export
      const claimsData = claims.map((claim) => {
        const amounts = buildClaimReportAmounts(claim);

        return {
          id: claim.id,
          claimNumber: claim.claimNumber,
          periodStart: claim.claimPeriodStart.toISOString().split('T')[0],
          periodEnd: claim.claimPeriodEnd.toISOString().split('T')[0],
          status: claim.status,
          ...amounts,
          submittedAt: claim.submittedAt?.toISOString().split('T')[0] || null,
          certifiedAt: claim.certifiedAt?.toISOString().split('T')[0] || null,
          paidAt: claim.paidAt?.toISOString().split('T')[0] || null,
          paymentReference: claim.paymentReference || null,
          lotCount: claim.claimedLots.length,
          lots: claim.claimedLots.map((cl) => ({
            lotNumber: cl.lot.lotNumber,
            description: cl.lot.description,
            activityType: cl.lot.activityType,
            amountClaimed: reportAmountOrZero(cl.amountClaimed),
          })),
          preparedBy: claim.preparedBy
            ? {
                name: claim.preparedBy.fullName || claim.preparedBy.email,
                email: claim.preparedBy.email,
              }
            : null,
          preparedAt: claim.preparedAt?.toISOString().split('T')[0] || null,
        };
      });

      const report = {
        generatedAt: new Date().toISOString(),
        projectId,
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
        totalClaims: claims.length,
        statusCounts,
        financialSummary: {
          totalClaimed: financialSummary.totalClaimed,
          totalCertified: financialSummary.totalCertified,
          totalPaid: financialSummary.totalPaid,
          outstanding: financialSummary.outstanding,
          certificationRate: financialSummary.certificationRate,
          collectionRate: financialSummary.collectionRate,
          totalLots: financialSummary.totalLots,
        },
        monthlyBreakdown,
        claims: claimsData,
        // Excel-friendly flat format for export
        exportData: claimsData.map((claim) => ({
          'Claim #': claim.claimNumber,
          'Period Start': claim.periodStart,
          'Period End': claim.periodEnd,
          Status: claim.status,
          'Claimed Amount': claim.totalClaimedAmount,
          'Certified Amount': claim.certifiedAmount,
          'Paid Amount': claim.paidAmount,
          Variance: claim.variance,
          Outstanding: claim.outstanding,
          'Submitted Date': claim.submittedAt,
          'Certified Date': claim.certifiedAt,
          'Paid Date': claim.paidAt,
          'Payment Reference': escapeOptionalCsvExportValue(claim.paymentReference),
          'Lot Count': claim.lotCount,
          'Prepared By': escapeOptionalCsvExportValue(claim.preparedBy?.name),
        })),
      };

      res.json(report);
    }),
  );

  return router;
}
