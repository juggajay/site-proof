import { formatDocketNumber } from './formatting.js';

type ApprovedTotalInput<TLabourSubmitted, TPlantSubmitted> = {
  adjustedLabourHours?: number;
  adjustedPlantHours?: number;
  totalLabourSubmitted: TLabourSubmitted;
  totalPlantSubmitted: TPlantSubmitted;
};

export function resolveDocketApprovedTotals<TLabourSubmitted, TPlantSubmitted>({
  adjustedLabourHours,
  adjustedPlantHours,
  totalLabourSubmitted,
  totalPlantSubmitted,
}: ApprovedTotalInput<TLabourSubmitted, TPlantSubmitted>): {
  labourApproved: number | TLabourSubmitted;
  plantApproved: number | TPlantSubmitted;
} {
  return {
    labourApproved: adjustedLabourHours !== undefined ? adjustedLabourHours : totalLabourSubmitted,
    plantApproved: adjustedPlantHours !== undefined ? adjustedPlantHours : totalPlantSubmitted,
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
