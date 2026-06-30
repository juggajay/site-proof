import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { CATEGORIES, DOCUMENT_TYPES } from '../documentsUploadData';

// Minimal structural shape the lot filter needs. The page's full `Lot` is
// assignable to this, so the page can pass its lots directly.
interface DocumentFilterLot {
  id: string;
  lotNumber: string;
}

// Extracted from DocumentsPage: the document filter/search/favourites bar.
// Filter state, committed-search state, query-path construction, and data
// fetching stay in the page; this component is prop-driven and
// presentation-only.
export function DocumentFiltersPanel({
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
}: {
  filterType: string;
  filterCategory: string;
  filterLot: string;
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
  showFavouritesOnly: boolean;
  lots: DocumentFilterLot[];
  onFilterTypeChange: (value: string) => void;
  onFilterCategoryChange: (value: string) => void;
  onFilterLotChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onShowFavouritesOnlyChange: (value: boolean) => void;
  onTriggerSearch: () => void;
  onClearAll: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-4">
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
          <Label htmlFor="document-category-filter" className="mb-1">
            Category
          </Label>
          <NativeSelect
            id="document-category-filter"
            value={filterCategory}
            onChange={(e) => onFilterCategoryChange(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="uncategorized">Uncategorized</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
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
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="document-search" className="mb-1">
            Search
          </Label>
          <Input
            id="document-search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onTriggerSearch()}
            placeholder="Search by filename, caption..."
          />
        </div>
        <Button variant="secondary" onClick={onTriggerSearch}>
          Search
        </Button>
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
        {(filterType ||
          filterCategory ||
          filterLot ||
          dateFrom ||
          dateTo ||
          searchQuery ||
          showFavouritesOnly) && (
          <Button variant="destructive" size="sm" onClick={onClearAll}>
            Clear All
          </Button>
        )}
      </div>
    </div>
  );
}
