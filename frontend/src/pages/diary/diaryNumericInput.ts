import {
  parseOptionalDecimalInput,
  parseOptionalNonNegativeDecimalInput,
} from '@/lib/numericInput';

const DIARY_DAILY_HOURS_MAX = 24;
const DIARY_QUANTITY_MAX = 1_000_000_000;
const DIARY_TEMPERATURE_MIN = -80;
const DIARY_TEMPERATURE_MAX = 80;
const DIARY_RAINFALL_MAX = 2000;

export function parseOptionalDiaryQuantityInput(value: string): number | undefined | null {
  if (!value.trim()) return undefined;

  const parsed = parseOptionalNonNegativeDecimalInput(value);
  if (parsed === null || parsed > DIARY_QUANTITY_MAX) return null;
  return parsed;
}

export function getOptionalDiaryQuantityError(
  value: string,
  fieldLabel = 'Quantity',
): string | null {
  if (!value.trim()) return null;
  return parseOptionalDiaryQuantityInput(value) === null
    ? `${fieldLabel} must be a non-negative decimal number.`
    : null;
}

export function parseOptionalDiaryHoursInput(value: string): number | undefined | null {
  if (!value.trim()) return undefined;

  const parsed = parseOptionalNonNegativeDecimalInput(value);
  if (parsed === null || parsed <= 0 || parsed > DIARY_DAILY_HOURS_MAX) return null;
  return parsed;
}

export function getOptionalDiaryHoursError(value: string, fieldLabel = 'Hours'): string | null {
  if (!value.trim()) return null;
  return parseOptionalDiaryHoursInput(value) === null
    ? `${fieldLabel} must be greater than 0 and no more than ${DIARY_DAILY_HOURS_MAX}.`
    : null;
}

export function parseOptionalDiaryTemperatureInput(value: string): number | undefined | null {
  if (!value.trim()) return undefined;

  const parsed = parseOptionalDecimalInput(value);
  if (parsed === null || parsed < DIARY_TEMPERATURE_MIN || parsed > DIARY_TEMPERATURE_MAX)
    return null;
  return parsed;
}

export function getOptionalDiaryTemperatureError(value: string, fieldLabel: string): string | null {
  if (!value.trim()) return null;
  return parseOptionalDiaryTemperatureInput(value) === null
    ? `${fieldLabel} must be a decimal number between ${DIARY_TEMPERATURE_MIN} and ${DIARY_TEMPERATURE_MAX}.`
    : null;
}

export function parseOptionalDiaryRainfallInput(value: string): number | undefined | null {
  if (!value.trim()) return undefined;

  const parsed = parseOptionalNonNegativeDecimalInput(value);
  if (parsed === null || parsed > DIARY_RAINFALL_MAX) return null;
  return parsed;
}

export function getOptionalDiaryRainfallError(value: string): string | null {
  if (!value.trim()) return null;
  return parseOptionalDiaryRainfallInput(value) === null
    ? `Rainfall must be a non-negative decimal number no more than ${DIARY_RAINFALL_MAX}.`
    : null;
}

export function getDiaryWeatherNumberError(data: {
  temperatureMin: string;
  temperatureMax: string;
  rainfallMm: string;
}): string | null {
  const minError = getOptionalDiaryTemperatureError(data.temperatureMin, 'Min temp');
  if (minError) return minError;

  const maxError = getOptionalDiaryTemperatureError(data.temperatureMax, 'Max temp');
  if (maxError) return maxError;

  const rainfallError = getOptionalDiaryRainfallError(data.rainfallMm);
  if (rainfallError) return rainfallError;

  const temperatureMin = parseOptionalDiaryTemperatureInput(data.temperatureMin);
  const temperatureMax = parseOptionalDiaryTemperatureInput(data.temperatureMax);
  if (
    typeof temperatureMin === 'number' &&
    typeof temperatureMax === 'number' &&
    temperatureMin > temperatureMax
  ) {
    return 'Min temp must be less than or equal to max temp.';
  }

  return null;
}
