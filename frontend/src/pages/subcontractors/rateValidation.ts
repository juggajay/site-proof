const RATE_MAX_VALUE = 100000;
const RATE_INPUT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

type ParseRateInputOptions = {
  required?: boolean;
  allowZero?: boolean;
};

export function parseRateInput(value: string, options: ParseRateInputOptions = {}): number | null {
  const required = options.required ?? true;
  const allowZero = options.allowZero ?? false;
  const normalized = value.trim();

  if (!normalized) {
    return required ? null : 0;
  }

  if (!RATE_INPUT_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < 0 || (!allowZero && parsed === 0) || parsed > RATE_MAX_VALUE) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}
