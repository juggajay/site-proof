import type { FilterConfig, FilterValues } from './FilterBottomSheet';

export function buildInitialFilterValues(
  filters: FilterConfig[],
  initialValues?: FilterValues,
): FilterValues {
  if (initialValues) return initialValues;

  return filters.reduce<FilterValues>((acc, filter) => {
    switch (filter.type) {
      case 'select':
        acc[filter.id] = filter.value;
        break;
      case 'multiselect':
        acc[filter.id] = filter.value;
        break;
      case 'range':
        acc[filter.id] = filter.value;
        break;
      case 'date':
        acc[filter.id] = filter.value;
        break;
    }
    return acc;
  }, {});
}

export function buildClearedFilterValues(filters: FilterConfig[]): FilterValues {
  return filters.reduce<FilterValues>((acc, filter) => {
    switch (filter.type) {
      case 'select':
        acc[filter.id] = null;
        break;
      case 'multiselect':
        acc[filter.id] = [];
        break;
      case 'range':
        acc[filter.id] = { min: filter.min, max: filter.max };
        break;
      case 'date':
        acc[filter.id] = { start: null, end: null };
        break;
    }
    return acc;
  }, {});
}

export function countActiveFilters(filters: FilterConfig[], values: FilterValues): number {
  return filters.reduce((count, filter) => {
    const val = values[filter.id];
    if (filter.type === 'select' && val !== null && val !== '') {
      return count + 1;
    }
    if (filter.type === 'multiselect' && Array.isArray(val) && val.length > 0) {
      return count + 1;
    }
    if (filter.type === 'range') {
      const rangeVal = val as { min: number; max: number };
      if (rangeVal && (rangeVal.min !== filter.min || rangeVal.max !== filter.max)) {
        return count + 1;
      }
    }
    if (filter.type === 'date') {
      const dateVal = val as { start: string | null; end: string | null };
      if (dateVal && (dateVal.start || dateVal.end)) {
        return count + 1;
      }
    }
    return count;
  }, 0);
}
