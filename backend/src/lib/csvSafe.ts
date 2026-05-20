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
