// =============================================================================
// Docket detail presentation: pure mappers that shape docket labour/plant entry
// rows into their API response objects, plus the submitted/approved total
// reducers. Extracted from dockets.ts to remove repeated inline mapping —
// output is preserved exactly (same field names + order, same `Number(x) || 0`
// coercion, same `wetOrDry || 'dry'` fallback, same totals).
//
// The detail route (`GET /:id`) omits `adjustmentReason` from each entry, while
// the per-entry routes (`GET /:id/labour`, `GET /:id/plant`) include it; the
// `includeAdjustmentReason` option reproduces both shapes (and the original key
// position) without changing any other field.
// =============================================================================

import { formatDocketDate, formatDocketNumber } from './formatting.js';
import type { ForemanDiarySummary } from './diaryComparison.js';

// Accepts a Prisma Decimal, number, string, or nullish value — anything the
// route code coerces with `Number(x) || 0`.
type NumericLike = number | string | { toString(): string } | null | undefined;

function numericValue(value: NumericLike): number {
  return Number(value) || 0;
}

function optionalNumericValue(value: NumericLike): number | null {
  if (value === null || value === undefined) return null;
  return Number(value) || 0;
}

function includesCommercialAmounts(options: CommercialPresentationOptions = {}): boolean {
  return options.includeCommercialAmounts !== false;
}

function commercialNumericValue(
  value: NumericLike,
  options: CommercialPresentationOptions = {},
): number | null {
  return includesCommercialAmounts(options) ? numericValue(value) : null;
}

function commercialOptionalNumericValue(
  value: NumericLike,
  options: CommercialPresentationOptions = {},
): number | null {
  return includesCommercialAmounts(options) ? optionalNumericValue(value) : null;
}

export type DocketLabourEntrySource = {
  id: string;
  employee: {
    id: string;
    name: string;
    role: string | null;
    hourlyRate: NumericLike;
  };
  startTime: string | null;
  finishTime: string | null;
  submittedHours: NumericLike;
  approvedHours: NumericLike;
  hourlyRate: NumericLike;
  submittedCost: NumericLike;
  approvedCost: NumericLike;
  adjustmentReason: string | null;
  lotAllocations: Array<{
    lotId: string;
    lot: { lotNumber: string };
    hours: NumericLike;
  }>;
};

export type DocketPlantEntrySource = {
  id: string;
  plant: {
    id: string;
    type: string;
    description: string | null;
    idRego: string | null;
    dryRate: NumericLike;
    wetRate: NumericLike;
  };
  hoursOperated: NumericLike;
  wetOrDry: string | null;
  hourlyRate: NumericLike;
  submittedCost: NumericLike;
  approvedCost: NumericLike;
  adjustmentReason: string | null;
  lotAllocations: Array<{
    lotId: string;
    lot: { lotNumber: string };
    hours: NumericLike;
  }>;
};

type CommercialPresentationOptions = { includeCommercialAmounts?: boolean };
type PresentationOptions = CommercialPresentationOptions & { includeAdjustmentReason?: boolean };

export function mapDocketLabourEntry(
  entry: DocketLabourEntrySource,
  options: PresentationOptions = {},
) {
  const base = {
    id: entry.id,
    employee: {
      id: entry.employee.id,
      name: entry.employee.name,
      role: entry.employee.role,
      hourlyRate: commercialNumericValue(entry.employee.hourlyRate, options),
    },
    startTime: entry.startTime,
    finishTime: entry.finishTime,
    submittedHours: numericValue(entry.submittedHours),
    approvedHours: numericValue(entry.approvedHours),
    hourlyRate: commercialNumericValue(entry.hourlyRate, options),
    submittedCost: commercialNumericValue(entry.submittedCost, options),
    approvedCost: commercialNumericValue(entry.approvedCost, options),
  };

  const lotAllocations = entry.lotAllocations.map((a) => ({
    lotId: a.lotId,
    lotNumber: a.lot.lotNumber,
    hours: numericValue(a.hours),
  }));

  if (options.includeAdjustmentReason) {
    return { ...base, adjustmentReason: entry.adjustmentReason, lotAllocations };
  }

  return { ...base, lotAllocations };
}

export function mapDocketPlantEntry(
  entry: DocketPlantEntrySource,
  options: PresentationOptions = {},
) {
  const base = {
    id: entry.id,
    plant: {
      id: entry.plant.id,
      type: entry.plant.type,
      description: entry.plant.description,
      idRego: entry.plant.idRego,
      dryRate: commercialNumericValue(entry.plant.dryRate, options),
      wetRate: commercialNumericValue(entry.plant.wetRate, options),
    },
    hoursOperated: numericValue(entry.hoursOperated),
    wetOrDry: entry.wetOrDry || 'dry',
    hourlyRate: commercialNumericValue(entry.hourlyRate, options),
    submittedCost: commercialNumericValue(entry.submittedCost, options),
    approvedCost: commercialNumericValue(entry.approvedCost, options),
  };

  const lotAllocations = entry.lotAllocations.map((a) => ({
    lotId: a.lotId,
    lotNumber: a.lot.lotNumber,
    hours: numericValue(a.hours),
  }));

  if (options.includeAdjustmentReason) {
    return { ...base, adjustmentReason: entry.adjustmentReason, lotAllocations };
  }

  return { ...base, lotAllocations };
}

export function sumDocketLabourTotals(
  entries: Array<{
    submittedHours: number;
    submittedCost: NumericLike;
    approvedHours: number;
    approvedCost: NumericLike;
  }>,
): { submittedHours: number; submittedCost: number; approvedHours: number; approvedCost: number } {
  return {
    submittedHours: entries.reduce((sum, e) => sum + e.submittedHours, 0),
    submittedCost: entries.reduce((sum, e) => sum + numericValue(e.submittedCost), 0),
    approvedHours: entries.reduce((sum, e) => sum + e.approvedHours, 0),
    approvedCost: entries.reduce((sum, e) => sum + numericValue(e.approvedCost), 0),
  };
}

export function sumDocketPlantTotals(
  entries: Array<{ hoursOperated: number; submittedCost: NumericLike; approvedCost: NumericLike }>,
): { hours: number; submittedCost: number; approvedCost: number } {
  return {
    hours: entries.reduce((sum, e) => sum + e.hoursOperated, 0),
    submittedCost: entries.reduce((sum, e) => sum + numericValue(e.submittedCost), 0),
    approvedCost: entries.reduce((sum, e) => sum + numericValue(e.approvedCost), 0),
  };
}

// =============================================================================
// Docket list presentation: the pure per-row mapper for `GET /api/dockets`.
// Extracted verbatim from the inline `dockets.map(...)` — same field names +
// order, same `formatDocketNumber`/`formatDocketDate` formatting, same numeric
// coercion for the labour/plant hour reducers and the stored submitted/approved
// hour/cost totals. Nullable approved-cost totals stay nullable so clients can
// distinguish older approved dockets from real zero-dollar approvals.
// =============================================================================

export type DocketListItemSource = {
  id: string;
  subcontractorCompany: { id: string; companyName: string };
  date: Date;
  status: string;
  notes: string | null;
  labourEntries: Array<{ submittedHours: NumericLike }>;
  plantEntries: Array<{ hoursOperated: NumericLike }>;
  totalLabourSubmitted: NumericLike;
  totalLabourApproved: NumericLike;
  totalPlantSubmitted: NumericLike;
  totalPlantApproved: NumericLike;
  totalLabourApprovedCost?: NumericLike;
  totalPlantApprovedCost?: NumericLike;
  submittedAt: Date | null;
  submittedBy?: DocketUserSummary | null;
  approvedAt: Date | null;
  approvedBy?: DocketUserSummary | null;
  foremanNotes: string | null;
};

export function mapDocketListItem(
  docket: DocketListItemSource,
  options: CommercialPresentationOptions = {},
) {
  return {
    id: docket.id,
    docketNumber: formatDocketNumber(docket.id),
    subcontractor: docket.subcontractorCompany.companyName,
    subcontractorId: docket.subcontractorCompany.id,
    date: formatDocketDate(docket.date),
    status: docket.status,
    notes: docket.notes,
    labourHours: docket.labourEntries.reduce(
      (sum, entry) => sum + numericValue(entry.submittedHours),
      0,
    ),
    plantHours: docket.plantEntries.reduce(
      (sum, entry) => sum + numericValue(entry.hoursOperated),
      0,
    ),
    labourEntryCount: docket.labourEntries.length,
    plantEntryCount: docket.plantEntries.length,
    totalLabourSubmitted: commercialNumericValue(docket.totalLabourSubmitted, options),
    totalLabourApproved: numericValue(docket.totalLabourApproved),
    totalPlantSubmitted: commercialNumericValue(docket.totalPlantSubmitted, options),
    totalPlantApproved: numericValue(docket.totalPlantApproved),
    totalLabourApprovedCost: commercialOptionalNumericValue(
      docket.totalLabourApprovedCost,
      options,
    ),
    totalPlantApprovedCost: commercialOptionalNumericValue(docket.totalPlantApprovedCost, options),
    submittedAt: docket.submittedAt,
    submittedBy: docket.submittedBy ?? null,
    approvedAt: docket.approvedAt,
    approvedBy: docket.approvedBy ?? null,
    foremanNotes: docket.foremanNotes,
  };
}

export function buildDocketListResponse(
  dockets: ReturnType<typeof mapDocketListItem>[],
  pagination: unknown,
) {
  return {
    data: dockets,
    pagination,
    dockets,
  };
}

export function buildDocketLabourEntriesResponse(
  labourEntries: Array<ReturnType<typeof mapDocketLabourEntry>>,
  options: CommercialPresentationOptions = {},
) {
  const totals = sumDocketLabourTotals(labourEntries);
  return {
    labourEntries,
    totals: includesCommercialAmounts(options)
      ? totals
      : {
          submittedHours: totals.submittedHours,
          submittedCost: null,
          approvedHours: totals.approvedHours,
          approvedCost: null,
        },
  };
}

export function buildDocketPlantEntriesResponse(
  plantEntries: Array<ReturnType<typeof mapDocketPlantEntry>>,
  options: CommercialPresentationOptions = {},
) {
  const totals = sumDocketPlantTotals(plantEntries);
  return {
    plantEntries,
    totals: includesCommercialAmounts(options)
      ? totals
      : {
          hours: totals.hours,
          submittedCost: null,
          approvedCost: null,
        },
  };
}

export function buildDocketEntryDeletedResponse(
  message: 'Labour entry deleted' | 'Plant entry deleted',
  runningTotal?: { hours: number; cost: number },
) {
  return runningTotal ? { message, runningTotal } : { message };
}

// =============================================================================
// Docket detail presentation: assembles the full `GET /api/dockets/:id` response
// body — the `docket` object (reusing the labour/plant entry mappers above),
// plus the top-level `foremanDiary` and `discrepancies`: same field names +
// order, same `formatDocketNumber`/`formatDocketDate` formatting, same numeric
// coercion for submitted/approved hour/cost totals. Nullable approved-cost
// totals stay nullable so clients can fall back safely for older rows. The route
// still owns request parsing, the Prisma reads, the access check, and finding
// the diary/project/users.
// =============================================================================

export type DocketProjectSummary = { id: string; name: string };

export type DocketUserSummary = { id: string; fullName: string | null; email: string };

export type DocketDetailSource = {
  id: string;
  date: Date;
  status: string;
  projectId: string;
  subcontractorCompany: { id: string; companyName: string };
  notes: string | null;
  foremanNotes: string | null;
  adjustmentReason: string | null;
  submittedAt: Date | null;
  submittedById: string | null;
  approvedAt: Date | null;
  approvedById: string | null;
  totalLabourSubmitted: NumericLike;
  totalLabourApproved: NumericLike;
  totalPlantSubmitted: NumericLike;
  totalPlantApproved: NumericLike;
  totalLabourApprovedCost?: NumericLike;
  totalPlantApprovedCost?: NumericLike;
  labourEntries: DocketLabourEntrySource[];
  plantEntries: DocketPlantEntrySource[];
};

export function buildDocketDetailResponse(input: {
  docket: DocketDetailSource;
  project: DocketProjectSummary | null;
  submittedBy: DocketUserSummary | null;
  approvedBy: DocketUserSummary | null;
  foremanDiary: ForemanDiarySummary | null;
  discrepancies: string[];
  includeCommercialAmounts?: boolean;
}) {
  const {
    docket,
    project,
    submittedBy,
    approvedBy,
    foremanDiary,
    discrepancies,
    includeCommercialAmounts,
  } = input;
  const commercialOptions = { includeCommercialAmounts };
  return {
    docket: {
      id: docket.id,
      docketNumber: formatDocketNumber(docket.id),
      date: formatDocketDate(docket.date),
      status: docket.status,
      projectId: docket.projectId,
      project,
      subcontractor: docket.subcontractorCompany,
      notes: docket.notes,
      foremanNotes: docket.foremanNotes,
      adjustmentReason: docket.adjustmentReason,
      submittedAt: docket.submittedAt,
      submittedById: docket.submittedById,
      submittedBy,
      approvedAt: docket.approvedAt,
      approvedById: docket.approvedById,
      approvedBy,
      totalLabourSubmitted: commercialNumericValue(docket.totalLabourSubmitted, commercialOptions),
      totalLabourApproved: numericValue(docket.totalLabourApproved),
      totalPlantSubmitted: commercialNumericValue(docket.totalPlantSubmitted, commercialOptions),
      totalPlantApproved: numericValue(docket.totalPlantApproved),
      totalLabourApprovedCost: commercialOptionalNumericValue(
        docket.totalLabourApprovedCost,
        commercialOptions,
      ),
      totalPlantApprovedCost: commercialOptionalNumericValue(
        docket.totalPlantApprovedCost,
        commercialOptions,
      ),
      labourEntries: docket.labourEntries.map((entry) =>
        mapDocketLabourEntry(entry, commercialOptions),
      ),
      plantEntries: docket.plantEntries.map((entry) =>
        mapDocketPlantEntry(entry, commercialOptions),
      ),
    },
    foremanDiary,
    discrepancies: discrepancies.length > 0 ? discrepancies : null,
  };
}
