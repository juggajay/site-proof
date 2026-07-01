export interface SpecificationSetOption {
  value: string;
  label: string;
}

export const AUSTROADS_SPECIFICATION_SET = 'Austroads';

const STATE_SPECIFICATION_SET_BY_STATE: Record<string, string> = {
  NSW: 'TfNSW',
  QLD: 'MRTS',
  VIC: 'VicRoads',
  SA: 'DIT',
  WA: 'MRWA',
};

const STATE_SPECIFICATION_SET_VALUES = new Set(Object.values(STATE_SPECIFICATION_SET_BY_STATE));

const SPECIFICATION_SET_OPTIONS: SpecificationSetOption[] = [
  { value: AUSTROADS_SPECIFICATION_SET, label: 'Austroads (National)' },
  { value: 'TfNSW', label: 'TfNSW (NSW)' },
  { value: 'MRTS', label: 'MRTS (QLD)' },
  { value: 'VicRoads', label: 'VicRoads (VIC)' },
  { value: 'DIT', label: 'DIT (SA)' },
  { value: 'MRWA', label: 'Main Roads WA' },
  { value: 'custom', label: 'Custom' },
];

function normalizeState(state: string | null | undefined): string {
  return state?.trim().toUpperCase() ?? '';
}

export function getStateSpecificationSet(state: string | null | undefined): string | null {
  return STATE_SPECIFICATION_SET_BY_STATE[normalizeState(state)] ?? null;
}

export function getDefaultSpecificationSetForState(state: string | null | undefined): string {
  return getStateSpecificationSet(state) ?? AUSTROADS_SPECIFICATION_SET;
}

export function getSpecificationSetForStateChange(
  nextState: string | null | undefined,
  currentSpecificationSet: string,
): string {
  if (currentSpecificationSet === AUSTROADS_SPECIFICATION_SET) {
    return AUSTROADS_SPECIFICATION_SET;
  }

  return getDefaultSpecificationSetForState(nextState);
}

export function getSpecificationSetOptionsForState(
  state: string | null | undefined,
): SpecificationSetOption[] {
  const normalizedState = normalizeState(state);
  const stateSpecificationSet = getStateSpecificationSet(normalizedState);
  return SPECIFICATION_SET_OPTIONS.filter(
    (option) =>
      !STATE_SPECIFICATION_SET_VALUES.has(option.value) || option.value === stateSpecificationSet,
  );
}
