import { useState } from 'react';
import { Bookmark, Save, Trash2 } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatStatusLabel } from '@/lib/statusLabels';
import type { SavedFilter } from './lotFilterConfig';

interface LotSavedFiltersMenuProps {
  hasActiveFilters: boolean;
  savedFilters: SavedFilter[];
  statusFilters: string[];
  activityFilter: string;
  searchQuery: string;
  onSaveFilter: (filterName: string) => void;
  onLoadSavedFilter: (filter: SavedFilter) => void;
  onDeleteSavedFilter: (filterId: string) => void;
}

export function LotSavedFiltersMenu({
  hasActiveFilters,
  savedFilters,
  statusFilters,
  activityFilter,
  searchQuery,
  onSaveFilter,
  onLoadSavedFilter,
  onDeleteSavedFilter,
}: LotSavedFiltersMenuProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');

  const closeSaveFilterModal = () => {
    setShowSaveFilterModal(false);
    setNewFilterName('');
  };

  const handleSaveFilter = () => {
    if (!newFilterName.trim()) return;
    onSaveFilter(newFilterName);
    closeSaveFilterModal();
  };

  const handleLoadSavedFilter = (filter: SavedFilter) => {
    onLoadSavedFilter(filter);
    setDropdownOpen(false);
  };

  if (!hasActiveFilters && savedFilters.length === 0) return null;

  return (
    <>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSaveFilterModal(true)}
          className="text-muted-foreground hover:text-foreground"
          title="Save current filter"
        >
          <Save className="h-3.5 w-3.5" />
          Save Filter
        </Button>
      )}

      {savedFilters.length > 0 && (
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            title="Load saved filter"
          >
            <Bookmark className="h-4 w-4" />
            Saved ({savedFilters.length})
          </Button>
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 w-64 rounded-lg border bg-card shadow-lg">
                <div className="p-2 border-b">
                  <span className="text-xs font-medium text-muted-foreground">Saved Filters</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {savedFilters.map((filter) => (
                    <div
                      key={filter.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-muted group"
                    >
                      <button
                        onClick={() => handleLoadSavedFilter(filter)}
                        className="flex-1 text-left text-sm truncate"
                        title={`Load filter: ${filter.name}`}
                      >
                        {filter.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteSavedFilter(filter.id);
                        }}
                        className="h-6 w-6 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete filter"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showSaveFilterModal && (
        <Modal onClose={closeSaveFilterModal} className="max-w-md">
          <ModalHeader>Save Current Filter</ModalHeader>
          <ModalBody>
            <p className="text-sm text-muted-foreground mb-4">
              Save the current filter settings for quick access later.
            </p>
            <div>
              <Label className="mb-1">Filter Name</Label>
              <Input
                type="text"
                value={newFilterName}
                onChange={(event) => setNewFilterName(event.target.value)}
                placeholder="e.g., Completed Earthworks"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSaveFilter();
                }}
              />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              <p>Current filter:</p>
              <ul className="mt-1 ml-4 list-disc">
                {statusFilters.length > 0 && (
                  <li>
                    Status: {statusFilters.map((status) => formatStatusLabel(status)).join(', ')}
                  </li>
                )}
                {activityFilter && <li>Activity: {activityFilter}</li>}
                {searchQuery && <li>Search: &quot;{searchQuery}&quot;</li>}
              </ul>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={closeSaveFilterModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveFilter} disabled={!newFilterName.trim()}>
              Save Filter
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
