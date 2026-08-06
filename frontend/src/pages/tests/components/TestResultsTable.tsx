import React, { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNavigate } from 'react-router-dom';
import { RowActions } from '@/components/ui/RowActions';
import { formatStatusLabel } from '@/lib/statusLabels';
import type { TestResult } from '../types';
import {
  statusColors,
  testStatusColors,
  testStatusLabels,
  isTestOverdue,
  getDaysSince,
  getLabWait,
  formatLabWait,
  isAiExtractionReviewDraft,
} from '../constants';
import { useTestRowActions } from './useTestRowActions';

interface TestResultsTableProps {
  projectId: string;
  filteredTestResults: TestResult[];
  hasActiveFilters: boolean;
  updatingStatusId: string | null;
  onUpdateStatus: (testId: string, newStatus: string) => void;
  // Ticket T2: open the Enter Results form (records result + pass/fail, then
  // advances to 'entered'). Used for any pre-'entered' state instead of a
  // no-data status POST.
  onOpenEnterResults: (test: TestResult) => void;
  onRejectTest: (testId: string) => void;
  onAttachCertificate: (testId: string, file: File, extract?: boolean) => Promise<void>;
  onClearFilters: () => void;
  onOpenCreateModal: () => void;
  // Migration action: link an existing test to one of its lot's ITP items.
  // Only offered for tests that have a linked lot (so an ITP can exist).
  onLinkItpItem?: (test: TestResult) => void;
  // Deep-linked test (?test=<id>) to scroll to and highlight.
  highlightedTestId?: string | null;
}

export const TestResultsTable = React.memo(function TestResultsTable({
  projectId,
  filteredTestResults,
  hasActiveFilters,
  updatingStatusId,
  onUpdateStatus,
  onOpenEnterResults,
  onRejectTest,
  onAttachCertificate,
  onClearFilters,
  onOpenCreateModal,
  onLinkItpItem,
  highlightedTestId,
}: TestResultsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredTestResults.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  // Scroll the deep-linked test into view while its highlight pulse is active.
  useEffect(() => {
    if (!highlightedTestId) return;
    const index = filteredTestResults.findIndex((test) => test.id === highlightedTestId);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'center' });
  }, [highlightedTestId, filteredTestResults, virtualizer]);

  if (filteredTestResults.length === 0 && !hasActiveFilters) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <div className="text-5xl mb-4">{'🧪'}</div>
        <h3 className="text-lg font-semibold mb-2">No Test Results</h3>
        <p className="text-muted-foreground mb-4">
          No test results have been recorded yet. Add test results to track quality compliance.
        </p>
        <button
          onClick={onOpenCreateModal}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Add your first test result
        </button>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const showFilterEmpty = filteredTestResults.length === 0 && hasActiveFilters;

  return (
    // Single <table> inside the scroll container with top/bottom spacer rows
    // (the lots/NCR register virtualization idiom) so header and body columns
    // share one column model and screen readers see one coherent table — the
    // previous header-table + per-row tables broke both alignment and semantics.
    <div
      ref={parentRef}
      className="rounded-lg border overflow-auto"
      style={{ maxHeight: 'calc(100vh - 300px)' }}
      data-testid="test-results-scroll-container"
    >
      <table className="w-full">
        <thead className="bg-muted/50 sticky top-0 z-10">
          <tr>
            {/* Test Type absorbs the slack; every other column sizes to its own
                content so lot numbers, lab names and results stop wrapping. */}
            <th className="w-full px-4 py-3 text-left text-sm font-medium">Test Type</th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">Request #</th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">
              Linked Lot
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">
              Laboratory
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">Result</th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">Pass/Fail</th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">Status</th>
            {/* Fixed width: one primary action + the overflow trigger, so the
                column reads the same on every row. */}
            <th className="w-[150px] px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {showFilterEmpty ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                <div className="text-3xl mb-2">{'🔍'}</div>
                <p>No test results match your filters.</p>
                <button
                  onClick={onClearFilters}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Clear all filters
                </button>
              </td>
            </tr>
          ) : (
            <>
              {/* Top spacer: pushes the first rendered row to its virtual position. */}
              {virtualItems.length > 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      height: `${virtualItems[0]?.start ?? 0}px`,
                      padding: 0,
                      border: 'none',
                    }}
                  />
                </tr>
              )}
              {virtualItems.map((virtualRow) => {
                const test = filteredTestResults[virtualRow.index];
                if (!test) return null;
                return (
                  <TestResultRow
                    key={virtualRow.key}
                    test={test}
                    index={virtualRow.index}
                    measureRef={virtualizer.measureElement}
                    projectId={projectId}
                    updatingStatusId={updatingStatusId}
                    onUpdateStatus={onUpdateStatus}
                    onOpenEnterResults={onOpenEnterResults}
                    onRejectTest={onRejectTest}
                    onAttachCertificate={onAttachCertificate}
                    onLinkItpItem={onLinkItpItem}
                    isHighlighted={test.id === highlightedTestId}
                  />
                );
              })}
              {/* Bottom spacer: keeps total scroll height correct below the window. */}
              {virtualItems.length > 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      height: `${virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)}px`,
                      padding: 0,
                      border: 'none',
                    }}
                  />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
});

interface TestResultRowProps {
  test: TestResult;
  index: number;
  measureRef: (node: HTMLTableRowElement | null) => void;
  projectId: string;
  updatingStatusId: string | null;
  onUpdateStatus: (testId: string, newStatus: string) => void;
  onOpenEnterResults: (test: TestResult) => void;
  onRejectTest: (testId: string) => void;
  onAttachCertificate: (testId: string, file: File, extract?: boolean) => Promise<void>;
  onLinkItpItem?: (test: TestResult) => void;
  isHighlighted: boolean;
}

// Its own component because the row's action set comes from a hook, which a
// `.map()` inside the table body cannot call.
function TestResultRow({
  test,
  index,
  measureRef,
  projectId,
  updatingStatusId,
  onUpdateStatus,
  onOpenEnterResults,
  onRejectTest,
  onAttachCertificate,
  onLinkItpItem,
  isHighlighted,
}: TestResultRowProps) {
  const navigate = useNavigate();
  const { fileInput, primary, actions } = useTestRowActions({
    test,
    projectId,
    updatingStatusId,
    onUpdateStatus,
    onOpenEnterResults,
    onRejectTest,
    onAttachCertificate,
    onLinkItpItem,
  });

  const overdue = isTestOverdue(test);
  const labWait = getLabWait(test);
  const daysSince = getDaysSince(test.sampleDate, test.createdAt);
  const aiExtractionReviewDraft = isAiExtractionReviewDraft(test);
  const statusLabel = aiExtractionReviewDraft
    ? 'Draft review'
    : testStatusLabels[test.status] || test.status;
  const statusClass = aiExtractionReviewDraft
    ? 'bg-warning/10 text-warning'
    : testStatusColors[test.status] || 'bg-muted';

  return (
    <tr
      ref={measureRef}
      data-index={index}
      data-deep-linked={isHighlighted ? 'true' : undefined}
      className={`hover:bg-muted/30 border-b ${overdue ? 'bg-destructive/10 border-l-4 border-l-destructive' : ''} ${isHighlighted ? 'bg-primary/10' : ''}`}
    >
      <td className="px-4 py-3 text-sm font-medium">
        <div className="flex items-center gap-2">
          {test.testType}
          {/* Feature #200: AI extracted indicator */}
          {test.aiExtracted && (
            <span
              className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded font-bold"
              title="AI Extracted from certificate"
            >
              AI
            </span>
          )}
          {aiExtractionReviewDraft && (
            <span
              className="px-1.5 py-0.5 text-[10px] bg-warning/10 text-warning rounded font-bold"
              title="Draft extraction review. Confirm the AI review dialog before treating this as an official test result."
            >
              Draft extraction review
            </span>
          )}
          {overdue && (
            <span className="px-1.5 py-0.5 text-[10px] bg-destructive text-destructive-foreground rounded font-bold">
              OVERDUE
            </span>
          )}
        </div>
        {/* Feature #197: Show days since sample/created */}
        <div className={`text-xs mt-0.5 ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
          {daysSince} days since {test.sampleDate ? 'sample' : 'request'}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">{test.testRequestNumber || '—'}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        {test.lot ? (
          <button
            onClick={() =>
              navigate(
                `/projects/${encodeURIComponent(projectId)}/lots/${encodeURIComponent(test.lot?.id || test.lotId || '')}`,
              )
            }
            className="text-primary hover:underline"
          >
            {test.lot.lotNumber}
          </button>
        ) : (
          <span className="text-muted-foreground">{'—'}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">{test.laboratoryName || '—'}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        {test.resultValue != null
          ? `${test.resultValue}${test.resultUnit ? ` ${test.resultUnit}` : ''}`
          : '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        {/* Same Title Case as the workflow Status chip beside it — the two read
            as one vocabulary instead of `pending` next to `Requested`. */}
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${statusColors[test.passFail] || 'bg-muted'}`}
        >
          {formatStatusLabel(test.passFail)}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass}`}>
          {statusLabel}
        </span>
        {/* Wave C2 Phase 3: the lab wait. Elapsed is a fact and is always shown
            once the sample was sent; "overdue" only appears where a human
            supplied an expected date. */}
        {labWait && (
          <div
            className={`text-xs mt-0.5 ${labWait.overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
          >
            {formatLabWait(labWait)}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        {fileInput}
        <div className="flex items-center gap-2">
          <RowActions
            primary={primary}
            actions={actions}
            menuLabel={`More actions for ${test.testType}`}
          />
          {test.status === 'verified' && (
            <span className="whitespace-nowrap text-muted-foreground text-xs font-medium">
              {'✓'} Complete
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
