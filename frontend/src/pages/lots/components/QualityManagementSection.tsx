import { AlertTriangle, FileText } from 'lucide-react';
import type { Lot, ConformStatus, LotTab } from '../types';
import type { ConformanceFormat } from '@/lib/pdfGenerator';
import { ConformanceReportModal } from './ConformanceReportModal';

interface QualityManagementSectionProps {
  lot: Lot;
  conformStatus: ConformStatus | null;
  loadingConformStatus: boolean;
  canConformLots: boolean;
  canForceConformLots: boolean;
  canVerifyTestResults: boolean;
  conforming: boolean;
  generatingReport: boolean;
  showReportFormatDialog: boolean;
  selectedReportFormat: ConformanceFormat;
  onConformLot: () => void;
  onForceConformLot: () => void;
  onTabChange: (tab: LotTab) => void;
  onShowReportDialog: () => void;
  onGenerateReport: () => void;
  onCloseReportDialog: () => void;
  onReportFormatChange: (format: ConformanceFormat) => void;
}

export function QualityManagementSection({
  lot,
  conformStatus,
  loadingConformStatus,
  canConformLots,
  canForceConformLots,
  canVerifyTestResults,
  conforming,
  generatingReport,
  showReportFormatDialog,
  selectedReportFormat,
  onConformLot,
  onForceConformLot,
  onTabChange,
  onShowReportDialog,
  onGenerateReport,
  onCloseReportDialog,
  onReportFormatChange,
}: QualityManagementSectionProps) {
  const isConformedOrClaimed = lot.status === 'conformed' || lot.status === 'claimed';
  const canShowConformSection =
    canConformLots && lot.status !== 'conformed' && lot.status !== 'claimed';
  const canForceConformBlockedLot =
    canForceConformLots && conformStatus !== null && !conformStatus.canConform;

  return (
    <>
      {/* Quality Management Actions - Pre-conformance */}
      {canShowConformSection && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-semibold text-foreground mb-2">Quality Management</h2>
          <p className="text-sm text-muted-foreground mb-4">
            As a quality manager, you can conform this lot once all requirements are met.
          </p>

          {/* Conformance Prerequisites Checklist */}
          {loadingConformStatus ? (
            <div className="flex items-center gap-2 mb-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              <span className="text-sm text-muted-foreground">Loading prerequisites...</span>
            </div>
          ) : conformStatus ? (
            <div className="mb-4 space-y-2">
              <h3 className="text-sm font-medium text-foreground mb-2">Prerequisites:</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      conformStatus.prerequisites.itpAssigned ? 'text-success' : 'text-destructive'
                    }
                  >
                    {conformStatus.prerequisites.itpAssigned ? '\u2713' : '\u2717'}
                  </span>
                  <span
                    className={
                      conformStatus.prerequisites.itpAssigned
                        ? 'text-muted-foreground'
                        : 'text-destructive'
                    }
                  >
                    ITP Assigned
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      conformStatus.prerequisites.itpCompleted ? 'text-success' : 'text-destructive'
                    }
                  >
                    {conformStatus.prerequisites.itpCompleted ? '\u2713' : '\u2717'}
                  </span>
                  <span
                    className={
                      conformStatus.prerequisites.itpCompleted
                        ? 'text-muted-foreground'
                        : 'text-destructive'
                    }
                  >
                    ITP Completed ({conformStatus.prerequisites.itpCompletedCount}/
                    {conformStatus.prerequisites.itpTotalCount} items)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      conformStatus.prerequisites.hasPassingTest
                        ? 'text-success'
                        : 'text-destructive'
                    }
                  >
                    {conformStatus.prerequisites.hasPassingTest ? '\u2713' : '\u2717'}
                  </span>
                  <span
                    className={
                      conformStatus.prerequisites.hasPassingTest
                        ? 'text-muted-foreground'
                        : 'text-destructive'
                    }
                  >
                    Passing Verified Test Result
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      conformStatus.prerequisites.noOpenNcrs ? 'text-success' : 'text-destructive'
                    }
                  >
                    {conformStatus.prerequisites.noOpenNcrs ? '\u2713' : '\u2717'}
                  </span>
                  <span
                    className={
                      conformStatus.prerequisites.noOpenNcrs
                        ? 'text-muted-foreground'
                        : 'text-destructive'
                    }
                  >
                    No Open NCRs
                    {!conformStatus.prerequisites.noOpenNcrs &&
                      conformStatus.prerequisites.openNcrs.length > 0 && (
                        <span className="text-destructive ml-1">
                          ({conformStatus.prerequisites.openNcrs.map((n) => n.ncrNumber).join(', ')}
                          )
                        </span>
                      )}
                  </span>
                </div>
              </div>
              {!conformStatus.canConform && conformStatus.blockingReasons.length > 0 && (
                <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-1">Cannot conform lot:</p>
                  <ul className="list-disc list-inside text-sm text-destructive">
                    {conformStatus.blockingReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              {canForceConformBlockedLot && (
                <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                    <div>
                      <p className="font-medium">Admin override available</p>
                      <p>
                        Force conformance bypasses incomplete prerequisites and records the override
                        in the audit trail.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-4">
            <button
              onClick={onConformLot}
              disabled={conforming || (conformStatus !== null && !conformStatus.canConform)}
              className={`rounded-lg px-4 py-2 text-sm disabled:opacity-50 ${
                conformStatus?.canConform
                  ? 'bg-success text-success-foreground hover:bg-success/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {conforming ? 'Conforming...' : 'Conform Lot'}
            </button>
            {canForceConformBlockedLot && (
              <button
                onClick={onForceConformLot}
                disabled={conforming}
                className="rounded-lg border border-warning px-4 py-2 text-sm font-medium text-warning hover:bg-warning/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {conforming ? 'Conforming...' : 'Force Conform Lot'}
              </button>
            )}
            {canVerifyTestResults && (
              <button
                onClick={() => onTabChange('tests')}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                Verify Test Results
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conformed Status Display (also show for claimed lots as they were previously conformed) */}
      {isConformedOrClaimed && (
        <div
          className={`mt-6 rounded-lg border p-4 ${lot.status === 'claimed' ? 'border-border bg-muted' : 'border-success/30 bg-success/10'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {lot.status === 'claimed' ? '\uD83D\uDCB0' : '\u2705'}
              </span>
              <div>
                <h2
                  className={`text-lg font-semibold ${lot.status === 'claimed' ? 'text-foreground' : 'text-success'}`}
                >
                  {lot.status === 'claimed' ? 'Lot Claimed' : 'Lot Conformed'}
                </h2>
                <p
                  className={`text-sm ${lot.status === 'claimed' ? 'text-muted-foreground' : 'text-success'}`}
                >
                  {lot.status === 'claimed'
                    ? 'This lot has been included in a progress claim.'
                    : 'This lot has been quality-approved and is ready for claiming.'}
                </p>
                {/* Conformance Details */}
                {(lot.conformedAt || lot.conformedBy) && (
                  <div
                    className={`mt-2 pt-2 border-t ${lot.status === 'claimed' ? 'border-border' : 'border-success/30'}`}
                  >
                    <div
                      className={`flex flex-wrap gap-4 text-sm ${lot.status === 'claimed' ? 'text-muted-foreground' : 'text-success'}`}
                    >
                      {lot.conformedBy && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Conformed by:</span>
                          <span>{lot.conformedBy.fullName || lot.conformedBy.email}</span>
                        </div>
                      )}
                      {lot.conformedAt && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Conformed on:</span>
                          <time
                            dateTime={lot.conformedAt}
                            title={new Date(lot.conformedAt).toISOString()}
                          >
                            {new Date(lot.conformedAt).toLocaleString('en-AU', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </time>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Generate Conformance Report Button */}
            <button
              onClick={onShowReportDialog}
              disabled={generatingReport}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FileText className="h-4 w-4" />
              {generatingReport ? 'Generating...' : 'Generate Conformance Report'}
            </button>
          </div>
        </div>
      )}

      {/* Conformance Report Format Selection Modal */}
      <ConformanceReportModal
        isOpen={showReportFormatDialog}
        selectedFormat={selectedReportFormat}
        onFormatChange={onReportFormatChange}
        onGenerate={onGenerateReport}
        onClose={onCloseReportDialog}
      />
    </>
  );
}
