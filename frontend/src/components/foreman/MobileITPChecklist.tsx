// MobileITPChecklist - Mobile-optimized ITP completion interface for foremen/subcontractors
// Features: Simple status buttons (Pass/N/A/Fail), notes, photos
import { useState, useMemo } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { isReleaseGatedChecklistItem } from '@/lib/itpReleaseGating';
import type { ITPChecklistItem, ITPCompletion } from '@/pages/lots/types';
import { MobileITPItemSheet } from './MobileITPItemSheet';
import {
  MobileITPCategoryHeader,
  MobileITPItem,
  MobileITPProgressHeader,
  MobileITPReadOnlyNotice,
} from './MobileITPChecklistSections';
import {
  calculateItpProgressPercent,
  countCompletedItpItems,
  countItpPhotoRequiredItems,
  findFirstIncompleteItpCategory,
  findItpCompletion,
  getItpCategoryStats,
  getItpItemStatus,
  groupItpItemsByCategory,
} from './mobileItpChecklistHelpers';

export type { ITPChecklistItem, ITPCompletion } from '@/pages/lots/types';

function isReleaseRequired(
  item: ITPChecklistItem | null,
  completion: ITPCompletion | undefined,
  status: 'pending' | 'completed' | 'na' | 'failed',
): boolean {
  if (!item || status !== 'pending') return false;
  return isReleaseGatedChecklistItem(item) && !completion?.holdPointRelease?.releasedByName;
}

interface MobileITPChecklistProps {
  lotNumber: string;
  templateName: string;
  checklistItems: ITPChecklistItem[];
  completions: ITPCompletion[];
  /** Must resolve true on success / false on failure so the PASS sheet can stay open. */
  onToggleCompletion: (
    checklistItemId: string,
    isCompleted: boolean,
    notes: string | null,
  ) => Promise<boolean>;
  /** Must resolve true on success / false on failure so the sheet can stay open. */
  onMarkNotApplicable: (checklistItemId: string, reason: string) => Promise<boolean>;
  /** Must resolve true on success / false on failure so the sheet can stay open. */
  onMarkFailed: (checklistItemId: string, reason: string) => Promise<boolean>;
  onUpdateNotes: (checklistItemId: string, notes: string) => Promise<void>;
  onAddPhoto: (checklistItemId: string, file: File) => Promise<void>;
  updatingItem?: string | null;
  /** Whether the current user can complete ITP items (false for subcontractors without permission) */
  canCompleteItems?: boolean;
}

export function MobileITPChecklist({
  lotNumber,
  templateName,
  checklistItems,
  completions,
  onToggleCompletion,
  onMarkNotApplicable,
  onMarkFailed,
  onUpdateNotes,
  onAddPhoto,
  updatingItem,
  canCompleteItems = true,
}: MobileITPChecklistProps) {
  const [selectedItem, setSelectedItem] = useState<ITPChecklistItem | null>(null);
  // Default-expand the first category that still has work, so the foreman lands
  // on actionable items instead of a wall of collapsed headers.
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const firstIncomplete = findFirstIncompleteItpCategory(checklistItems, completions);
    return firstIncomplete ? new Set([firstIncomplete]) : new Set<string>();
  });
  const { trigger } = useHaptics();

  const getCompletion = (itemId: string) => findItpCompletion(completions, itemId);

  const getItemStatus = (itemId: string): 'pending' | 'completed' | 'na' | 'failed' =>
    getItpItemStatus(getCompletion(itemId));

  // Group items by category
  const categorizedItems = useMemo(() => groupItpItemsByCategory(checklistItems), [checklistItems]);

  const categories = Object.keys(categorizedItems);

  // Get category completion stats
  const getCategoryStats = (category: string) =>
    getItpCategoryStats(categorizedItems[category] || [], completions);

  const toggleCategory = (category: string) => {
    trigger('light');
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const completedCount = countCompletedItpItems(completions);
  const totalCount = checklistItems.length;
  const progress = calculateItpProgressPercent(completedCount, totalCount);
  const selectedCompletion = selectedItem ? getCompletion(selectedItem.id) : undefined;
  const selectedStatus = selectedItem ? getItemStatus(selectedItem.id) : 'pending';
  const selectedReleaseRequired = isReleaseRequired(
    selectedItem,
    selectedCompletion,
    selectedStatus,
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <MobileITPProgressHeader
        lotNumber={lotNumber}
        templateName={templateName}
        progress={progress}
        completedCount={completedCount}
        totalCount={totalCount}
      />

      {/* Read-only notice for users without completion permission */}
      {!canCompleteItems && <MobileITPReadOnlyNotice />}

      {/* Checklist items grouped by category */}
      <div className="flex-1 overflow-y-auto">
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category);
          const stats = getCategoryStats(category);
          const items = categorizedItems[category];
          const isComplete = stats.completed === stats.total;

          return (
            <div key={category} className="border-b">
              {/* Category header - collapsible */}
              <MobileITPCategoryHeader
                category={category}
                isExpanded={isExpanded}
                isComplete={isComplete}
                completedCount={stats.completed}
                totalCount={stats.total}
                photoRequiredCount={countItpPhotoRequiredItems(items, completions)}
                onToggle={() => toggleCategory(category)}
              />

              {/* Category items - expandable */}
              {isExpanded &&
                items.map((item) => {
                  const status = getItemStatus(item.id);
                  const completion = getCompletion(item.id);
                  const hasNotes = !!completion?.notes;
                  const hasPhotos = (completion?.attachments?.length || 0) > 0;
                  const releaseRequired = isReleaseRequired(item, completion, status);
                  const canCompleteItem = canCompleteItems && !releaseRequired;

                  return (
                    <MobileITPItem
                      key={item.id}
                      item={item}
                      status={status}
                      hasNotes={hasNotes}
                      hasPhotos={hasPhotos}
                      photoCount={completion?.attachments?.length || 0}
                      isUpdating={updatingItem === item.id}
                      canComplete={canCompleteItem}
                      releaseRequired={releaseRequired}
                      onTap={() => {
                        trigger('light');
                        setSelectedItem(item);
                      }}
                      onQuickComplete={() => {
                        if (!canCompleteItem) {
                          trigger('error');
                          return;
                        }
                        trigger('medium');
                        onToggleCompletion(
                          item.id,
                          status !== 'completed',
                          completion?.notes || null,
                        );
                      }}
                    />
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* Item Detail Sheet */}
      <MobileITPItemSheet
        isOpen={!!selectedItem}
        item={selectedItem}
        completion={selectedCompletion}
        canComplete={canCompleteItems && !selectedReleaseRequired}
        releaseRequired={selectedReleaseRequired}
        onClose={() => setSelectedItem(null)}
        onPass={async (notes) => {
          if (!selectedItem) return false;
          if (!canCompleteItems) {
            trigger('error');
            return false;
          }
          trigger('medium');
          // Await the save and close only on success so a failed PASS keeps the
          // sheet open (mirrors the N/A and Fail handlers below).
          const saved = await onToggleCompletion(selectedItem.id, true, notes);
          if (saved) setSelectedItem(null);
          return saved;
        }}
        onNA={async (reason) => {
          if (!selectedItem) return false;
          if (!canCompleteItems) {
            trigger('error');
            return false;
          }
          trigger('medium');
          // Close only on success so a failed save keeps the typed reason.
          const saved = await onMarkNotApplicable(selectedItem.id, reason);
          if (saved) setSelectedItem(null);
          return saved;
        }}
        onFail={async (reason) => {
          if (!selectedItem) return false;
          if (!canCompleteItems) {
            trigger('error');
            return false;
          }
          trigger('error');
          // Close only on success so a failed save keeps the typed defect reason.
          const saved = await onMarkFailed(selectedItem.id, reason);
          if (saved) setSelectedItem(null);
          return saved;
        }}
        onUpdateNotes={(notes) => {
          if (!selectedItem) return;
          onUpdateNotes(selectedItem.id, notes);
        }}
        onAddPhoto={(file) => {
          if (!selectedItem) return;
          onAddPhoto(selectedItem.id, file);
        }}
      />
    </div>
  );
}
