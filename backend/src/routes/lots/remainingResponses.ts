export function buildLotUpdatedResponse<TLot extends { budgetAmount: unknown }>(
  updatedLot: TLot,
  canViewBudget: boolean,
) {
  return {
    lot: {
      ...updatedLot,
      budgetAmount: canViewBudget ? updatedLot.budgetAmount : null,
    },
  };
}

export function buildLegacyLotAssignmentMutationResponse<
  TLot extends { assignedSubcontractor?: { companyName?: string | null } | null },
>(subcontractorId: string | null | undefined, updatedLot: TLot) {
  return {
    message: subcontractorId
      ? `Lot assigned to ${updatedLot.assignedSubcontractor?.companyName || 'subcontractor'}`
      : 'Lot unassigned from subcontractor',
    lot: updatedLot,
    notificationsSent: subcontractorId ? true : false,
  };
}

export function buildLotRoleResponse(
  role: string,
  isQualityManager: boolean,
  canConformLots: boolean,
  canVerifyTestResults: boolean,
  canCloseNCRs: boolean,
  canManageITPTemplates: boolean,
) {
  return {
    role,
    isQualityManager,
    canConformLots,
    canVerifyTestResults,
    canCloseNCRs,
    canManageITPTemplates,
  };
}

export function buildLotReadinessResponse<TReadiness>(readiness: TReadiness) {
  return { readiness };
}
