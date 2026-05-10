import { downloadBlob } from './downloads';

export type CsvCell = string | number | boolean | null | undefined;

const CSV_FORMULA_PREFIX_PATTERN = /^[\t\r ]*[=+\-@]/;
const INVALID_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

function sanitizeFilenameChar(char: string): string {
  return INVALID_FILENAME_CHARS.has(char) || char.charCodeAt(0) < 32 ? '-' : char;
}

export function escapeCsvCell(value: CsvCell): string {
  const rawValue = value === null || value === undefined ? '' : String(value);
  const normalizedValue = rawValue.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const safeValue = CSV_FORMULA_PREFIX_PATTERN.test(normalizedValue)
    ? `'${normalizedValue}`
    : normalizedValue;

  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function sanitizeCsvFilename(filename: string): string {
  const sanitized = Array.from(filename)
    .map(sanitizeFilenameChar)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  const fallback = sanitized || 'export.csv';
  return fallback.toLowerCase().endsWith('.csv') ? fallback : `${fallback}.csv`;
}

export function downloadCsv(filename: string, rows: ReadonlyArray<ReadonlyArray<CsvCell>>): void {
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, sanitizeCsvFilename(filename), 'export.csv');
}
