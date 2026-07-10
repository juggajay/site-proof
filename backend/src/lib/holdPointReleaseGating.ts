const WITNESS_POINT_TYPES = new Set(['witness', 'witness_point']);

export function isWitnessChecklistItem(item: { pointType?: string | null }): boolean {
  return WITNESS_POINT_TYPES.has(item.pointType ?? '');
}

export function isReleaseGatedChecklistItem(item: {
  pointType?: string | null;
  responsibleParty?: string | null;
}): boolean {
  return (
    item.pointType === 'hold_point' ||
    (item.responsibleParty === 'superintendent' && !WITNESS_POINT_TYPES.has(item.pointType ?? ''))
  );
}
