export type CsvCell = string | number | boolean | null | undefined;

const CSV_FORMULA_PREFIX_PATTERN = /^[\t\r\n ]*[=+\-@]/;

export function escapeCsvFormulaValue(value: string): string {
  const normalizedValue = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return CSV_FORMULA_PREFIX_PATTERN.test(normalizedValue) ? `'${normalizedValue}` : normalizedValue;
}

export function formatCsvCell(value: CsvCell): string {
  const rawValue = value === null || value === undefined ? '' : String(value);
  const safeValue = escapeCsvFormulaValue(rawValue);
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  return rows.map((row) => row.map(formatCsvCell).join(',')).join('\n');
}

export type CsvBrandingContext = {
  companyName?: string | null;
  abn?: string | null;
  projectName?: string | null;
};

// Two `#`-prefixed provenance rows above the column header, mirroring the PDF
// branding band (and frontend lib/csv.ts). Each row is a single cell so a strict
// parser (pandas `comment='#'`, most CSV libs) can skip them, and commas/quotes
// in a company name stay inside one escaped field.
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
