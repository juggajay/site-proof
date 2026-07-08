import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  type: 'error' | 'warning';
}

export interface ParsedLot {
  row: number;
  lotNumber: string;
  description: string;
  chainageStart: string;
  chainageEnd: string;
  activityType: string;
  status: string;
}

export interface ValidationResult {
  lots: ParsedLot[];
  errors: ValidationError[];
  warnings: ValidationError[];
  isValid: boolean;
}

export function parseChainageInput(value: string): number | null {
  return parseOptionalNonNegativeDecimalInput(value);
}

export function parseLotsCsv(content: string): ParsedLot[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return []; // Need header + at least one row

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const lots: ParsedLot[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    const lot: ParsedLot = {
      row: i + 1, // 1-indexed for user display
      lotNumber: getFieldValue(headers, values, ['lot_number', 'lotnumber', 'lot number', 'lot']),
      description: getFieldValue(headers, values, ['description', 'desc']),
      chainageStart: getFieldValue(headers, values, [
        'chainage_start',
        'chainagestart',
        'start_chainage',
        'start',
      ]),
      chainageEnd: getFieldValue(headers, values, [
        'chainage_end',
        'chainageend',
        'end_chainage',
        'end',
      ]),
      activityType: getFieldValue(headers, values, [
        'activity_type',
        'activitytype',
        'activity',
        'type',
      ]),
      status: getFieldValue(headers, values, ['status']),
    };
    lots.push(lot);
  }

  return lots;
}

// Parse a single CSV line, handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Get field value by trying multiple possible column names
function getFieldValue(headers: string[], values: string[], possibleNames: string[]): string {
  for (const name of possibleNames) {
    const index = headers.indexOf(name);
    if (index !== -1 && index < values.length) {
      return values[index].replace(/^["']|["']$/g, '');
    }
  }
  return '';
}

export function validateLots(lots: ParsedLot[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const lotNumbers = new Set<string>();

  for (const lot of lots) {
    // Required field validation - ERRORS
    if (!lot.lotNumber.trim()) {
      errors.push({
        row: lot.row,
        field: 'Lot Number',
        message: 'Lot Number is required',
        type: 'error',
      });
    } else if (lot.lotNumber.length < 3) {
      errors.push({
        row: lot.row,
        field: 'Lot Number',
        message: 'Lot Number must be at least 3 characters',
        type: 'error',
      });
    } else if (lot.lotNumber.length > 50) {
      errors.push({
        row: lot.row,
        field: 'Lot Number',
        message: 'Lot Number must be at most 50 characters',
        type: 'error',
      });
    } else if (lotNumbers.has(lot.lotNumber.toLowerCase())) {
      errors.push({
        row: lot.row,
        field: 'Lot Number',
        message: `Duplicate lot number "${lot.lotNumber}" in file`,
        type: 'error',
      });
    } else {
      lotNumbers.add(lot.lotNumber.toLowerCase());
    }

    // Chainage validation
    const start = parseChainageInput(lot.chainageStart);
    const end = parseChainageInput(lot.chainageEnd);
    if (lot.chainageStart.trim() && start === null) {
      errors.push({
        row: lot.row,
        field: 'Chainage Start',
        message: 'Invalid chainage start value (must be a number)',
        type: 'error',
      });
    }
    if (lot.chainageEnd.trim() && end === null) {
      errors.push({
        row: lot.row,
        field: 'Chainage End',
        message: 'Invalid chainage end value (must be a number)',
        type: 'error',
      });
    }
    if (start !== null && end !== null && end <= start) {
      errors.push({
        row: lot.row,
        field: 'Chainage',
        message: 'End chainage must be greater than start chainage',
        type: 'error',
      });
    }

    // WARNINGS - non-blocking issues
    if (!lot.description.trim()) {
      warnings.push({
        row: lot.row,
        field: 'Description',
        message: 'Description is empty - lot will be created without description',
        type: 'warning',
      });
    }

    if (!lot.activityType.trim()) {
      warnings.push({
        row: lot.row,
        field: 'Activity Type',
        message: 'Activity Type is empty - will default to "Earthworks"',
        type: 'warning',
      });
    }

    const validActivityTypes = [
      'Earthworks',
      'Pavement',
      'Drainage',
      'Concrete',
      'Structures',
      'Rail',
    ];
    if (
      lot.activityType &&
      !validActivityTypes.some((t) => t.toLowerCase() === lot.activityType.toLowerCase())
    ) {
      warnings.push({
        row: lot.row,
        field: 'Activity Type',
        message: `Unknown activity type "${lot.activityType}" - will default to "Earthworks"`,
        type: 'warning',
      });
    }
  }

  return {
    lots,
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}
