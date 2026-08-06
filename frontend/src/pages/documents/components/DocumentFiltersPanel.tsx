import { useId, useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  FilterBottomSheet,
  FilterTriggerButton,
  type FilterConfig,
  type FilterValues,
} from '@/components/mobile/FilterBottomSheet';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { CATEGORIES, DOCUMENT_TYPES } from '../documentsUploadData';
import { DocumentCategorySummary } from './DocumentsPageChrome';

// Minimal structural shape the lot filter needs. The page's full `Lot` is
// assignable to this, so the page can pass its lots directly.
interface DocumentFilterLot {
  id: string;
  lotNumber: string;
}

interface DocumentFiltersPanelProps {
  filterType: string;
  filterCategory: string;
  filterLot: string;
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
  showFavouritesOnly: boolean;
  lots: DocumentFilterLot[];
  /** Category → count for the quick-filter chips, from the documents response. */
  categories: Record<string, number>;
  onFilterTypeChange: (value: string) => void;
  onFilterCategoryChange: (value: string) => void;
  onFilterLotChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onShowFavouritesOnlyChange: (value: boolean) => void;
  onTriggerSearch: () => void;
  onClearAll: () => void;
}

const FAVOURITES_FILTER_VALUE = 'favourites';

/**
 * Count of applied filters, EXCLUDING search — search stays visible inline on
 * mobile, so counting it on the sheet's badge would point at a control the
 * sheet does not contain.
 */
function countAppliedFilters({
  filterType,
  filterCategory,
  filterLot,
  dateFrom,
  dateTo,
  showFavouritesOnly,
}: Pick<
  DocumentFiltersPanelProps,
  'filterType' | 'filterCategory' | 'filterLot' | 'dateFrom' | 'dateTo' | 'showFavouritesOnly'
>): number {
  return (
    (filterType ? 1 : 0) +
    (filterCategory ? 1 : 0) +
    (filterLot ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (showFavouritesOnly ? 1 : 0)
  );
}

/**
 * Filters that live behind desktop's "More filters" disclosure. Category is not
 * one of them — the count chips ARE the category filter, so counting it here
 * would badge the disclosure for a control it does not contain.
 */
function countAdvancedFilters({
  filterType,
  filterLot,
  dateFrom,
  dateTo,
}: Pick<DocumentFiltersPanelProps, 'filterType' | 'filterLot' | 'dateFrom' | 'dateTo'>): number {
  return (filterType ? 1 : 0) + (filterLot ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);
}

/** Search stays inline on every breakpoint; only the height changes. */
function DocumentSearchField({
  searchQuery,
  onSearchQueryChange,
  onTriggerSearch,
  className,
}: Pick<DocumentFiltersPanelProps, 'searchQuery' | 'onSearchQueryChange' | 'onTriggerSearch'> & {
  className?: string;
}) {
  return (
    // A real form so the phone keyboard offers a "Search" key.
    <form
      role="search"
      className="relative min-w-[220px] flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        onTriggerSearch();
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id="document-search"
        type="search"
        className={className}
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
        placeholder="Search documents..."
        aria-label="Search documents by filename or caption"
      />
    </form>
  );
}

function FavouritesButton({
  showFavouritesOnly,
  onShowFavouritesOnlyChange,
}: Pick<DocumentFiltersPanelProps, 'showFavouritesOnly' | 'onShowFavouritesOnlyChange'>) {
  return (
    <Button
      variant={showFavouritesOnly ? 'outline' : 'secondary'}
      onClick={() => onShowFavouritesOnlyChange(!showFavouritesOnly)}
      className={showFavouritesOnly ? 'bg-muted text-foreground border-border' : ''}
      title={showFavouritesOnly ? 'Show All' : 'Show Favourites Only'}
    >
      <svg
        className={`h-4 w-4 ${showFavouritesOnly ? 'fill-foreground' : ''}`}
        fill={showFavouritesOnly ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
      Favourites
    </Button>
  );
}

/**
 * Phone layout: search stays inline (it is the filter people actually reach
 * for) and everything else collapses behind one Filters button. The stacked
 * seven-control card this replaces filled the whole viewport, so a phone user
 * scrolled past the entire filter set before seeing a single document.
 */
function MobileDocumentFilters(props: DocumentFiltersPanelProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const {
    filterType,
    filterCategory,
    filterLot,
    dateFrom,
    dateTo,
    searchQuery,
    showFavouritesOnly,
    lots,
    onFilterTypeChange,
    onFilterCategoryChange,
    onFilterLotChange,
    onDateFromChange,
    onDateToChange,
    onSearchQueryChange,
    onShowFavouritesOnlyChange,
    onTriggerSearch,
    onClearAll,
  } = props;

  const filters: FilterConfig[] = [
    {
      type: 'select',
      id: 'documentType',
      label: 'Document Type',
      options: DOCUMENT_TYPES.map((type) => ({ value: type.id, label: type.label })),
      value: filterType || null,
    },
    {
      type: 'select',
      id: 'category',
      label: 'Category',
      options: [
        { value: 'uncategorized', label: 'Uncategorized' },
        ...CATEGORIES.map((category) => ({ value: category.id, label: category.label })),
      ],
      value: filterCategory || null,
    },
    {
      type: 'select',
      id: 'lot',
      label: 'Lot',
      options: lots.map((lot) => ({ value: lot.id, label: lot.lotNumber })),
      value: filterLot || null,
    },
    {
      type: 'date',
      id: 'dateRange',
      label: 'Uploaded',
      value: { start: dateFrom || null, end: dateTo || null },
    },
    {
      type: 'select',
      id: 'favourites',
      label: 'Favourites',
      options: [{ value: FAVOURITES_FILTER_VALUE, label: 'Favourites only' }],
      value: showFavouritesOnly ? FAVOURITES_FILTER_VALUE : null,
    },
  ];

  const values: FilterValues = {
    documentType: filterType || null,
    category: filterCategory || null,
    lot: filterLot || null,
    dateRange: { start: dateFrom || null, end: dateTo || null },
    favourites: showFavouritesOnly ? FAVOURITES_FILTER_VALUE : null,
  };

  // Applied as they change (the register behind the sheet updates live), the
  // same way the NCR register's sheet behaves.
  const applyValues = (next: FilterValues) => {
    const dateRange = next.dateRange as { start: string | null; end: string | null } | undefined;
    onFilterTypeChange((next.documentType as string) || '');
    onFilterCategoryChange((next.category as string) || '');
    onFilterLotChange((next.lot as string) || '');
    onDateFromChange(dateRange?.start || '');
    onDateToChange(dateRange?.end || '');
    onShowFavouritesOnlyChange(next.favourites === FAVOURITES_FILTER_VALUE);
  };

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3">
        <DocumentSearchField
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          onTriggerSearch={onTriggerSearch}
          className="h-12 pl-9"
        />
        <FilterTriggerButton
          onClick={() => setSheetOpen(true)}
          activeCount={countAppliedFilters(props)}
        />
      </div>

      <FilterBottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter documents"
        filters={filters}
        values={values}
        onChange={applyValues}
        onApply={(next) => {
          applyValues(next);
          setSheetOpen(false);
        }}
        onClear={onClearAll}
      />
    </div>
  );
}

// Extracted from DocumentsPage: the document filter/search/favourites bar.
// Filter state, committed-search state, query-path construction, and data
// fetching stay in the page; this component is prop-driven and
// presentation-only.
export function DocumentFiltersPanel(props: DocumentFiltersPanelProps) {
  const isMobile = useIsMobile();
  const advancedPanelId = useId();
  const advancedCount = countAdvancedFilters(props);
  // Open when the register arrives with one of these already applied (a `lotId`
  // deep link, say) — a badge counting filters you cannot see is a puzzle.
  const [showAdvanced, setShowAdvanced] = useState(() => advancedCount > 0);
  const {
    filterType,
    filterCategory,
    filterLot,
    dateFrom,
    dateTo,
    searchQuery,
    showFavouritesOnly,
    lots,
    categories,
    onFilterTypeChange,
    onFilterCategoryChange,
    onFilterLotChange,
    onDateFromChange,
    onDateToChange,
    onSearchQueryChange,
    onShowFavouritesOnlyChange,
    onTriggerSearch,
    onClearAll,
  } = props;

  if (isMobile) {
    return <MobileDocumentFilters {...props} />;
  }

  return (
    <div className="rounded-lg border bg-card p-4" data-testid="document-filters">
      <div className="flex flex-wrap items-center gap-2">
        <DocumentSearchField
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          onTriggerSearch={onTriggerSearch}
          className="pl-9"
        />
        <Button variant="secondary" onClick={onTriggerSearch}>
          Search
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-expanded={showAdvanced}
          aria-controls={advancedPanelId}
          // Same phrasing as the phone filter trigger, so the count is spoken
          // rather than run into the label as "More filters1".
          aria-label={`More filters${advancedCount > 0 ? `, ${advancedCount} active` : ''}`}
          onClick={() => setShowAdvanced((open) => !open)}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          More filters
          {advancedCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {advancedCount}
            </span>
          )}
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')}
            aria-hidden="true"
          />
        </Button>
        <FavouritesButton
          showFavouritesOnly={showFavouritesOnly}
          onShowFavouritesOnlyChange={onShowFavouritesOnlyChange}
        />
        {(filterType ||
          filterCategory ||
          filterLot ||
          dateFrom ||
          dateTo ||
          searchQuery ||
          showFavouritesOnly) && (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Clear All
          </Button>
        )}
      </div>

      {/* The quick filter. These chips ARE the category control — the Category
          select they replaced said the same thing one row up, and two filter
          systems stacked cost ~250px of chrome before the first document. */}
      {Object.keys(categories).length > 0 && (
        <div className="mt-3">
          <DocumentCategorySummary
            categories={categories}
            activeCategory={filterCategory}
            onSelectCategory={onFilterCategoryChange}
          />
        </div>
      )}

      {/* Everything people filter by occasionally. Collapsed by default so the
          register starts with rows, not controls. */}
      {showAdvanced && (
        <div id={advancedPanelId} className="mt-3 flex flex-wrap items-end gap-4 border-t pt-3">
          <div>
            <Label htmlFor="document-type-filter" className="mb-1">
              Document Type
            </Label>
            <NativeSelect
              id="document-type-filter"
              value={filterType}
              onChange={(e) => onFilterTypeChange(e.target.value)}
            >
              <option value="">All Types</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="document-lot-filter" className="mb-1">
              Lot
            </Label>
            <NativeSelect
              id="document-lot-filter"
              value={filterLot}
              onChange={(e) => onFilterLotChange(e.target.value)}
            >
              <option value="">All Lots</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="document-date-from-filter" className="mb-1">
              Date From
            </Label>
            <Input
              id="document-date-from-filter"
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="document-date-to-filter" className="mb-1">
              Date To
            </Label>
            <Input
              id="document-date-to-filter"
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
