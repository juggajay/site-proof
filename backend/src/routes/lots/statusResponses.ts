export function buildLotConformedResponse<TLot>(lot: TLot) {
  return {
    message: 'Lot conformed successfully',
    lot,
  };
}

export function buildLotStatusOverrideResponse<TLot>(
  lot: TLot,
  previousStatus: string,
  reason: string,
) {
  return {
    message: 'Status overridden successfully',
    lot,
    previousStatus,
    reason: reason.trim(),
  };
}
