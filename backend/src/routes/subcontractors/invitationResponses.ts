import { maskInvitedEmail } from '../../lib/subcontractorInvitations.js';

type NullableText = string | null | undefined;
type NumericLike = number | string | { toString(): string } | null | undefined;

type InvitationDetailsSource = {
  id: string;
  companyName: string;
  project: { name: string };
  primaryContactEmail: NullableText;
  primaryContactName: NullableText;
  status: string;
  invitationExpiresAt: Date | null;
};

type UserPendingInvitationSource = InvitationDetailsSource & {
  project: {
    id: string;
    name: string;
    company: { name: string };
  };
};

type DirectorySubcontractorSource = {
  id: string;
  companyName: string;
  abn: NullableText;
  primaryContactName: NullableText;
  primaryContactEmail: NullableText;
  primaryContactPhone: NullableText;
};

type InvitedSubcontractorSource = {
  id: string;
  companyName: string;
  abn: NullableText;
  primaryContactName: NullableText;
  primaryContactEmail: NullableText;
  primaryContactPhone: NullableText;
  status: string;
};

type AcceptedSubcontractorSource = InvitedSubcontractorSource & {
  project: { name: string };
};

type ApprovedDocketCostSource = {
  totalLabourSubmitted: NumericLike;
  totalPlantSubmitted: NumericLike;
  totalLabourApproved?: NumericLike;
  totalPlantApproved?: NumericLike;
  labourEntries?: Array<{
    submittedCost: NumericLike;
    approvedCost: NumericLike;
  }>;
  plantEntries?: Array<{
    submittedCost: NumericLike;
    approvedCost: NumericLike;
  }>;
};

function numericValue(value: NumericLike): number {
  return Number(value) || 0;
}

export function calculateApprovedDocketTotalCost(dockets: ApprovedDocketCostSource[]): number {
  return dockets.reduce((sum, docket) => {
    const labourCost = docket.labourEntries?.length
      ? docket.labourEntries.reduce(
          (entrySum, entry) =>
            entrySum +
            (entry.approvedCost == null
              ? numericValue(entry.submittedCost)
              : numericValue(entry.approvedCost)),
          0,
        )
      : numericValue(docket.totalLabourSubmitted);
    const plantCost = docket.plantEntries?.length
      ? docket.plantEntries.reduce(
          (entrySum, entry) =>
            entrySum +
            (entry.approvedCost == null
              ? numericValue(entry.submittedCost)
              : numericValue(entry.approvedCost)),
          0,
        )
      : numericValue(docket.totalPlantSubmitted);
    return sum + labourCost + plantCost;
  }, 0);
}

export function buildSubcontractorInvitationDetailsResponse(
  subcontractor: InvitationDetailsSource,
  headContractorName: string,
  canAccept: boolean,
) {
  return {
    invitation: {
      id: subcontractor.id,
      companyName: subcontractor.companyName,
      projectName: subcontractor.project.name,
      headContractorName,
      primaryContactEmail: '',
      primaryContactEmailMasked: subcontractor.primaryContactEmail
        ? maskInvitedEmail(subcontractor.primaryContactEmail)
        : '',
      primaryContactName: '',
      status: subcontractor.status,
      expiresAt: subcontractor.invitationExpiresAt?.toISOString() ?? null,
      canAccept,
    },
  };
}

export function buildEmptyPendingSubcontractorInvitationResponse() {
  return { invitation: null };
}

export function buildUserPendingSubcontractorInvitationResponse(
  invitation: UserPendingInvitationSource,
) {
  return {
    invitation: {
      id: invitation.id,
      companyName: invitation.companyName,
      projectId: invitation.project.id,
      projectName: invitation.project.name,
      headContractorName: invitation.project.company.name,
      primaryContactEmail: invitation.primaryContactEmail,
      primaryContactName: invitation.primaryContactName,
      status: invitation.status,
      expiresAt: invitation.invitationExpiresAt?.toISOString() ?? null,
      canAccept: true,
    },
  };
}

export function buildSubcontractorDirectoryResponse(
  subcontractors: DirectorySubcontractorSource[],
) {
  return {
    subcontractors: subcontractors.map((subcontractor) => ({
      id: subcontractor.id,
      companyName: subcontractor.companyName,
      abn: subcontractor.abn || '',
      primaryContactName: subcontractor.primaryContactName || '',
      primaryContactEmail: subcontractor.primaryContactEmail || '',
      primaryContactPhone: subcontractor.primaryContactPhone || '',
    })),
  };
}

export function buildSubcontractorInvitedResponse(subcontractor: InvitedSubcontractorSource) {
  return {
    message: 'Subcontractor invited successfully',
    subcontractor: {
      id: subcontractor.id,
      companyName: subcontractor.companyName,
      abn: subcontractor.abn || '',
      primaryContact: subcontractor.primaryContactName || '',
      email: subcontractor.primaryContactEmail || '',
      phone: subcontractor.primaryContactPhone || '',
      status: subcontractor.status,
      employees: [],
      plant: [],
      totalApprovedDockets: 0,
      totalCost: 0,
      assignedLotCount: 0,
    },
  };
}

export function buildSubcontractorsForProjectResponse(subcontractors: unknown[]) {
  return { subcontractors };
}

export function buildSubcontractorInvitationAcceptedResponse(
  subcontractor: AcceptedSubcontractorSource,
) {
  return {
    message: 'Invitation accepted successfully',
    subcontractor: {
      id: subcontractor.id,
      companyName: subcontractor.companyName,
      projectName: subcontractor.project.name,
      status: 'approved',
    },
  };
}
