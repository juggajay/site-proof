const DECIMAL_INPUT_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const SIGNED_DECIMAL_INPUT_PATTERN = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const INTEGER_INPUT_PATTERN = /^\d+$/;

export function parseOptionalNonNegativeDecimalInput(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!DECIMAL_INPUT_PATTERN.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseOptionalDecimalInput(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!SIGNED_DECIMAL_INPUT_PATTERN.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isOptionalNonNegativeDecimalInput(value: string): boolean {
  return !value.trim() || parseOptionalNonNegativeDecimalInput(value) !== null;
}

export function parsePositiveIntegerInput(value: string): number | null {
  const normalized = value.trim();
  if (!INTEGER_INPUT_PATTERN.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}
