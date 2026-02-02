import { FileText } from 'lucide-react'
import type { Lot, ConformStatus, LotTab } from '../types'
import type { ConformanceFormat } from '@/lib/pdfGenerator'
import { ConformanceReportModal } from './ConformanceReportModal'

interface QualityManagementSectionProps {
  lot: Lot
  conformStatus: ConformStatus | null
  loadingConformStatus: boolean
  canConformLots: boolean
  canVerifyTestResults: boolean
  conforming: boolean
  generatingReport: boolean
  showReportFormatDialog: boolean
  selectedReportFormat: ConformanceFormat
  onConformLot: () => void
  onTabChange: (tab: LotTab) => void
  onShowReportDialog: () => void
  onGenerateReport: () => void
  onCloseReportDialog: () => void
  onReportFormatChange: (format: ConformanceFormat) => void
}

export function QualityManagementSection({
  lot,
  conformStatus,
  loadingConformStatus,
  canConformLots,
  canVerifyTestResults,
  conforming,
  generatingReport,
  showReportFormatDialog,
  selectedReportFormat,
  onConformLot,
  onTabChange,
  onShowReportDialog,
  onGenerateReport,
  onCloseReportDialog,
  onReportFormatChange,
}: QualityManagementSectionProps) {
  const isConformedOrClaimed = lot.status === 'conformed' || lot.status === 'claimed'
  const canShowConformSection = canConformLots && lot.status !== 'conformed' && lot.status !== 'claimed'

  return (
    <>
      {/* Quality Management Actions - Pre-conformance */}
      {canShowConformSection && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <h2 className="text-lg font-semibold text-green-800 mb-2">Quality Management</h2>
          <p className="text-sm text-green-700 mb-4">
            As a quality manager, you can conform this lot once all requirements are met.
          </p>

          {/* Conformance Prerequisites Checklist */}
          {loadingConformStatus ? (
            <div className="flex items-center gap-2 mb-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              <span className="text-sm text-green-700">Loading prerequisites...</span>
            </div>
          ) : conformStatus ? (
            <div className="mb-4 space-y-2">
              <h3 className="text-sm font-medium text-green-800 mb-2">Prerequisites:</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.itpAssigned ? 'text-green-700' : 'text-red-600'}>
                    {conformStatus.prerequisites.itpAssigned ? '\u2713' : '\u2717'}
                  </span>
                  <span className={conformStatus.prerequisites.itpAssigned ? 'text-green-700' : 'text-red-700'}>
                    ITP Assigned
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.itpCompleted ? 'text-green-700' : 'text-red-600'}>
                    {conformStatus.prerequisites.itpCompleted ? '\u2713' : '\u2717'}
                  </span>
                  <span className={conformStatus.prerequisites.itpCompleted ? 'text-green-700' : 'text-red-700'}>
                    ITP Completed ({conformStatus.prerequisites.itpCompletedCount}/{conformStatus.prerequisites.itpTotalCount} items)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.hasPassingTest ? 'text-green-700' : 'text-red-600'}>
                    {conformStatus.prerequisites.hasPassingTest ? '\u2713' : '\u2717'}
                  </span>
                  <span className={conformStatus.prerequisites.hasPassingTest ? 'text-green-700' : 'text-red-700'}>
                    Passing Verified Test Result
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.noOpenNcrs ? 'text-green-700' : 'text-red-600'}>
                    {conformStatus.prerequisites.noOpenNcrs ? '\u2713' : '\u2717'}
                  </span>
                  <span className={conformStatus.prerequisites.noOpenNcrs ? 'text-green-700' : 'text-red-700'}>
                    No Open NCRs
                    {!conformStatus.prerequisites.noOpenNcrs && conformStatus.prerequisites.openNcrs.length > 0 && (
                      <span className="text-red-600 ml-1">
                        ({conformStatus.prerequisites.openNcrs.map(n => n.ncrNumber).join(', ')})
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {!conformStatus.canConform && conformStatus.blockingReasons.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-1">Cannot conform lot:</p>
                  <ul className="list-disc list-inside text-sm text-red-700">
                    {conformStatus.blockingReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex gap-4">
            <button
              onClick={onConformLot}
              disabled={conforming || (conformStatus !== null && !conformStatus.canConform)}
              className={`rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${
                conformStatus?.canConform
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {conforming ? 'Conforming...' : 'Conform Lot'}
            </button>
            {canVerifyTestResults && (
              <button
                onClick={() => onTabChange('tests')}
                className="rounded-lg border border-green-700 px-4 py-2 text-sm text-green-700 hover:bg-green-100"
              >
                Verify Test Results
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conformed Status Display (also show for claimed lots as they were previously conformed) */}
      {isConformedOrClaimed && (
        <div className={`mt-6 rounded-lg border p-4 ${lot.status === 'claimed' ? 'border-blue-400 bg-blue-100' : 'border-green-400 bg-green-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{lot.status === 'claimed' ? '\uD83D\uDCB0' : '\u2705'}</span>
              <div>
                <h2 className={`text-lg font-semibold ${lot.status === 'claimed' ? 'text-blue-800' : 'text-green-800'}`}>
                  {lot.status === 'claimed' ? 'Lot Claimed' : 'Lot Conformed'}
                </h2>
                <p className={`text-sm ${lot.status === 'claimed' ? 'text-blue-700' : 'text-green-700'}`}>
                  {lot.status === 'claimed'
                    ? 'This lot has been included in a progress claim.'
                    : 'This lot has been quality-approved and is ready for claiming.'}
                </p>
                {/* Conformance Details */}
                {(lot.conformedAt || lot.conformedBy) && (
                  <div className={`mt-2 pt-2 border-t ${lot.status === 'claimed' ? 'border-blue-300' : 'border-green-300'}`}>
                    <div className={`flex flex-wrap gap-4 text-sm ${lot.status === 'claimed' ? 'text-blue-700' : 'text-green-700'}`}>
                      {lot.conformedBy && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Conformed by:</span>
                          <span>{lot.conformedBy.fullName || lot.conformedBy.email}</span>
                        </div>
                      )}
                      {lot.conformedAt && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Conformed on:</span>
                          <time dateTime={lot.conformedAt} title={new Date(lot.conformedAt).toISOString()}>
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
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  )
}
