type DeletedCounts = {
  dockets: number;
  employees: number;
  plant: number;
};

export function buildSubcontractorStatusUpdatedResponse(subcontractor: unknown, status: string) {
  return {
    message: `Subcontractor status updated to ${status}`,
    subcontractor,
  };
}

export function buildSubcontractorDeletedResponse(
  companyName: string,
  deletedCounts: DeletedCounts,
) {
  return {
    message: `Subcontractor ${companyName} permanently deleted`,
    deletedCounts,
  };
}

export function buildSubcontractorPortalAccessUpdatedResponse(portalAccess: unknown) {
  return {
    message: 'Portal access updated successfully',
    portalAccess,
  };
}

export function buildSubcontractorPortalAccessResponse(portalAccess: unknown) {
  return { portalAccess };
}
