export function buildLotListEnvelope(lots: unknown[], pagination: unknown) {
  return {
    data: lots,
    pagination,
    // Backward compatibility - keep 'lots' alias during transition
    lots,
  };
}

export function buildLotDetailEnvelope(lot: unknown) {
  return { lot };
}

export function buildLotCreatedResponse(lot: unknown) {
  return { lot };
}

export function buildLotsCreatedResponse(lots: unknown[]) {
  return {
    message: `Successfully created ${lots.length} lots`,
    lots,
    count: lots.length,
  };
}

export function buildLotClonedResponse(lot: unknown, sourceLotId: string, sourceLotNumber: string) {
  return {
    lot,
    sourceLotId,
    message: `Lot cloned from ${sourceLotNumber}`,
  };
}

export function buildLotDeletedResponse() {
  return { message: 'Lot deleted successfully' };
}

export function buildSuggestedLotNumberResponse(
  suggestedNumber: string,
  prefix: string,
  nextNumber: number,
  startingNumber: number,
) {
  return {
    suggestedNumber,
    prefix,
    nextNumber,
    startingNumber,
  };
}
