/**
 * ITPChecklistTab Component
 * Displays the ITP (Inspection and Test Plan) checklist for a lot.
 * Extracted from LotDetailPage.tsx for better maintainability.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, WifiOff, CloudOff, Printer, Unlink } from 'lucide-react';
import { MobileITPChecklist } from '@/components/foreman/MobileITPChecklist';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { findFirstIncompleteItpCategory } from '@/components/foreman/mobileItpChecklistHelpers';
import type { ITPInstance, ITPTemplate, ITPAttachment, Lot } from '../types';
import { ITPChecklistItemRow } from './ITPChecklistItemRow';
import { PhotoLightbox } from './ITPPhotoLightbox';
import {
  filterItpChecklistItems,
  getAdjacentItpAttachment,
  getItpAttachments,
  getItpCategoryProgress,
  getItpChecklistProgress,
  groupItpChecklistItemsByCategory,
  isItpTemplateActivityMatch,
  sortItpTemplatesForLotActivity,
  toggleExpandedItpCategory,
  type ItpStatusFilter,
} from './itpChecklistTabHelpers';

// Main ITPChecklistTab props
export interface ITPChecklistTabProps {
  lot: Lot;
  projectId: string;
  itpInstance: ITPInstance | null;
  setItpInstance: React.Dispatch<React.SetStateAction<ITPInstance | null>>;
  templates: ITPTemplate[];
  loadingItp: boolean;
  itpLoadError: string | null;
  isOnline: boolean;
  isOfflineData: boolean;
  offlinePendingCount: number;
  isMobile: boolean;
  updatingCompletion: string | null;
  canCompleteITPItems: boolean;
  canAssignITPTemplate: boolean;
  // Handlers
  onToggleCompletion: (
    checklistItemId: string,
    currentlyCompleted: boolean,
    existingNotes: string | null,
    forceComplete?: boolean,
    witnessData?: { witnessPresent: boolean; witnessName?: string; witnessCompany?: string },
  ) => Promise<boolean>;
  onUpdateNotes: (checklistItemId: string, notes: string) => Promise<void>;
  /** Must resolve true on success / false on failure so the mobile sheet can stay open. */
  onMarkAsNA: (checklistItemId: string, reason: string) => Promise<boolean>;
  /** Must resolve true on success / false on failure so the mobile sheet can stay open. */
  onMarkAsFailed: (checklistItemId: string, reason: string) => Promise<boolean>;
  onAddPhoto: (checklistItemId: string, file: File) => Promise<void>;
  onAddPhotoDesktop: (
    completionId: string,
    checklistItemId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  onAssignTemplate: (templateId: string) => Promise<boolean>;
  onUnassignTemplate: (instanceId: string) => Promise<boolean>;
  onRetryItp: () => void;
  assigningTemplate: boolean;
  autoOpenAssignTemplate?: boolean;
  onAutoOpenAssignTemplateHandled?: () => void;
  // Modal state setters
  onOpenNaModal: (data: { checklistItemId: string; itemDescription: string }) => void;
  onOpenFailedModal: (data: { checklistItemId: string; itemDescription: string }) => void;
  // H4: head-contractor verify/reject. `canReviewITP` is the role-based gate;
  // per-row the actions are also hidden on the user's own completion.
  canReviewITP?: boolean;
  currentUserId?: string;
  onVerifyCompletion?: (completionId: string) => Promise<boolean> | void;
  onRejectCompletion?: (completionId: string, reason: string) => Promise<boolean>;
  // Requirement-first test entry: per-row "Add test result" for test-required,
  // unsatisfied items. Backend enforces the role; canCreateTests gates the UI.
  canCreateTests?: boolean;
  onAddTestResult?: (item: { id: string; description: string; testType?: string | null }) => void;
}

export function ITPChecklistTab({
  lot,
  projectId,
  itpInstance,
  setItpInstance,
  templates,
  loadingItp,
  itpLoadError,
  isOnline,
  isOfflineData,
  offlinePendingCount,
  isMobile,
  updatingCompletion,
  canCompleteITPItems,
  canAssignITPTemplate,
  onToggleCompletion,
  onUpdateNotes,
  onMarkAsNA,
  onMarkAsFailed,
  onAddPhoto,
  onAddPhotoDesktop,
  onAssignTemplate,
  onUnassignTemplate,
  onRetryItp,
  assigningTemplate,
  autoOpenAssignTemplate = false,
  onAutoOpenAssignTemplateHandled,
  onOpenNaModal,
  onOpenFailedModal,
  canReviewITP = false,
  currentUserId,
  onVerifyCompletion,
  onRejectCompletion,
  canCreateTests = false,
  onAddTestResult,
}: ITPChecklistTabProps) {
  const navigate = useNavigate();
  const assignTemplateCardRef = useRef<HTMLDivElement>(null);

  // Local state for ITP tab
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [itpStatusFilter, setItpStatusFilter] = useState<ItpStatusFilter>('all');
  const [expandedItpCategories, setExpandedItpCategories] = useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ITPAttachment | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const hasAppliedDefaultItpExpansion = useRef(false);
  // H4: verify/reject in-flight + reject-reason modal state.
  const [reviewingCompletionId, setReviewingCompletionId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{
    completionId: string;
    itemDescription: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  const handleVerifyCompletion = async (completionId: string) => {
    if (!onVerifyCompletion) return;
    setReviewingCompletionId(completionId);
    try {
      await onVerifyCompletion(completionId);
    } finally {
      setReviewingCompletionId(null);
    }
  };

  const handleRequestReject = (completionId: string, itemDescription: string) => {
    setRejectReason('');
    setRejectModal({ completionId, itemDescription });
  };

  const handleSubmitReject = async () => {
    if (!rejectModal || !onRejectCompletion) return;
    setSubmittingReject(true);
    setReviewingCompletionId(rejectModal.completionId);
    try {
      const ok = await onRejectCompletion(rejectModal.completionId, rejectReason);
      if (ok) {
        setRejectModal(null);
        setRejectReason('');
      }
    } finally {
      setSubmittingReject(false);
      setReviewingCompletionId(null);
    }
  };

  // Default-expand the first category that still has work once the instance
  // loads (same behavior as the mobile checklist), instead of all-collapsed.
  useEffect(() => {
    if (!itpInstance || hasAppliedDefaultItpExpansion.current) return;
    hasAppliedDefaultItpExpansion.current = true;
    const firstIncomplete = findFirstIncompleteItpCategory(
      itpInstance.template.checklistItems,
      itpInstance.completions,
    );
    if (firstIncomplete) {
      setExpandedItpCategories(new Set([firstIncomplete]));
    }
  }, [itpInstance]);

  useEffect(() => {
    if (!autoOpenAssignTemplate || itpInstance || loadingItp) return;

    const frame = window.requestAnimationFrame(() => {
      assignTemplateCardRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
      if (canAssignITPTemplate && templates.length > 0) {
        setShowAssignModal(true);
      }
      onAutoOpenAssignTemplateHandled?.();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    autoOpenAssignTemplate,
    itpInstance,
    loadingItp,
    canAssignITPTemplate,
    onAutoOpenAssignTemplateHandled,
    templates.length,
  ]);

  // Photo navigation handlers
  const getAllPhotos = (): ITPAttachment[] => {
    if (!itpInstance) return [];
    return getItpAttachments(itpInstance.completions);
  };

  const handlePrevPhoto = () => {
    if (!selectedPhoto) return;
    const previousPhoto = getAdjacentItpAttachment(getAllPhotos(), selectedPhoto.id, 'previous');
    if (previousPhoto) {
      setSelectedPhoto(previousPhoto);
      setPhotoZoom(1);
    }
  };

  const handleNextPhoto = () => {
    if (!selectedPhoto) return;
    const nextPhoto = getAdjacentItpAttachment(getAllPhotos(), selectedPhoto.id, 'next');
    if (nextPhoto) {
      setSelectedPhoto(nextPhoto);
      setPhotoZoom(1);
    }
  };

  const handleClosePhoto = () => {
    setSelectedPhoto(null);
    setPhotoZoom(1);
  };

  const handleConfirmUnassign = async () => {
    if (!itpInstance) return;
    const unassigned = await onUnassignTemplate(itpInstance.id);
    if (unassigned) {
      setShowUnassignConfirm(false);
    }
  };

  if (loadingItp) {
    return (
      <div className="flex justify-center p-8" role="status" aria-label="Loading ITP checklist">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (itpLoadError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6" role="alert">
        <h3 className="font-semibold text-destructive">Could not load ITP checklist</h3>
        <p className="mt-2 text-sm text-muted-foreground">{itpLoadError}</p>
        <button
          type="button"
          onClick={onRetryItp}
          className="mt-4 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          Try again
        </button>
      </div>
    );
  }

  // Mobile ITP Checklist
  if (itpInstance && isMobile) {
    return (
      <MobileITPChecklist
        lotNumber={lot?.lotNumber || ''}
        templateName={itpInstance.template.name}
        checklistItems={itpInstance.template.checklistItems}
        completions={itpInstance.completions}
        onToggleCompletion={(checklistItemId, isCompleted, notes) =>
          onToggleCompletion(checklistItemId, !isCompleted, notes)
        }
        onMarkNotApplicable={onMarkAsNA}
        onMarkFailed={onMarkAsFailed}
        onUpdateNotes={onUpdateNotes}
        onAddPhoto={onAddPhoto}
        updatingItem={updatingCompletion}
        canCompleteItems={canCompleteITPItems}
      />
    );
  }

  // Desktop ITP Checklist
  if (itpInstance) {
    const { totalItems, naItems, finishedItems, percentage } = getItpChecklistProgress(
      itpInstance.template.checklistItems,
      itpInstance.completions,
    );
    const categorizedItems = groupItpChecklistItemsByCategory(itpInstance.template.checklistItems);
    const categories = Object.keys(categorizedItems);

    return (
      <>
        <div className="rounded-lg border p-4">
          {/* Offline indicator */}
          {(isOfflineData || !isOnline || offlinePendingCount > 0) && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                !isOnline
                  ? 'bg-warning/10 text-warning-foreground border border-warning/20'
                  : isOfflineData
                    ? 'bg-muted text-muted-foreground border border-border'
                    : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              {!isOnline ? (
                <>
                  <WifiOff className="h-4 w-4" />
                  <span>Offline Mode - Changes will sync when online</span>
                  {offlinePendingCount > 0 && (
                    <span className="ml-auto bg-warning/20 px-2 py-0.5 rounded-full text-xs font-medium">
                      {offlinePendingCount} pending
                    </span>
                  )}
                </>
              ) : isOfflineData ? (
                <>
                  <CloudOff className="h-4 w-4" />
                  <span>Showing cached data</span>
                </>
              ) : offlinePendingCount > 0 ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>{offlinePendingCount} changes pending sync</span>
                </>
              ) : null}
            </div>
          )}
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">ITP Progress</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="max-w-[18rem] truncate text-sm text-muted-foreground">
                {itpInstance.template.name}
              </span>
              {canAssignITPTemplate && (
                <button
                  type="button"
                  onClick={() => setShowUnassignConfirm(true)}
                  disabled={assigningTemplate}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50 print:hidden"
                  title="Unassign ITP template"
                >
                  <Unlink className="h-4 w-4" />
                  <span>Unassign</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors print:hidden"
                title="Print ITP Checklist"
              >
                <Printer className="h-4 w-4" />
                <span>Print Checklist</span>
              </button>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {finishedItems} of {totalItems} checklist items completed ({percentage}%)
            {naItems > 0 && <span className="text-muted-foreground"> - {naItems} N/A</span>}
          </p>
        </div>

        {/* Status filter dropdown */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label
              htmlFor="itp-status-filter"
              className="text-sm font-medium text-muted-foreground"
            >
              Filter by status:
            </label>
            <select
              id="itp-status-filter"
              value={itpStatusFilter}
              onChange={(e) => setItpStatusFilter(e.target.value as typeof itpStatusFilter)}
              className="text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground"
            >
              <option value="all">All Items</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="na">N/A</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showIncompleteOnly}
              onChange={(e) => setShowIncompleteOnly(e.target.checked)}
              className="rounded border-border accent-primary"
            />
            <span>Show incomplete only</span>
          </label>
        </div>

        {/* Categorized checklist items */}
        <div className="rounded-lg border">
          <div className="divide-y">
            {categories.map((category) => {
              const categoryItems = categorizedItems[category];
              const isExpanded = expandedItpCategories.has(category);
              const filteredItems = filterItpChecklistItems(
                categoryItems,
                itpInstance.completions,
                itpStatusFilter,
                showIncompleteOnly,
              );
              const { completedInCategory, totalInCategory, isCategoryComplete } =
                getItpCategoryProgress(categoryItems, itpInstance.completions);

              // Skip category if no items match filter
              if (filteredItems.length === 0 && (itpStatusFilter !== 'all' || showIncompleteOnly)) {
                return null;
              }

              return (
                <div key={category}>
                  {/* Category header - collapsible */}
                  <button
                    onClick={() => {
                      setExpandedItpCategories((prev) => toggleExpandedItpCategory(prev, category));
                    }}
                    className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      <span className="font-semibold">{category}</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        isCategoryComplete
                          ? 'bg-foreground/10 text-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {completedInCategory}/{totalInCategory}
                    </span>
                  </button>

                  {/* Category items - expandable */}
                  {isExpanded &&
                    filteredItems.map((item) => {
                      const completion = itpInstance.completions.find(
                        (c) => c.checklistItemId === item.id,
                      );
                      return (
                        <ITPChecklistItemRow
                          key={item.id}
                          item={item}
                          completion={completion}
                          projectId={projectId}
                          updatingCompletion={updatingCompletion}
                          onToggleCompletion={(id, completed, notes) =>
                            onToggleCompletion(id, completed, notes)
                          }
                          onUpdateNotes={onUpdateNotes}
                          onAddPhoto={onAddPhotoDesktop}
                          onMarkAsNA={(id, desc) =>
                            onOpenNaModal({ checklistItemId: id, itemDescription: desc })
                          }
                          onMarkAsFailed={(id, desc) =>
                            onOpenFailedModal({ checklistItemId: id, itemDescription: desc })
                          }
                          onPhotoClick={setSelectedPhoto}
                          setItpInstance={setItpInstance}
                          canReviewITP={canReviewITP}
                          currentUserId={currentUserId}
                          reviewingCompletionId={reviewingCompletionId}
                          onVerifyCompletion={handleVerifyCompletion}
                          onRequestReject={handleRequestReject}
                          canCreateTests={canCreateTests}
                          onAddTestResult={onAddTestResult}
                        />
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Photo Viewer Modal */}
        {selectedPhoto && (
          <PhotoLightbox
            selectedPhoto={selectedPhoto}
            allPhotos={getAllPhotos()}
            itpInstance={itpInstance}
            photoZoom={photoZoom}
            onClose={handleClosePhoto}
            onPrev={handlePrevPhoto}
            onNext={handleNextPhoto}
            onZoomIn={() => setPhotoZoom((prev) => Math.min(prev + 0.5, 4))}
            onZoomOut={() => setPhotoZoom((prev) => Math.max(prev - 0.5, 0.5))}
            onResetZoom={() => setPhotoZoom(1)}
          />
        )}

        {/* H4: reject-reason modal (reason required, max 3000) */}
        {rejectModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            role="dialog"
            aria-modal="true"
            aria-label="Reject ITP item"
          >
            <div className="bg-background rounded-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-1">Reject ITP item</h2>
              <p className="text-sm text-muted-foreground mb-3">{rejectModal.itemDescription}</p>
              <label htmlFor="itp-reject-reason" className="block text-sm font-medium mb-1">
                Reason for rejection <span className="text-destructive">*</span>
              </label>
              <textarea
                id="itp-reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={3000}
                rows={4}
                className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                placeholder="Explain what needs to be corrected before this item can be verified..."
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setRejectModal(null);
                    setRejectReason('');
                  }}
                  disabled={submittingReject}
                  className="px-4 py-2 border rounded-lg hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReject}
                  disabled={submittingReject || !rejectReason.trim()}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {submittingReject ? 'Rejecting...' : 'Reject item'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={showUnassignConfirm}
          title="Unassign ITP template"
          description={
            <>
              <p>
                Unassign {itpInstance.template.name} from {lot?.lotNumber || 'this lot'}?
              </p>
              <p>
                This is only allowed when no completions, hold points, or test results have been
                recorded for this ITP on the lot.
              </p>
            </>
          }
          confirmLabel={assigningTemplate ? 'Unassigning...' : 'Unassign ITP'}
          variant="destructive"
          confirmDisabled={assigningTemplate}
          cancelDisabled={assigningTemplate}
          onCancel={() => setShowUnassignConfirm(false)}
          onConfirm={() => void handleConfirmUnassign()}
        />
      </>
    );
  }

  // No ITP assigned - show assignment UI for managers, execution guidance for field roles.
  return (
    <>
      <div ref={assignTemplateCardRef} className="rounded-lg border p-6 text-center">
        <div className="text-4xl mb-2">ITP</div>
        <h3 className="text-lg font-semibold mb-2">ITP Checklist</h3>
        {canAssignITPTemplate ? (
          <>
            <p className="text-muted-foreground mb-4">
              No ITP template assigned to this lot yet. Assign an ITP template to track quality
              checkpoints.
            </p>
            {templates.length > 0 ? (
              <button
                onClick={() => setShowAssignModal(true)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Assign ITP Template
              </button>
            ) : (
              <button
                onClick={() => navigate(`/projects/${encodeURIComponent(projectId)}/itp`)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Create ITP Template First
              </button>
            )}
          </>
        ) : (
          <p className="text-muted-foreground mb-0">
            An ITP template needs to be assigned before this lot can be checked off. Ask your
            project manager or site engineer to assign one, then complete checklist items from the
            lot.
          </p>
        )}
      </div>

      {/* Assign Template Modal */}
      {canAssignITPTemplate && showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Assign ITP Template</h2>
            {lot.activityType && (
              <p className="text-sm text-muted-foreground mb-3">
                Templates matching{' '}
                <span className="font-medium text-foreground">{lot.activityType}</span> are
                suggested first. Other active templates remain available if this lot needs a
                different checklist.
              </p>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {/* Sort templates: matching activity type first, then others */}
              {sortItpTemplatesForLotActivity(templates, lot.activityType).map((template) => {
                const isMatch = isItpTemplateActivityMatch(template, lot.activityType);
                return (
                  <button
                    key={template.id}
                    onClick={async () => {
                      const assigned = await onAssignTemplate(template.id);
                      if (assigned) {
                        setShowAssignModal(false);
                      }
                    }}
                    disabled={assigningTemplate}
                    className={`w-full text-left p-3 border rounded-lg hover:border-primary/50 transition-colors disabled:opacity-50 ${
                      isMatch ? 'border-primary/40 bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{template.name}</span>
                      {isMatch && (
                        <span className="text-xs bg-foreground/10 text-foreground px-2 py-0.5 rounded-full">
                          Suggested
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {template.activityType} - {template.checklistItems.length} items
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
                disabled={assigningTemplate}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
