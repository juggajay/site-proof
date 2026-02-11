import React from 'react'
import { X, Loader2, Brain, AlertTriangle, Info, XCircle, CheckCircle2 } from 'lucide-react'
import type { CompletenessData, CompletenessLot, CompletenessIssue } from '../types'
import { formatCurrency } from '../utils'

interface CompletenessCheckModalProps {
  loading: boolean
  data: CompletenessData | null
  onClose: () => void
  onExcludeLots: () => void
}

function LotIssueItem({ issue }: { issue: CompletenessIssue }) {
  return (
    <div className={`flex items-start gap-2 p-2 rounded text-sm ${
      issue.severity === 'critical' ? 'bg-red-100' :
      issue.severity === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
    }`}>
      {issue.severity === 'critical' && <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />}
      {issue.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />}
      {issue.severity === 'info' && <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />}
      <div>
        <div className={`font-medium ${
          issue.severity === 'critical' ? 'text-red-800' :
          issue.severity === 'warning' ? 'text-amber-800' : 'text-blue-800'
        }`}>{issue.message}</div>
        <div className={`text-xs mt-0.5 ${
          issue.severity === 'critical' ? 'text-red-700' :
          issue.severity === 'warning' ? 'text-amber-700' : 'text-blue-700'
        }`}>{issue.suggestion}</div>
      </div>
    </div>
  )
}

function LotAnalysisCard({ lot }: { lot: CompletenessLot }) {
  return (
    <div className={`rounded-lg border p-4 ${
      lot.recommendation === 'exclude' ? 'border-red-200 bg-red-50' :
      lot.recommendation === 'review' ? 'border-amber-200 bg-amber-50' :
      'border-green-200 bg-green-50'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{lot.lotNumber}</span>
            <span className="text-sm text-muted-foreground">{lot.activityType}</span>
            {lot.recommendation === 'include' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle2 className="h-3 w-3" /> Ready
              </span>
            )}
            {lot.recommendation === 'review' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                <AlertTriangle className="h-3 w-3" /> Review
              </span>
            )}
            {lot.recommendation === 'exclude' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <XCircle className="h-3 w-3" /> Exclude
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {formatCurrency(lot.claimAmount)}
          </div>
        </div>
        <div className={`text-2xl font-bold ${
          lot.completenessScore >= 80 ? 'text-green-600' :
          lot.completenessScore >= 60 ? 'text-amber-600' : 'text-red-600'
        }`}>
          {lot.completenessScore}%
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-2 mb-3 text-xs">
        <div className="text-center p-1 bg-white/50 rounded">
          <div className="font-medium">ITP</div>
          <div className="text-muted-foreground">{lot.summary.itpStatus}</div>
        </div>
        <div className="text-center p-1 bg-white/50 rounded">
          <div className="font-medium">Tests</div>
          <div className="text-muted-foreground">{lot.summary.testStatus}</div>
        </div>
        <div className="text-center p-1 bg-white/50 rounded">
          <div className="font-medium">Hold Points</div>
          <div className="text-muted-foreground">{lot.summary.holdPointStatus}</div>
        </div>
        <div className="text-center p-1 bg-white/50 rounded">
          <div className="font-medium">NCRs</div>
          <div className="text-muted-foreground">{lot.summary.ncrStatus}</div>
        </div>
        <div className="text-center p-1 bg-white/50 rounded">
          <div className="font-medium">Photos</div>
          <div className="text-muted-foreground">{lot.summary.photoCount}</div>
        </div>
      </div>

      {/* Issues */}
      {lot.issues.length > 0 && (
        <div className="space-y-2">
          {lot.issues.map((issue, index) => (
            <LotIssueItem key={index} issue={issue} />
          ))}
        </div>
      )}

      {lot.issues.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          This lot is complete and ready for claiming
        </div>
      )}
    </div>
  )
}

export const CompletenessCheckModal = React.memo(function CompletenessCheckModal({
  loading,
  data,
  onClose,
  onExcludeLots,
}: CompletenessCheckModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-semibold">AI Completeness Analysis</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600 mb-4" />
            <p className="text-muted-foreground">Analyzing claim completeness...</p>
            <p className="text-sm text-muted-foreground mt-1">Checking ITP completion, hold points, test results, NCRs, and evidence</p>
          </div>
        ) : data ? (
          <div className="p-6 space-y-6">
            {/* Summary Section */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border bg-card p-4 text-center">
                <div className={`text-3xl font-bold ${
                  data.summary.averageCompletenessScore >= 80 ? 'text-green-600' :
                  data.summary.averageCompletenessScore >= 60 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {data.summary.averageCompletenessScore}%
                </div>
                <p className="text-sm text-muted-foreground">Average Score</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <div className="flex justify-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle2 className="h-3 w-3" /> {data.summary.includeCount}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    <AlertTriangle className="h-3 w-3" /> {data.summary.reviewCount}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    <XCircle className="h-3 w-3" /> {data.summary.excludeCount}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Lot Status</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <div className="text-xl font-bold">{formatCurrency(data.summary.totalClaimAmount)}</div>
                <p className="text-sm text-muted-foreground">Total Claim</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <div className="text-xl font-bold text-green-600">{formatCurrency(data.summary.recommendedAmount)}</div>
                <p className="text-sm text-muted-foreground">Recommended</p>
              </div>
            </div>

            {/* Overall Suggestions */}
            {data.overallSuggestions.length > 0 && (
              <div className="rounded-lg border bg-purple-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-purple-900">AI Suggestions</span>
                </div>
                <ul className="space-y-1">
                  {data.overallSuggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-purple-800 flex items-start gap-2">
                      <span className="text-purple-400">&#8226;</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lot-by-Lot Analysis */}
            <div>
              <h3 className="font-semibold mb-3">Lot Analysis</h3>
              <div className="space-y-3">
                {data.lots.map((lot) => (
                  <LotAnalysisCard key={lot.lotId} lot={lot} />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-background">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Close
          </button>
          {data && data.summary.excludeCount > 0 && (
            <button
              onClick={onExcludeLots}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Exclude Problem Lots
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
