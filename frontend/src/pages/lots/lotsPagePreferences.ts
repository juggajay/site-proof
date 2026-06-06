import { parseJsonPreference } from '@/lib/storagePreferences';
import { DEFAULT_COLUMN_ORDER, type ColumnId } from './components/lotFilterConfig';

const VALID_COLUMN_IDS = new Set<ColumnId>(DEFAULT_COLUMN_ORDER);

function getValidColumnIds(value: unknown): ColumnId[] | null {
  if (!Array.isArray(value)) return null;

  const columns = value.filter(
    (item): item is ColumnId => typeof item === 'string' && VALID_COLUMN_IDS.has(item as ColumnId),
  );

  return Array.from(new Set(columns));
}

export function parseColumnPreference(raw: string | null): ColumnId[] {
  return parseJsonPreference(raw, DEFAULT_COLUMN_ORDER, (value) => {
    const columns = getValidColumnIds(value);
    if (!columns) return null;
    return columns.includes('lotNumber') ? columns : ['lotNumber', ...columns];
  });
}

export function parseColumnOrderPreference(raw: string | null): ColumnId[] {
  return parseJsonPreference(raw, DEFAULT_COLUMN_ORDER, (value) => {
    const columns = getValidColumnIds(value);
    if (!columns) return null;

    const withoutRequiredColumn = columns.filter((column) => column !== 'lotNumber');
    const orderedColumns = ['lotNumber', ...withoutRequiredColumn] as ColumnId[];
    const missingColumns = DEFAULT_COLUMN_ORDER.filter(
      (column) => !orderedColumns.includes(column),
    );
    return [...orderedColumns, ...missingColumns];
  });
}
