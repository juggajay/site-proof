import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNavigate } from 'react-router-dom';
import type { TestResult } from '../types';
import {
  statusColors,
  testStatusColors,
  testStatusLabels,
  nextStatusMap,
  nextStatusButtonLabels,
  isEnterResultsStep,
  isTestOverdue,
  getDaysSince,
  isAiExtractionReviewDraft,
} from '../constants';
import { generateTestResultCertificate } from '../testResultCertificate';
import { AttachCertificateButton } from './AttachCertificateButton';

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
  onAttachCertificate: (testId: string, file: File) => Promise<void>;
  onClearFilters: () => void;
  onOpenCreateModal: () => void;
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
}: TestResultsTableProps) {
  const navigate = useNavigate();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredTestResults.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  if (filteredTestResults.length === 0 && !hasActiveFilters) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <div className="text-5xl mb-4">{'\uD83E\uDDEA'}</div>
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
    // share one column model and screen readers see one coherent table \u2014 the
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
            <th className="px-4 py-3 text-left text-sm font-medium">Test Type</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Request #</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Linked Lot</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Laboratory</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Result</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Pass/Fail</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {showFilterEmpty ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                <div className="text-3xl mb-2">{'\uD83D\uDD0D'}</div>
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
                const overdue = isTestOverdue(test);
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
                    key={virtualRow.key}
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    className={`hover:bg-muted/30 border-b ${overdue ? 'bg-destructive/10 border-l-4 border-l-destructive' : ''}`}
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
                      <div
                        className={`text-xs mt-0.5 ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}
                      >
                        {daysSince} days since {test.sampleDate ? 'sample' : 'request'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{test.testRequestNumber || '\u2014'}</td>
                    <td className="px-4 py-3 text-sm">
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
                        <span className="text-muted-foreground">{'\u2014'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{test.laboratoryName || '\u2014'}</td>
                    <td className="px-4 py-3 text-sm">
                      {test.resultValue != null
                        ? `${test.resultValue}${test.resultUnit ? ` ${test.resultUnit}` : ''}`
                        : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${statusColors[test.passFail] || 'bg-muted'}`}
                      >
                        {test.passFail}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2 items-center">
                        {/* Feature #668: Print Certificate button */}
                        <button
                          onClick={() => generateTestResultCertificate(test, projectId)}
                          className="p-1.5 text-xs border rounded hover:bg-muted/50 transition-colors"
                          title="Print Test Certificate"
                          aria-label={`Print test certificate for ${test.testType}`}
                        >
                          {'\uD83D\uDDA8\uFE0F'}
                        </button>
                        {nextStatusMap[test.status] &&
                          (isEnterResultsStep(test.status) ? (
                            // Ticket T2: record the result before entering.
                            <button
                              onClick={() => onOpenEnterResults(test)}
                              className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              {nextStatusButtonLabels[test.status]}
                            </button>
                          ) : (
                            <button
                              onClick={() => onUpdateStatus(test.id, nextStatusMap[test.status])}
                              disabled={updatingStatusId === test.id}
                              className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              {updatingStatusId === test.id
                                ? 'Updating...'
                                : nextStatusButtonLabels[test.status]}
                            </button>
                          ))}
                        {/* Feature B2: attach/replace a certificate so a
                                manual test can reach 'verified'. */}
                        {test.status !== 'verified' && (
                          <AttachCertificateButton
                            testId={test.id}
                            hasCertificate={!!test.certificateDocId}
                            onAttachCertificate={onAttachCertificate}
                          />
                        )}
                        {/* Feature #204: Reject button for tests in "entered" status */}
                        {test.status === 'entered' && (
                          <button
                            onClick={() => onRejectTest(test.id)}
                            className="px-3 py-1 text-xs rounded bg-destructive/10 text-destructive hover:bg-destructive/20"
                          >
                            Reject
                          </button>
                        )}
                        {test.status === 'verified' && (
                          <span className="text-muted-foreground text-xs font-medium">
                            {'\u2713'} Complete
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
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
