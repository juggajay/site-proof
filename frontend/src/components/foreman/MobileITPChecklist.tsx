// MobileITPChecklist - Mobile-optimized ITP completion interface for foremen/subcontractors
// Features: Simple status buttons (Pass/N/A/Fail), notes, photos
import { useState, useMemo } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
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

export interface ITPChecklistItem {
  id: string;
  description: string;
  category: string;
  responsibleParty: 'contractor' | 'subcontractor' | 'superintendent' | 'general';
  isHoldPoint: boolean;
  pointType: 'standard' | 'witness' | 'hold_point';
  evidenceRequired: 'none' | 'photo' | 'test' | 'document';
  order: number;
  testType?: string | null;
  acceptanceCriteria?: string | null;
}

export interface ITPAttachment {
  id: string;
  documentId: string;
  document: {
    id: string;
    filename: string;
    fileUrl: string;
    caption: string | null;
  };
}

export interface ITPCompletion {
  id: string;
  checklistItemId: string;
  isCompleted: boolean;
  isNotApplicable?: boolean;
  isFailed?: boolean;
  isVerified?: boolean;
  notes: string | null;
  completedAt: string | null;
  completedBy: { id: string; fullName: string; email: string } | null;
  attachments: ITPAttachment[];
}

interface MobileITPChecklistProps {
  lotNumber: string;
  templateName: string;
  checklistItems: ITPChecklistItem[];
  completions: ITPCompletion[];
  onToggleCompletion: (
    checklistItemId: string,
    isCompleted: boolean,
    notes: string | null,
  ) => Promise<void>;
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

                  return (
                    <MobileITPItem
                      key={item.id}
                      item={item}
                      status={status}
                      hasNotes={hasNotes}
                      hasPhotos={hasPhotos}
                      photoCount={completion?.attachments?.length || 0}
                      isUpdating={updatingItem === item.id}
                      canComplete={canCompleteItems}
                      onTap={() => {
                        trigger('light');
                        setSelectedItem(item);
                      }}
                      onQuickComplete={() => {
                        if (!canCompleteItems) {
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
        completion={selectedItem ? getCompletion(selectedItem.id) : undefined}
        canComplete={canCompleteItems}
        onClose={() => setSelectedItem(null)}
        onPass={(notes) => {
          if (!selectedItem) return;
          if (!canCompleteItems) {
            trigger('error');
            return;
          }
          trigger('medium');
          onToggleCompletion(selectedItem.id, true, notes);
          setSelectedItem(null);
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
