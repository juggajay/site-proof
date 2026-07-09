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

export interface XeroVariationExportInput {
  variationNumber: string;
  title: string;
  /** Ex-GST approved amount claimed once in full. */
  approvedAmount: number;
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
  variations?: XeroVariationExportInput[];
}

/**
 * Xero's own account default for a present-but-blank TaxType cell is *no tax* —
 * a blank cell silently imports the line as untaxed and under-bills GST. So we
 * never emit blank: default to the standard GST-on-income rate name. The org can
 * override with the exact display name from their chart (see route help text).
 */
export const XERO_DEFAULT_TAX_TYPE = 'GST on Income';

/** Calendar days added to the invoice date when no explicit due date is given. */
export const XERO_DEFAULT_PAYMENT_TERMS_DAYS = 30;

export interface XeroExportConfig {
  /** Xero income account code (e.g. "200"). Must exist in the org's chart. */
  accountCode: string;
  /**
   * Tax-rate display name; must match the org's chart exactly. Defaults to
   * `GST on Income`. A blank value is treated as unset (falls back to the
   * default) — Xero imports a blank TaxType as untaxed, never the account
   * default, so we refuse to emit blank.
   */
  taxType?: string;
  /** ISO date override for the invoice date; defaults to the claim period end. */
  invoiceDate?: string;
  /**
   * ISO date override for the payment due date. When absent, DueDate is the
   * invoice date plus `paymentTermsDays`. The frontend passes the SOPA-derived
   * due date here so the invoice does not age overdue from day one.
   */
  dueDate?: string;
  /** Calendar days added to the invoice date for DueDate. Default 30. */
  paymentTermsDays?: number;
}

type CsvCell = string | number;

function formatPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/**
 * Emit ISO `YYYY-MM-DD` from the UTC parts so it is timezone-stable and
 * locale-safe on import (Xero accepts ISO and cannot misread it as US M/D/Y).
 */
function formatDate(iso: string): string {
  const date = new Date(iso);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Invoice date + N calendar days, returned as an ISO date string (UTC-based). */
function addCalendarDaysIso(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
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
  const variations = claim.variations ?? [];
  if (claim.lots.length === 0 && variations.length === 0) {
    throw AppError.badRequest('Cannot export a claim with no claimed lines to Xero');
  }

  const invoiceNumber = `Claim ${claim.claimNumber} — ${claim.projectName}`;
  const invoiceDateIso = config.invoiceDate ?? claim.periodEnd;
  const invoiceDate = formatDate(invoiceDateIso);
  // DueDate must never equal InvoiceDate (Xero takes it literally → overdue on
  // day one). Prefer an explicit due date (the SOPA-derived date the frontend
  // passes); otherwise invoice date + payment terms.
  const termsDays =
    config.paymentTermsDays && config.paymentTermsDays > 0
      ? config.paymentTermsDays
      : XERO_DEFAULT_PAYMENT_TERMS_DAYS;
  const dueDate = formatDate(config.dueDate ?? addCalendarDaysIso(invoiceDateIso, termsDays));
  const contactName = claim.clientName?.trim() || claim.projectName;
  // Never blank — a blank TaxType imports as untaxed and under-bills GST.
  const taxType = config.taxType?.trim() || XERO_DEFAULT_TAX_TYPE;

  const lotRows: CsvCell[][] = claim.lots.map((lot) => {
    const unitAmount = roundClaimAmountToCents(lot.amountClaimed);
    const description =
      `Lot ${lot.lotNumber} — ${lot.activityType} — ` +
      `this claim ${formatPercent(lot.thisClaimPercent)}% ` +
      `(cumulative ${formatPercent(lot.cumulativePercent)}%)`;
    return [
      contactName,
      invoiceNumber,
      invoiceDate,
      dueDate,
      description,
      1,
      unitAmount,
      config.accountCode,
      taxType,
    ];
  });
  const variationRows: CsvCell[][] = variations.map((variation) => [
    contactName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    `Variation ${variation.variationNumber} — ${variation.title}`,
    1,
    roundClaimAmountToCents(variation.approvedAmount),
    config.accountCode,
    taxType,
  ]);
  const dataRows = [...lotRows, ...variationRows];

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
      // The frontend computes the SOPA-derived payment due date (it owns the
      // per-state business-day tables) and passes it here; falls back to invoice
      // date + default terms when absent.
      const dueDate = parseOptionalQueryString(req.query.dueDate, 'dueDate');

      const claim = await prisma.progressClaim.findFirst({
        where: { id: claimId, projectId },
        include: {
          claimedLots: {
            include: {
              lot: {
                select: { lotNumber: true, activityType: true },
              },
            },
          },
          project: { select: { name: true, clientName: true } },
          variations: {
            select: {
              variationNumber: true,
              title: true,
              approvedAmount: true,
            },
            orderBy: { variationNumber: 'asc' },
          },
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
          variations: claim.variations.map((variation) => ({
            variationNumber: variation.variationNumber,
            title: variation.title,
            approvedAmount: toNumber(variation.approvedAmount),
          })),
        },
        { accountCode, taxType, dueDate },
      );

      res.json(result);
    }),
  );

  return router;
}
