import { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  FilterBottomSheet,
  FilterTriggerButton,
  type FilterConfig,
  type FilterValues,
} from '@/components/mobile/FilterBottomSheet';
import { formatStatusLabel } from '@/lib/statusLabels';
import type { NCR } from '../types';

function responsibleLabel(ncr: NCR): string {
  return (
    ncr.responsibleUser?.fullName ||
    ncr.responsibleUser?.email ||
    ncr.responsibleSubcontractor?.companyName ||
    'Unassigned'
  );
}

interface NCRFiltersProps {
  ncrs: NCR[];
  isMobile: boolean;
  onFilteredNcrsChange: (filtered: NCR[]) => void;
}

function NCRFiltersInner({ ncrs, isMobile, onFilteredNcrsChange }: NCRFiltersProps) {
  // URL-persisted filter state (same idiom as LotsPage), so back-navigation
  // and shared URLs keep the filtered view. `ncr` (deep link) and `create`
  // (raise-NCR modal) are reserved params on this page — never written here.
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const categoryFilter = searchParams.get('category') || '';
  const responsibleFilter = searchParams.get('responsible') || '';
  const dateFromFilter = searchParams.get('from') || '';
  const dateToFilter = searchParams.get('to') || '';
  const mobileSearchQuery = searchParams.get('search') || '';
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const updateFilters = useCallback(
    (newParams: Record<string, string>) => {
      const params = new URLSearchParams(searchParams);
      Object.entries(newParams).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  // Get unique values for filter dropdowns
  const uniqueStatuses = useMemo(() => [...new Set(ncrs.map((ncr) => ncr.status))], [ncrs]);
  const uniqueCategories = useMemo(() => [...new Set(ncrs.map((ncr) => ncr.category))], [ncrs]);
  const uniqueResponsible = useMemo(
    () => [...new Set(ncrs.map((ncr) => responsibleLabel(ncr)))],
    [ncrs],
  );

  // Apply filters to NCRs
  const filteredNcrs = useMemo(() => {
    const result = ncrs.filter((ncr) => {
      // Mobile search query filter
      if (mobileSearchQuery) {
        const query = mobileSearchQuery.toLowerCase();
        const matchesSearch =
          ncr.ncrNumber.toLowerCase().includes(query) ||
          ncr.description.toLowerCase().includes(query) ||
          ncr.category.toLowerCase().includes(query) ||
          ncr.responsibleUser?.fullName?.toLowerCase().includes(query) ||
          ncr.responsibleUser?.email?.toLowerCase().includes(query) ||
          ncr.responsibleSubcontractor?.companyName?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (statusFilter && ncr.status !== statusFilter) return false;
      if (categoryFilter && ncr.category !== categoryFilter) return false;

      if (responsibleFilter) {
        if (responsibleLabel(ncr) !== responsibleFilter) return false;
      }

      if (dateFromFilter) {
        const ncrDate = new Date(ncr.createdAt);
        const fromDate = new Date(dateFromFilter);
        if (ncrDate < fromDate) return false;
      }

      if (dateToFilter) {
        const ncrDate = new Date(ncr.createdAt);
        const toDate = new Date(dateToFilter);
        toDate.setHours(23, 59, 59, 999);
        if (ncrDate > toDate) return false;
      }

      return true;
    });

    return result;
  }, [
    ncrs,
    mobileSearchQuery,
    statusFilter,
    categoryFilter,
    responsibleFilter,
    dateFromFilter,
    dateToFilter,
  ]);

  useEffect(() => {
    onFilteredNcrsChange(filteredNcrs);
  }, [filteredNcrs, onFilteredNcrsChange]);

  // Mobile filter configuration
  const mobileFilters: FilterConfig[] = useMemo(
    () => [
      {
        type: 'select',
        id: 'status',
        label: 'Status',
        options: uniqueStatuses.map((status) => ({
          value: status,
          label: formatStatusLabel(status),
        })),
        value: statusFilter || null,
      },
      {
        type: 'select',
        id: 'category',
        label: 'Category',
        options: uniqueCategories.map((category) => ({
          value: category,
          label: category.replace(/_/g, ' '),
        })),
        value: categoryFilter || null,
      },
      {
        type: 'select',
        id: 'responsible',
        label: 'Responsible',
        options: uniqueResponsible.map((responsible) => ({
          value: responsible,
          label: responsible,
        })),
        value: responsibleFilter || null,
      },
      {
        type: 'date',
        id: 'dateRange',
        label: 'Date Range',
        value: { start: dateFromFilter || null, end: dateToFilter || null },
      },
    ],
    [
      uniqueStatuses,
      uniqueCategories,
      uniqueResponsible,
      statusFilter,
      categoryFilter,
      responsibleFilter,
      dateFromFilter,
      dateToFilter,
    ],
  );

  // Mobile filter values for bottom sheet
  const mobileFilterValues: FilterValues = useMemo(
    () => ({
      status: statusFilter || null,
      category: categoryFilter || null,
      responsible: responsibleFilter || null,
      dateRange: { start: dateFromFilter || null, end: dateToFilter || null },
    }),
    [statusFilter, categoryFilter, responsibleFilter, dateFromFilter, dateToFilter],
  );

  // Count active mobile filters
  const activeMobileFilterCount =
    (statusFilter ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (responsibleFilter ? 1 : 0) +
    (dateFromFilter || dateToFilter ? 1 : 0);

  const hasActiveFilters =
    statusFilter || categoryFilter || responsibleFilter || dateFromFilter || dateToFilter;

  const applyMobileFilterValues = useCallback(
    (values: FilterValues) => {
      const dateRange = values.dateRange as { start: string | null; end: string | null };
      updateFilters({
        status: (values.status as string) || '',
        category: (values.category as string) || '',
        responsible: (values.responsible as string) || '',
        from: dateRange?.start || '',
        to: dateRange?.end || '',
      });
    },
    [updateFilters],
  );

  // Handle mobile filter apply
  const handleMobileFilterApply = useCallback(
    (values: FilterValues) => {
      applyMobileFilterValues(values);
      setFilterSheetOpen(false);
    },
    [applyMobileFilterValues],
  );

  const clearAllFilters = useCallback(() => {
    updateFilters({ status: '', category: '', responsible: '', from: '', to: '' });
  }, [updateFilters]);

  return (
    <>
      {/* Filters - Mobile vs Desktop */}
      {isMobile ? (
        /* Mobile Filter Bar */
        <div className="bg-card rounded-lg border p-3">
          <div className="flex gap-3 items-center">
            {/* Mobile Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search NCRs..."
                value={mobileSearchQuery}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-lg bg-background text-foreground text-base focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            {/* Filter Trigger Button */}
            <FilterTriggerButton
              onClick={() => setFilterSheetOpen(true)}
              activeCount={activeMobileFilterCount}
            />
          </div>
          {/* Filter Results Summary for Mobile */}
          {(hasActiveFilters || mobileSearchQuery) && (
            <div className="mt-2 text-sm text-muted-foreground">
              Showing {filteredNcrs.length} of {ncrs.length} NCRs
            </div>
          )}
        </div>
      ) : (
        /* Desktop Filters */
        <div className="bg-card rounded-lg border p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Status Filter */}
            <div className="flex flex-col min-w-[150px]">
              <label
                htmlFor="status-filter"
                className="text-sm font-medium text-muted-foreground mb-1"
              >
                Status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => updateFilters({ status: e.target.value })}
                className="px-3 py-2 border rounded-lg bg-background text-sm"
              >
                <option value="">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex flex-col min-w-[150px]">
              <label
                htmlFor="category-filter"
                className="text-sm font-medium text-muted-foreground mb-1"
              >
                Category
              </label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(e) => updateFilters({ category: e.target.value })}
                className="px-3 py-2 border rounded-lg bg-background text-sm"
              >
                <option value="">All Categories</option>
                {uniqueCategories.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Responsible Filter */}
            <div className="flex flex-col min-w-[150px]">
              <label
                htmlFor="responsible-filter"
                className="text-sm font-medium text-muted-foreground mb-1"
              >
                Responsible
              </label>
              <select
                id="responsible-filter"
                value={responsibleFilter}
                onChange={(e) => updateFilters({ responsible: e.target.value })}
                className="px-3 py-2 border rounded-lg bg-background text-sm"
              >
                <option value="">All Responsible</option>
                {uniqueResponsible.map((responsible) => (
                  <option key={responsible} value={responsible}>
                    {responsible}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From Filter */}
            <div className="flex flex-col min-w-[150px]">
              <label
                htmlFor="date-from-filter"
                className="text-sm font-medium text-muted-foreground mb-1"
              >
                Date From
              </label>
              <input
                id="date-from-filter"
                type="date"
                value={dateFromFilter}
                onChange={(e) => updateFilters({ from: e.target.value })}
                className="px-3 py-2 border rounded-lg bg-background text-sm"
              />
            </div>

            {/* Date To Filter */}
            <div className="flex flex-col min-w-[150px]">
              <label
                htmlFor="date-to-filter"
                className="text-sm font-medium text-muted-foreground mb-1"
              >
                Date To
              </label>
              <input
                id="date-to-filter"
                type="date"
                value={dateToFilter}
                onChange={(e) => updateFilters({ to: e.target.value })}
                className="px-3 py-2 border rounded-lg bg-background text-sm"
              />
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border rounded-lg hover:bg-muted/50"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Filter Results Summary */}
          {hasActiveFilters && (
            <div className="mt-3 text-sm text-muted-foreground">
              Showing {filteredNcrs.length} of {ncrs.length} NCRs
            </div>
          )}
        </div>
      )}

      {/* Mobile Filter Bottom Sheet */}
      <FilterBottomSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filter NCRs"
        filters={mobileFilters}
        values={mobileFilterValues}
        onChange={applyMobileFilterValues}
        onApply={handleMobileFilterApply}
        onClear={clearAllFilters}
      />
    </>
  );
}

export const NCRFilters = memo(NCRFiltersInner);
