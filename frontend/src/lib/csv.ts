import { downloadBlob } from './downloads';
import { formatDateKey } from './localDate';

export type CsvCell = string | number | boolean | null | undefined;

const CSV_FORMULA_PREFIX_PATTERN = /^[\t\r\n ]*[=+\-@]/;
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

export function slugifyCsvFilenamePart(
  value: string | null | undefined,
  fallback = 'export',
): string {
  const slug = (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || fallback;
}

export function buildScopedCsvFilename(
  prefix: string,
  scope: string | null | undefined,
  date = new Date(),
): string {
  const datePart = formatDateKey(date);
  return sanitizeCsvFilename(
    `${slugifyCsvFilenamePart(prefix)}-${slugifyCsvFilenamePart(scope, 'project')}-${datePart}.csv`,
  );
}

export function downloadCsv(filename: string, rows: ReadonlyArray<ReadonlyArray<CsvCell>>): void {
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, sanitizeCsvFilename(filename), 'export.csv');
}

export type CsvBrandingContext = {
  companyName?: string | null;
  abn?: string | null;
  projectName?: string | null;
};

// Two `#`-prefixed provenance rows placed above the column header, mirroring the
// PDF branding band. Each row is a single cell so a strict/ragged-aware parser
// (pandas `comment='#'`, most CSV libs) can skip them, and any commas/quotes in
// a company name stay safely inside one escaped field. Row 1: company (+ ABN) —
// project. Row 2: Generated <ISO date> — <register> — CIVOS.
export function buildCsvBrandingRows(
  registerName: string,
  branding: CsvBrandingContext | null | undefined,
  date: Date = new Date(),
): CsvCell[][] {
  const company = branding?.companyName?.trim();
  const abn = branding?.abn?.trim();
  const project = branding?.projectName?.trim();
  const companyPart = company ? (abn ? `${company} (ABN ${abn})` : company) : '';
  const line1 = [companyPart, project].filter(Boolean).join('  —  ') || 'CIVOS';
  const isoDate = date.toISOString().slice(0, 10);
  return [[`# ${line1}`], [`# Generated ${isoDate} — ${registerName} — CIVOS`]];
}

// downloadCsv with the two-row branding preamble prepended. `rows` is the usual
// [header, ...dataRows]; branding is best-effort (an unbranded export beats a
// failed one), so a null/empty context still emits a consistent CIVOS preamble.
export function downloadBrandedCsv(
  filename: string,
  registerName: string,
  branding: CsvBrandingContext | null | undefined,
  rows: ReadonlyArray<ReadonlyArray<CsvCell>>,
): void {
  downloadCsv(filename, [...buildCsvBrandingRows(registerName, branding), ...rows]);
}
