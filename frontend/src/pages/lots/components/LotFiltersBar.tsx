import React, { useState } from 'react';
import { LayoutGrid, LayoutList, Map as MapIcon, MapPin } from 'lucide-react';
import {
  FilterBottomSheet,
  FilterTriggerButton,
  type FilterValues,
} from '@/components/mobile/FilterBottomSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { readLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';
import { LotColumnSettingsMenu } from './LotColumnSettingsMenu';
import { LotSavedFiltersMenu } from './LotSavedFiltersMenu';
import { LotStatusFilterMenu } from './LotStatusFilterMenu';
import { SAVED_FILTERS_STORAGE_KEY, type ColumnId, type SavedFilter } from './lotFilterConfig';
import {
  buildMobileLotFilterConfigs,
  countActiveLotFilters,
  createSavedFilterSnapshot,
  parseSavedFiltersPreference,
} from './lotFiltersBarHelpers';

interface ClearFilterButtonProps {
  onClick: () => void;
  title: string;
  ariaLabel: string;
}

function ClearFilterButton({ onClick, title, ariaLabel }: ClearFilterButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="ml-1 h-7 w-7 text-muted-foreground hover:text-foreground"
      title={title}
      aria-label={ariaLabel}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </Button>
  );
}

interface LotFiltersBarProps {
  isMobile: boolean;
  isSubcontractor: boolean;
  canViewBudgets: boolean;
  // Filter values from URL
  statusFilters: string[];
  activityFilter: string;
  searchQuery: string;
  chainageMinFilter: string;
  chainageMaxFilter: string;
  subcontractorFilter: string;
  areaZoneFilter: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  // Data for filter dropdowns
  activityTypes: (string | null | undefined)[];
  areaZones: string[];
  subcontractors: { id: string; companyName: string }[];
  // Counts
  totalLots: number;
  filteredLotsCount: number;
  // View mode
  viewMode: 'list' | 'card' | 'linear' | 'map';
  onToggleViewMode: (mode: 'list' | 'card' | 'linear' | 'map') => void;
  // Update filters
  onUpdateFilters: (params: Record<string, string>) => void;
  // Column config
  visibleColumns: ColumnId[];
  onSetVisibleColumns: React.Dispatch<React.SetStateAction<ColumnId[]>>;
  columnOrder: ColumnId[];
  onSetColumnOrder: React.Dispatch<React.SetStateAction<ColumnId[]>>;
}

export const LotFiltersBar = React.memo(function LotFiltersBar({
  isMobile,
  isSubcontractor,
  canViewBudgets,
  statusFilters,
  activityFilter,
  searchQuery,
  chainageMinFilter,
  chainageMaxFilter,
  subcontractorFilter,
  areaZoneFilter,
  activityTypes,
  areaZones,
  subcontractors,
  totalLots,
  filteredLotsCount,
  viewMode,
  onToggleViewMode,
  onUpdateFilters,
  visibleColumns,
  onSetVisibleColumns,
  columnOrder,
  onSetColumnOrder,
}: LotFiltersBarProps) {
  // Saved filters state
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    return parseSavedFiltersPreference(readLocalStorageItem(SAVED_FILTERS_STORAGE_KEY));
  });

  // Mobile filter bottom sheet state
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [mobileFilterValues, setMobileFilterValues] = useState<FilterValues>({
    status: statusFilters,
    activity: activityFilter || null,
    subcontractor: subcontractorFilter || null,
    areaZone: areaZoneFilter || null,
  });

  const activeFilterCount = countActiveLotFilters({
    statusFilters,
    activityFilter,
    searchQuery,
    chainageMinFilter,
    chainageMaxFilter,
    subcontractorFilter,
    areaZoneFilter,
  });

  const mobileFilters = buildMobileLotFilterConfigs({
    statusFilters,
    activityFilter,
    activityTypes,
    isSubcontractor,
    subcontractors,
    subcontractorFilter,
    areaZones,
    areaZoneFilter,
  });

  const handleSearch = (query: string) => {
    onUpdateFilters({ search: query });
  };

  const handleActivityFilter = (activity: string) => {
    onUpdateFilters({ activity });
  };

  const handleSubcontractorFilter = (subcontractor: string) => {
    onUpdateFilters({ subcontractor });
  };

  const handleAreaZoneFilter = (areaZone: string) => {
    onUpdateFilters({ areaZone });
  };

  // Save filter to local storage
  const saveCurrentFilter = (filterName: string) => {
    if (!filterName.trim()) return;

    const newFilter = createSavedFilterSnapshot({
      name: filterName,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      statusFilters,
      activityFilter,
      searchQuery,
      subcontractorFilter,
      areaZoneFilter,
    });
    if (!newFilter) return;

    const updatedFilters = [...savedFilters, newFilter];
    setSavedFilters(updatedFilters);
    writeLocalStorageItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(updatedFilters));
  };

  // Load a saved filter
  const loadSavedFilter = (filter: SavedFilter) => {
    onUpdateFilters({
      status: filter.status,
      activity: filter.activity,
      search: filter.search,
      subcontractor: filter.subcontractor || '',
      areaZone: filter.areaZone || '',
    });
  };

  // Delete a saved filter
  const deleteSavedFilter = (filterId: string) => {
    const updatedFilters = savedFilters.filter((f) => f.id !== filterId);
    setSavedFilters(updatedFilters);
    writeLocalStorageItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(updatedFilters));
  };

  if (isMobile) {
    return (
      <>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              id="search-input-mobile"
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search lots..."
              className="py-3 text-base"
            />
          </div>
          <FilterTriggerButton
            onClick={() => setFilterSheetOpen(true)}
            activeCount={activeFilterCount}
          />
        </div>

        {/* Mobile Filter Bottom Sheet */}
        <FilterBottomSheet
          isOpen={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          title="Filter Lots"
          filters={mobileFilters}
          values={mobileFilterValues}
          onChange={(values) => setMobileFilterValues(values)}
          onApply={(values) => {
            onUpdateFilters({
              status: ((values.status as string[]) || []).join(','),
              activity: (values.activity as string) || '',
              subcontractor: (values.subcontractor as string) || '',
              areaZone: (values.areaZone as string) || '',
            });
            setFilterSheetOpen(false);
          }}
          onClear={() => {
            setMobileFilterValues({
              status: [],
              activity: null,
              subcontractor: null,
              areaZone: null,
            });
            onUpdateFilters({ status: '', activity: '', subcontractor: '', areaZone: '' });
          }}
        />
      </>
    );
  }

  return (
    <>
      {/* Desktop: Full filter layout */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Filter label with badge count */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Filters:</span>
          {activeFilterCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground"
              data-testid="filter-badge"
              title={`${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}`}
            >
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="search-input">Search:</Label>
          <div className="flex items-center">
            <Input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Lot # or description..."
              className="h-8 w-48"
            />
            {searchQuery && (
              <ClearFilterButton
                onClick={() => handleSearch('')}
                title="Clear search"
                ariaLabel="Clear search"
              />
            )}
          </div>
        </div>
        <LotStatusFilterMenu statusFilters={statusFilters} onUpdateFilters={onUpdateFilters} />
        <div className="flex items-center gap-2">
          <Label htmlFor="activity-filter">Activity:</Label>
          <div className="flex items-center">
            <NativeSelect
              id="activity-filter"
              value={activityFilter}
              onChange={(e) => handleActivityFilter(e.target.value)}
              className="h-8"
            >
              <option value="">All Activities</option>
              {activityTypes.map((type) => (
                <option key={type} value={type as string}>
                  {(type as string).charAt(0).toUpperCase() + (type as string).slice(1)}
                </option>
              ))}
            </NativeSelect>
            {activityFilter && (
              <ClearFilterButton
                onClick={() => handleActivityFilter('')}
                title="Clear activity filter"
                ariaLabel="Clear activity filter"
              />
            )}
          </div>
        </div>
        {/* Chainage Range Filter */}
        <div className="flex items-center gap-2">
          <Label>Chainage:</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={chainageMinFilter}
              onChange={(e) => onUpdateFilters({ chMin: e.target.value })}
              placeholder="Min"
              className="h-8 w-20"
              aria-label="Minimum chainage"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              value={chainageMaxFilter}
              onChange={(e) => onUpdateFilters({ chMax: e.target.value })}
              placeholder="Max"
              className="h-8 w-20"
              aria-label="Maximum chainage"
            />
            {(chainageMinFilter || chainageMaxFilter) && (
              <ClearFilterButton
                onClick={() => onUpdateFilters({ chMin: '', chMax: '' })}
                title="Clear chainage filter"
                ariaLabel="Clear chainage filter"
              />
            )}
          </div>
        </div>
        {/* Subcontractor Filter */}
        {!isSubcontractor && subcontractors.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="subcontractor-filter">Subcontractor:</Label>
            <div className="flex items-center">
              <NativeSelect
                id="subcontractor-filter"
                value={subcontractorFilter}
                onChange={(e) => handleSubcontractorFilter(e.target.value)}
                className="h-8"
              >
                <option value="">All Subcontractors</option>
                <option value="unassigned">Unassigned</option>
                {subcontractors.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.companyName}
                  </option>
                ))}
              </NativeSelect>
              {subcontractorFilter && (
                <ClearFilterButton
                  onClick={() => handleSubcontractorFilter('')}
                  title="Clear subcontractor filter"
                  ariaLabel="Clear subcontractor filter"
                />
              )}
            </div>
          </div>
        )}
        {/* Area/Zone Filter */}
        {areaZones.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="area-zone-filter">Area/Zone:</Label>
            <div className="flex items-center">
              <NativeSelect
                id="area-zone-filter"
                value={areaZoneFilter}
                onChange={(e) => handleAreaZoneFilter(e.target.value)}
                className="h-8"
              >
                <option value="">All Areas</option>
                <option value="unassigned">Unassigned</option>
                {areaZones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </NativeSelect>
              {areaZoneFilter && (
                <ClearFilterButton
                  onClick={() => handleAreaZoneFilter('')}
                  title="Clear area/zone filter"
                  ariaLabel="Clear area/zone filter"
                />
              )}
            </div>
          </div>
        )}
        {(statusFilters.length > 0 ||
          activityFilter ||
          searchQuery ||
          chainageMinFilter ||
          chainageMaxFilter ||
          subcontractorFilter ||
          areaZoneFilter) && (
          <>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                onUpdateFilters({
                  status: '',
                  activity: '',
                  search: '',
                  chMin: '',
                  chMax: '',
                  subcontractor: '',
                  areaZone: '',
                });
              }}
            >
              Clear All Filters
            </Button>
          </>
        )}

        <LotSavedFiltersMenu
          hasActiveFilters={activeFilterCount > 0}
          savedFilters={savedFilters}
          statusFilters={statusFilters}
          activityFilter={activityFilter}
          searchQuery={searchQuery}
          onSaveFilter={saveCurrentFilter}
          onLoadSavedFilter={loadSavedFilter}
          onDeleteSavedFilter={deleteSavedFilter}
        />

        <span className="text-sm text-muted-foreground">
          Showing {filteredLotsCount} of {totalLots} lots
        </span>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
          <button
            onClick={() => onToggleViewMode('list')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-muted'}`}
            title="List view"
            data-testid="view-toggle-list"
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            onClick={() => onToggleViewMode('card')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'card' ? 'bg-background shadow-sm' : 'hover:bg-muted'}`}
            title="Card view"
            data-testid="view-toggle-card"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          {/* Feature #151 - Linear Map View */}
          <button
            onClick={() => onToggleViewMode('linear')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'linear' ? 'bg-background shadow-sm' : 'hover:bg-muted'}`}
            title="Linear map view"
            data-testid="view-toggle-linear"
          >
            <MapPin className="h-4 w-4" />
          </button>
          {/* Phase 2 - Satellite Basemap Map View */}
          <button
            onClick={() => onToggleViewMode('map')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'map' ? 'bg-background shadow-sm' : 'hover:bg-muted'}`}
            title="Satellite map view"
            data-testid="view-toggle-map"
          >
            <MapIcon className="h-4 w-4" />
          </button>
        </div>

        <LotColumnSettingsMenu
          isSubcontractor={isSubcontractor}
          canViewBudgets={canViewBudgets}
          visibleColumns={visibleColumns}
          onSetVisibleColumns={onSetVisibleColumns}
          columnOrder={columnOrder}
          onSetColumnOrder={onSetColumnOrder}
        />
      </div>
    </>
  );
});
