const WITNESS_POINT_TYPES = new Set(['witness', 'witness_point']);

export function isReleaseGatedChecklistItem(item: {
  pointType?: string | null;
  responsibleParty?: string | null;
  isHoldPoint?: boolean | null;
}): boolean {
  return (
    Boolean(item.isHoldPoint) ||
    item.pointType === 'hold_point' ||
    (item.responsibleParty === 'superintendent' && !WITNESS_POINT_TYPES.has(item.pointType ?? ''))
  );
}
