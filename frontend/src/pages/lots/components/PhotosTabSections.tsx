import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PhotosEmptyStateProps {
  onOpenItpChecklist: () => void;
}

export function PhotosEmptyState({ onOpenItpChecklist }: PhotosEmptyStateProps) {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Photos</h2>
      </div>
      <div className="rounded-lg border p-6 text-center">
        <div className="text-4xl mb-2">📷</div>
        <h3 className="text-lg font-semibold mb-2">No Photos</h3>
        <p className="text-muted-foreground">
          No photos have been uploaded for this lot yet. Add photos to ITP checklist items to
          document work progress.
        </p>
        <Button variant="outline" onClick={onOpenItpChecklist} className="mt-4">
          Go to ITP Checklist
        </Button>
      </div>
    </div>
  );
}

interface PhotosSelectionToolbarProps {
  photoCount: number;
  selectedCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onOpenBatchCaption: () => void;
  onOpenAddToEvidence: () => void;
}

export function PhotosSelectionToolbar({
  photoCount,
  selectedCount,
  allSelected,
  onToggleSelectAll,
  onOpenBatchCaption,
  onOpenAddToEvidence,
}: PhotosSelectionToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {photoCount} photo{photoCount !== 1 ? 's' : ''} attached to ITP checklist items
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            className="h-4 w-4 rounded border-border"
          />
          Select All
        </label>
        {selectedCount > 0 && (
          <>
            <Button size="sm" onClick={onOpenBatchCaption}>
              <FileText className="h-4 w-4" />
              Bulk Caption ({selectedCount})
            </Button>
            <Button variant="success" size="sm" onClick={onOpenAddToEvidence}>
              <Plus className="h-4 w-4" />
              Add to Evidence ({selectedCount})
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
