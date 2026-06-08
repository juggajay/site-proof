import { Printer, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileDataCard } from '@/components/ui/MobileDataCard';
import { Button } from '@/components/ui/button';
import type { TestResult } from '../types';
import {
  statusColors,
  testStatusLabels,
  nextStatusMap,
  nextStatusButtonLabels,
  isTestOverdue,
  getDaysSince,
  isAiExtractionReviewDraft,
} from '../constants';
import { generateTestResultCertificate } from '../testResultCertificate';

interface TestResultsMobileListProps {
  projectId: string;
  filteredTestResults: TestResult[];
  hasActiveFilters: boolean;
  updatingStatusId: string | null;
  onUpdateStatus: (testId: string, newStatus: string) => void;
  onRejectTest: (testId: string) => void;
  onClearFilters: () => void;
  onOpenCreateModal: () => void;
}

// Mobile (<768px) card layout for the test results register. Mirrors the desktop
// TestResultsTable's empty / filter-empty states and its exact per-status action
// gating (next-status workflow, reject, certificate print), but renders each test
// as a tap-friendly card. Reuses the page's existing status/reject handlers and
// the shared certificate generator — no API or workflow changes.
export function TestResultsMobileList({
  projectId,
  filteredTestResults,
  hasActiveFilters,
  updatingStatusId,
  onUpdateStatus,
  onRejectTest,
  onClearFilters,
  onOpenCreateModal,
}: TestResultsMobileListProps) {
  if (filteredTestResults.length === 0 && !hasActiveFilters) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <div className="text-5xl mb-4">&#x1f9ea;</div>
        <h3 className="text-lg font-semibold mb-2">No Test Results</h3>
        <p className="text-muted-foreground mb-4">
          No test results have been recorded yet. Add test results to track quality compliance.
        </p>
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Add your first test result
        </button>
      </div>
    );
  }

  if (filteredTestResults.length === 0 && hasActiveFilters) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <div className="text-3xl mb-2">&#x1f50d;</div>
        <p className="text-muted-foreground">No test results match your filters.</p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Clear all filters
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredTestResults.map((test) => (
        <TestResultMobileCard
          key={test.id}
          test={test}
          projectId={projectId}
          updatingStatusId={updatingStatusId}
          onUpdateStatus={onUpdateStatus}
          onRejectTest={onRejectTest}
        />
      ))}
    </div>
  );
}

interface TestResultMobileCardProps {
  test: TestResult;
  projectId: string;
  updatingStatusId: string | null;
  onUpdateStatus: (testId: string, newStatus: string) => void;
  onRejectTest: (testId: string) => void;
}

// Maps the test workflow status to a MobileDataCard badge variant. Mirrors the
// desktop table's status colours as closely as the shared palette allows.
const statusVariants: Record<
  string,
  'default' | 'warning' | 'success' | 'error' | 'info' | 'pending'
> = {
  requested: 'default',
  at_lab: 'default',
  results_received: 'default',
  entered: 'default',
  verified: 'default',
};

function TestResultMobileCard({
  test,
  projectId,
  updatingStatusId,
  onUpdateStatus,
  onRejectTest,
}: TestResultMobileCardProps) {
  const navigate = useNavigate();
  const overdue = isTestOverdue(test);
  const daysSince = getDaysSince(test.sampleDate, test.createdAt);
  const draft = isAiExtractionReviewDraft(test);
  const statusLabel = draft ? 'Draft review' : testStatusLabels[test.status] || test.status;
  const statusVariant = draft ? 'warning' : (statusVariants[test.status] ?? 'default');
  const resultDisplay =
    test.resultValue != null
      ? `${test.resultValue}${test.resultUnit ? ` ${test.resultUnit}` : ''}`
      : '—';
  const nextStatus = nextStatusMap[test.status];

  return (
    <MobileDataCard
      title={test.testType}
      subtitle={test.testRequestNumber ? `Request ${test.testRequestNumber}` : undefined}
      status={{ label: statusLabel, variant: statusVariant }}
      className={overdue ? 'border-destructive' : undefined}
      fields={[
        {
          label: 'Result',
          value: (
            <span className="inline-flex items-center gap-1.5">
              {resultDisplay}
              {test.aiExtracted && (
                <span
                  className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded font-bold"
                  title="AI Extracted from certificate"
                >
                  AI
                </span>
              )}
            </span>
          ),
          priority: 'primary',
        },
        {
          label: 'Pass / Fail',
          value: (
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${statusColors[test.passFail] || 'bg-muted'}`}
            >
              {test.passFail}
            </span>
          ),
          priority: 'primary',
        },
        {
          label: 'Linked Lot',
          value: test.lot ? (
            <button
              type="button"
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
            '—'
          ),
          priority: 'primary',
        },
        {
          label: test.sampleDate ? 'Since sample' : 'Since request',
          value: overdue ? (
            <span className="text-destructive font-medium">{daysSince} days &middot; Overdue</span>
          ) : (
            `${daysSince} days`
          ),
          priority: 'primary',
        },
        {
          label: 'Laboratory',
          value: test.laboratoryName || '—',
          priority: 'secondary',
        },
      ]}
      actions={
        <div className="flex w-full flex-col gap-2">
          {nextStatus && (
            <Button
              size="lg"
              className="w-full"
              disabled={updatingStatusId === test.id}
              onClick={() => onUpdateStatus(test.id, nextStatus)}
            >
              {updatingStatusId === test.id ? 'Updating...' : nextStatusButtonLabels[test.status]}
            </Button>
          )}

          {test.status === 'entered' && (
            <Button
              variant="destructive"
              size="lg"
              className="w-full"
              onClick={() => onRejectTest(test.id)}
            >
              Reject
            </Button>
          )}

          {test.status === 'verified' && (
            <p className="flex items-center justify-center gap-1 text-sm font-medium text-muted-foreground">
              <Check className="h-4 w-4" />
              Complete
            </p>
          )}

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => generateTestResultCertificate(test, projectId)}
            aria-label={`Print test certificate for ${test.testType}`}
          >
            <Printer className="h-4 w-4" />
            Print Certificate
          </Button>
        </div>
      }
    />
  );
}
