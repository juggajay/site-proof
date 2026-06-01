export function buildLotsBulkDeletedResponse(count: number) {
  return {
    message: `Successfully deleted ${count} lot(s)`,
    count,
  };
}

export function buildLotsBulkStatusUpdatedResponse(count: number, status: string) {
  return {
    message: `Successfully updated ${count} lot(s) to "${status.replace('_', ' ')}"`,
    count,
  };
}

export function buildLotsBulkSubcontractorAssignedResponse(
  count: number,
  subcontractorId: string | null | undefined,
) {
  const action = subcontractorId ? 'assigned' : 'unassigned';

  return {
    message: `Successfully ${action} ${count} lot(s)`,
    count,
  };
}
