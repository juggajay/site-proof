import { Router } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { getCumulativeClaimedPercentByLot } from './cumulativeClaims.js';
import { roundClaimAmountToCents } from './workflowValidation.js';

/**
 * Xero customer-invoice CSV import header.
 *
 * These are the columns Xero requires for a sales-invoice import (its own
 * template marks them with a leading `*`). Rows that share the same
 * *InvoiceNumber are grouped into a single invoice with one line each; every
 * imported invoice lands as DRAFT for human review before it is sent.
 *
 * Verified against https://central.xero.com/s/article/Import-customer-invoices
 * (2026-07-02). A minimal column set imports fine as long as the header names
 * match exactly. Before a real head contractor relies on this, confirm the
 * header row + the tax-rate display name against a template downloaded from
 * their own Xero org (Sales > Invoices > Import > Download template file).
 */
export const XERO_INVOICE_CSV_HEADER = [
  '*ContactName',
  '*InvoiceNumber',
  '*InvoiceDate',
  '*DueDate',
  '*Description',
  '*Quantity',
  '*UnitAmount',
  '*AccountCode',
  '*TaxType',
] as const;

export interface XeroLotExportInput {
  lotNumber: string;
  activityType: string;
  /** Ex-GST amount for this claim's increment on the lot. */
  amountClaimed: number;
  /** This claim's percentage increment for the lot. */
  thisClaimPercent: number;
  /** Cumulative percentage claimed for the lot, including this claim. */
  cumulativePercent: number;
}

export interface XeroClaimExportInput {
  claimNumber: number;
  projectName: string;
  clientName: string | null;
  /** ISO date string; used as the invoice date unless config overrides it. */
  periodEnd: string;
  /** Ex-GST claim total; must equal the sum of the line amounts. */
  totalClaimedAmount: number;
  lots: XeroLotExportInput[];
}

export interface XeroExportConfig {
  /** Xero income account code (e.g. "200"). Must exist in the org's chart. */
  accountCode: string;
  /** Tax-rate display name (e.g. "GST on Income"); blank => Xero account default. */
  taxType?: string;
  /** ISO date override for the invoice date; defaults to the claim period end. */
  invoiceDate?: string;
}

type CsvCell = string | number;

function formatPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/** Xero expects DD/MM/YYYY. Format from the UTC parts so it is timezone-stable. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/**
 * Map a compiled progress claim to Xero sales-invoice CSV rows: one line per
 * claimed lot, ex-GST (Xero adds GST from the tax type). Refuses to produce a
 * file whose line total does not reconcile to the claim total, so a subtly
 * wrong invoice can never be exported silently.
 */
export function buildXeroInvoiceExport(
  claim: XeroClaimExportInput,
  config: XeroExportConfig,
): { filename: string; rows: CsvCell[][] } {
  if (claim.lots.length === 0) {
    throw AppError.badRequest('Cannot export a claim with no claimed lots to Xero');
  }

  const invoiceNumber = `Claim ${claim.claimNumber} — ${claim.projectName}`;
  const invoiceDate = formatDate(config.invoiceDate ?? claim.periodEnd);
  const contactName = claim.clientName?.trim() || claim.projectName;
  const taxType = config.taxType?.trim() ?? '';

  const dataRows: CsvCell[][] = claim.lots.map((lot) => {
    const unitAmount = roundClaimAmountToCents(lot.amountClaimed);
    const description =
      `Lot ${lot.lotNumber} — ${lot.activityType} — ` +
      `this claim ${formatPercent(lot.thisClaimPercent)}% ` +
      `(cumulative ${formatPercent(lot.cumulativePercent)}%)`;
    return [
      contactName,
      invoiceNumber,
      invoiceDate,
      invoiceDate,
      description,
      1,
      unitAmount,
      config.accountCode,
      taxType,
    ];
  });

  const unitAmountIndex = XERO_INVOICE_CSV_HEADER.indexOf('*UnitAmount');
  const lineTotal = roundClaimAmountToCents(
    dataRows.reduce((sum, row) => sum + Number(row[unitAmountIndex]), 0),
  );
  const claimTotal = roundClaimAmountToCents(claim.totalClaimedAmount);
  if (lineTotal !== claimTotal) {
    throw AppError.badRequest(
      `Xero export blocked: line total ${lineTotal} does not match claim total ${claimTotal}`,
      { lineTotal, claimTotal },
    );
  }

  return {
    filename: `xero-claim-${claim.claimNumber}.csv`,
    rows: [[...XERO_INVOICE_CSV_HEADER], ...dataRows],
  };
}

type AuthUser = NonNullable<Express.Request['user']>;

interface XeroExportRouterDependencies {
  parseClaimRouteParam: (value: unknown, field: string) => string;
  requireCommercialProjectAccess: (user: AuthUser, projectId: string) => Promise<void>;
}

/** Prisma Decimal | null -> number (0 when null), matching presentation.ts. */
function toNumber(value: unknown): number {
  return value == null ? 0 : Number(value);
}

function parseOptionalQueryString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw AppError.badRequest(`${field} query parameter must be a non-empty string`);
  }
  return value.trim();
}

/**
 * GET /:projectId/claims/:claimId/xero-export
 * Returns { filename, rows } for a Xero sales-invoice CSV import. Mounted after
 * the shared requireAuth gate in claims.ts, so no requireAuth in the deps here.
 */
export function createClaimXeroExportRouter(deps: XeroExportRouterDependencies): Router {
  const router = Router();

  router.get(
    '/:projectId/claims/:claimId/xero-export',
    asyncHandler(async (req, res) => {
      const projectId = deps.parseClaimRouteParam(req.params.projectId, 'projectId');
      const claimId = deps.parseClaimRouteParam(req.params.claimId, 'claimId');
      await deps.requireCommercialProjectAccess(req.user!, projectId);

      const accountCode = parseOptionalQueryString(req.query.accountCode, 'accountCode') ?? '200';
      const taxType = parseOptionalQueryString(req.query.taxType, 'taxType');

      const claim = await prisma.progressClaim.findFirst({
        where: { id: claimId, projectId },
        include: {
          claimedLots: {
            include: {
              lot: {
                select: { id: true, lotNumber: true, activityType: true, budgetAmount: true },
              },
            },
          },
          project: { select: { name: true, clientName: true } },
        },
      });
      if (!claim) {
        throw AppError.notFound('Claim');
      }

      const cumulativeByLot = await getCumulativeClaimedPercentByLot(
        claim.claimedLots.map((claimedLot) => claimedLot.lotId),
      );

      const result = buildXeroInvoiceExport(
        {
          claimNumber: claim.claimNumber,
          projectName: claim.project.name,
          clientName: claim.project.clientName,
          periodEnd: claim.claimPeriodEnd.toISOString(),
          totalClaimedAmount: toNumber(claim.totalClaimedAmount),
          lots: claim.claimedLots.map((claimedLot) => ({
            lotNumber: claimedLot.lot.lotNumber,
            activityType: claimedLot.lot.activityType,
            amountClaimed: toNumber(claimedLot.amountClaimed),
            thisClaimPercent: toNumber(claimedLot.percentageComplete),
            cumulativePercent:
              cumulativeByLot.get(claimedLot.lotId) ?? toNumber(claimedLot.percentageComplete),
          })),
        },
        { accountCode, taxType },
      );

      res.json(result);
    }),
  );

  return router;
}
