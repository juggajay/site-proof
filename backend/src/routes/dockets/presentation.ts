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

// Accepts a Prisma Decimal, number, string, or nullish value — anything the
// route code coerces with `Number(x) || 0`.
type NumericLike = number | string | { toString(): string } | null | undefined;

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
};

type PresentationOptions = { includeAdjustmentReason?: boolean };

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
      hourlyRate: Number(entry.employee.hourlyRate) || 0,
    },
    startTime: entry.startTime,
    finishTime: entry.finishTime,
    submittedHours: Number(entry.submittedHours) || 0,
    approvedHours: Number(entry.approvedHours) || 0,
    hourlyRate: Number(entry.hourlyRate) || 0,
    submittedCost: Number(entry.submittedCost) || 0,
    approvedCost: Number(entry.approvedCost) || 0,
  };

  const lotAllocations = entry.lotAllocations.map((a) => ({
    lotId: a.lotId,
    lotNumber: a.lot.lotNumber,
    hours: Number(a.hours) || 0,
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
      dryRate: Number(entry.plant.dryRate) || 0,
      wetRate: Number(entry.plant.wetRate) || 0,
    },
    hoursOperated: Number(entry.hoursOperated) || 0,
    wetOrDry: entry.wetOrDry || 'dry',
    hourlyRate: Number(entry.hourlyRate) || 0,
    submittedCost: Number(entry.submittedCost) || 0,
    approvedCost: Number(entry.approvedCost) || 0,
  };

  if (options.includeAdjustmentReason) {
    return { ...base, adjustmentReason: entry.adjustmentReason };
  }

  return base;
}

export function sumDocketLabourTotals(
  entries: Array<{
    submittedHours: number;
    submittedCost: number;
    approvedHours: number;
    approvedCost: number;
  }>,
): { submittedHours: number; submittedCost: number; approvedHours: number; approvedCost: number } {
  return {
    submittedHours: entries.reduce((sum, e) => sum + e.submittedHours, 0),
    submittedCost: entries.reduce((sum, e) => sum + e.submittedCost, 0),
    approvedHours: entries.reduce((sum, e) => sum + e.approvedHours, 0),
    approvedCost: entries.reduce((sum, e) => sum + e.approvedCost, 0),
  };
}

export function sumDocketPlantTotals(
  entries: Array<{ hoursOperated: number; submittedCost: number; approvedCost: number }>,
): { hours: number; submittedCost: number; approvedCost: number } {
  return {
    hours: entries.reduce((sum, e) => sum + e.hoursOperated, 0),
    submittedCost: entries.reduce((sum, e) => sum + e.submittedCost, 0),
    approvedCost: entries.reduce((sum, e) => sum + e.approvedCost, 0),
  };
}

// =============================================================================
// Docket list presentation: the pure per-row mapper for `GET /api/dockets`.
// Extracted verbatim from the inline `dockets.map(...)` — same field names +
// order, same `formatDocketNumber`/`formatDocketDate` formatting, same
// `Number(x) || 0` coercion for the labour/plant hour reducers and the stored
// submitted/approved totals, and the same pass-through of nullable
// notes/foremanNotes/submittedAt/approvedAt.
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
  submittedAt: Date | null;
  approvedAt: Date | null;
  foremanNotes: string | null;
};

export function mapDocketListItem(docket: DocketListItemSource) {
  return {
    id: docket.id,
    docketNumber: formatDocketNumber(docket.id),
    subcontractor: docket.subcontractorCompany.companyName,
    subcontractorId: docket.subcontractorCompany.id,
    date: formatDocketDate(docket.date),
    status: docket.status,
    notes: docket.notes,
    labourHours: docket.labourEntries.reduce(
      (sum, entry) => sum + (Number(entry.submittedHours) || 0),
      0,
    ),
    plantHours: docket.plantEntries.reduce(
      (sum, entry) => sum + (Number(entry.hoursOperated) || 0),
      0,
    ),
    totalLabourSubmitted: Number(docket.totalLabourSubmitted) || 0,
    totalLabourApproved: Number(docket.totalLabourApproved) || 0,
    totalPlantSubmitted: Number(docket.totalPlantSubmitted) || 0,
    totalPlantApproved: Number(docket.totalPlantApproved) || 0,
    submittedAt: docket.submittedAt,
    approvedAt: docket.approvedAt,
    foremanNotes: docket.foremanNotes,
  };
}
