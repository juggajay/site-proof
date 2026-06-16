import { formatDocketNumber } from './formatting.js';

type ApprovedTotalInput<TSubmittedLabourHours, TSubmittedPlantHours> = {
  adjustedLabourHours?: number;
  adjustedPlantHours?: number;
  submittedLabourHours: TSubmittedLabourHours;
  submittedPlantHours: TSubmittedPlantHours;
};

type NumericLike = number | string | { toString(): string } | null | undefined;

type DocketLabourApprovalEntryInput = {
  id: string;
  submittedHours: NumericLike;
  hourlyRate: NumericLike;
  submittedCost: NumericLike;
};

type DocketPlantApprovalEntryInput = {
  id: string;
  hoursOperated: NumericLike;
  hourlyRate: NumericLike;
  submittedCost: NumericLike;
};

type DocketApprovalEntryUpdatesInput = {
  labourEntries: DocketLabourApprovalEntryInput[];
  plantEntries: DocketPlantApprovalEntryInput[];
  labourApprovedHours: NumericLike;
  plantApprovedHours: NumericLike;
  adjustmentReason: string | null | undefined;
};

type DocketLabourApprovalEntryUpdate = {
  id: string;
  approvedHours: number;
  approvedCost: number;
  adjustmentReason: string | null;
};

type DocketPlantApprovalEntryUpdate = {
  id: string;
  approvedCost: number;
  adjustmentReason: string | null;
};

function numericValue(value: NumericLike): number {
  return Number(value) || 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function prorateApprovedCost(params: {
  submittedHours: number;
  submittedCost: number;
  hourlyRate: number;
  approvedHours: number;
}): number {
  const { submittedHours, submittedCost, hourlyRate, approvedHours } = params;
  if (submittedHours > 0 && submittedCost > 0) {
    return roundMoney((submittedCost * approvedHours) / submittedHours);
  }
  return roundMoney(approvedHours * hourlyRate);
}

export function resolveDocketApprovedTotals<TSubmittedLabourHours, TSubmittedPlantHours>({
  adjustedLabourHours,
  adjustedPlantHours,
  submittedLabourHours,
  submittedPlantHours,
}: ApprovedTotalInput<TSubmittedLabourHours, TSubmittedPlantHours>): {
  labourApproved: number | TSubmittedLabourHours;
  plantApproved: number | TSubmittedPlantHours;
} {
  return {
    labourApproved: adjustedLabourHours !== undefined ? adjustedLabourHours : submittedLabourHours,
    plantApproved: adjustedPlantHours !== undefined ? adjustedPlantHours : submittedPlantHours,
  };
}

export function buildDocketApprovalEntryUpdates({
  labourEntries,
  plantEntries,
  labourApprovedHours,
  plantApprovedHours,
  adjustmentReason,
}: DocketApprovalEntryUpdatesInput): {
  labour: DocketLabourApprovalEntryUpdate[];
  plant: DocketPlantApprovalEntryUpdate[];
} {
  const approvedLabourTotal = numericValue(labourApprovedHours);
  const approvedPlantTotal = numericValue(plantApprovedHours);
  const submittedLabourTotal = labourEntries.reduce(
    (sum, entry) => sum + numericValue(entry.submittedHours),
    0,
  );
  const submittedPlantTotal = plantEntries.reduce(
    (sum, entry) => sum + numericValue(entry.hoursOperated),
    0,
  );
  const labourScale = submittedLabourTotal > 0 ? approvedLabourTotal / submittedLabourTotal : 0;
  const plantScale = submittedPlantTotal > 0 ? approvedPlantTotal / submittedPlantTotal : 0;
  const normalizedAdjustmentReason = adjustmentReason ?? null;

  return {
    labour: labourEntries.map((entry) => {
      const submittedHours = numericValue(entry.submittedHours);
      const approvedHours = submittedHours * labourScale;
      return {
        id: entry.id,
        approvedHours,
        approvedCost: prorateApprovedCost({
          submittedHours,
          submittedCost: numericValue(entry.submittedCost),
          hourlyRate: numericValue(entry.hourlyRate),
          approvedHours,
        }),
        adjustmentReason: normalizedAdjustmentReason,
      };
    }),
    plant: plantEntries.map((entry) => {
      const submittedHours = numericValue(entry.hoursOperated);
      const approvedHours = submittedHours * plantScale;
      return {
        id: entry.id,
        approvedCost: prorateApprovedCost({
          submittedHours,
          submittedCost: numericValue(entry.submittedCost),
          hourlyRate: numericValue(entry.hourlyRate),
          approvedHours,
        }),
        adjustmentReason: normalizedAdjustmentReason,
      };
    }),
  };
}

type ApprovedDocketResponseInput = {
  updatedDocket: {
    id: string;
    status: string;
    approvedAt: Date | null;
    subcontractorCompany: {
      companyName: string;
    };
  };
  subcontractorUsers: Array<{
    email: string;
    fullName: string | null;
  }>;
  diarySync?: DocketDiarySyncOutcome;
};

export type DocketDiarySyncOutcome =
  | {
      status: 'synced';
      message: string;
    }
  | {
      status: 'skipped' | 'failed';
      code: 'DIARY_LOCKED' | 'DIARY_SUBMITTED' | 'DIARY_SYNC_FAILED';
      message: string;
    };

export function buildDocketApprovedResponse({
  updatedDocket,
  subcontractorUsers,
  diarySync,
}: ApprovedDocketResponseInput): {
  message: 'Docket approved successfully';
  docket: {
    id: string;
    docketNumber: string;
    subcontractor: string;
    status: string;
    approvedAt: Date | null;
  };
  notifiedUsers: Array<{
    email: string;
    fullName: string | null;
  }>;
  diarySync?: DocketDiarySyncOutcome;
} {
  return {
    message: 'Docket approved successfully',
    docket: {
      id: updatedDocket.id,
      docketNumber: formatDocketNumber(updatedDocket.id),
      subcontractor: updatedDocket.subcontractorCompany.companyName,
      status: updatedDocket.status,
      approvedAt: updatedDocket.approvedAt,
    },
    notifiedUsers: subcontractorUsers.map((su) => ({
      email: su.email,
      fullName: su.fullName,
    })),
    ...(diarySync ? { diarySync } : {}),
  };
}
