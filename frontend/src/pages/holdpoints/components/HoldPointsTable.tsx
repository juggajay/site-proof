import React, { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Link2, Check, Download, RefreshCw, ClipboardCheck } from 'lucide-react'
import type { HoldPoint, StatusFilter } from '../types'

/** Check if HP is overdue (Feature #190) */
export function isOverdue(hp: HoldPoint): boolean {
  if (hp.status !== 'notified') return false
  if (!hp.scheduledDate) return false
  const scheduled = new Date(hp.scheduledDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return scheduled < today
}

export function getStatusBadge(status: string): string {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    notified: 'bg-amber-100 text-amber-800',
    released: 'bg-green-100 text-green-800',
  }
  return styles[status] || styles.pending
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    notified: 'Awaiting Release',
    released: 'Released',
  }
  return labels[status] || status
}

interface HoldPointsTableProps {
  holdPoints: HoldPoint[]
  filteredHoldPoints: HoldPoint[]
  loading: boolean
  statusFilter: StatusFilter
  copiedHpId: string | null
  generatingPdf: string | null
  chasingHpId: string | null
  onCopyLink: (hpId: string, lotNumber: string, description: string) => void
  onRequestRelease: (hp: HoldPoint) => void
  onRecordRelease: (hp: HoldPoint) => void
  onChase: (hp: HoldPoint) => void
  onGenerateEvidence: (hp: HoldPoint) => void
  onClearFilter: () => void
}

export const HoldPointsTable = React.memo(function HoldPointsTable({
  holdPoints,
  filteredHoldPoints,
  loading,
  statusFilter,
  copiedHpId,
  generatingPdf,
  chasingHpId,
  onCopyLink,
  onRequestRelease,
  onRecordRelease,
  onChase,
  onGenerateEvidence,
  onClearFilter,
}: HoldPointsTableProps) {
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (holdPoints.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <div className="text-4xl mb-4">&#x1f512;</div>
        <h3 className="text-lg font-semibold mb-2">No Hold Points</h3>
        <p className="text-muted-foreground mb-4">
          Hold points are created when ITPs with hold point items are assigned to lots.
          Create an ITP template with hold point items and assign it to a lot to see hold points here.
        </p>
      </div>
    )
  }

  if (filteredHoldPoints.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <div className="text-4xl mb-4">&#x1f50d;</div>
        <h3 className="text-lg font-semibold mb-2">No Hold Points Match Filter</h3>
        <p className="text-muted-foreground mb-4">
          No hold points with status &quot;{getStatusLabel(statusFilter)}&quot; found.
          Try selecting a different status filter.
        </p>
        <button
          onClick={onClearFilter}
          className="text-primary hover:underline"
        >
          Show all hold points
        </button>
      </div>
    )
  }

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: filteredHoldPoints.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  })

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Lot</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Scheduled</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Released</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
      </table>
      <div ref={parentRef} style={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const hp = filteredHoldPoints[virtualRow.index]
            return (
              <div
                key={virtualRow.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <table className="w-full">
                  <tbody>
                    <HoldPointRow
                      hp={hp}
                      copiedHpId={copiedHpId}
                      generatingPdf={generatingPdf}
                      chasingHpId={chasingHpId}
                      onCopyLink={onCopyLink}
                      onRequestRelease={onRequestRelease}
                      onRecordRelease={onRecordRelease}
                      onChase={onChase}
                      onGenerateEvidence={onGenerateEvidence}
                    />
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

interface HoldPointRowProps {
  hp: HoldPoint
  copiedHpId: string | null
  generatingPdf: string | null
  chasingHpId: string | null
  onCopyLink: (hpId: string, lotNumber: string, description: string) => void
  onRequestRelease: (hp: HoldPoint) => void
  onRecordRelease: (hp: HoldPoint) => void
  onChase: (hp: HoldPoint) => void
  onGenerateEvidence: (hp: HoldPoint) => void
}

function HoldPointRow({
  hp,
  copiedHpId,
  generatingPdf,
  chasingHpId,
  onCopyLink,
  onRequestRelease,
  onRecordRelease,
  onChase,
  onGenerateEvidence,
}: HoldPointRowProps) {
  const overdue = isOverdue(hp)

  return (
    <tr className={`hover:bg-muted/25 ${overdue ? 'bg-red-50 border-l-4 border-l-red-500' : ''}`}>
      <td className="px-4 py-3 font-medium">
        {hp.lotNumber}
        {overdue && (
          <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded font-normal">
            OVERDUE
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="max-w-md truncate">{hp.description}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(hp.status)}`}>
          {getStatusLabel(hp.status)}
        </span>
      </td>
      <td className={`px-4 py-3 text-sm ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
        {hp.scheduledDate
          ? new Date(hp.scheduledDate).toLocaleDateString()
          : '-'}
      </td>
      <td className="px-4 py-3 text-sm">
        {hp.releasedAt ? (
          <div>
            <div>{new Date(hp.releasedAt).toLocaleDateString()}</div>
            {hp.releasedByName && (
              <div className="text-xs text-muted-foreground">{hp.releasedByName}</div>
            )}
          </div>
        ) : (
          '-'
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCopyLink(hp.id, hp.lotNumber, hp.description)}
            className="p-1.5 border rounded hover:bg-muted/50 transition-colors"
            title="Copy link to this hold point"
          >
            {copiedHpId === hp.id ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
          </button>
          {hp.status === 'pending' && (
            <button
              onClick={() => onRequestRelease(hp)}
              className="text-sm text-primary hover:underline"
            >
              Request Release
            </button>
          )}
          {hp.status === 'notified' && (
            <>
              <span className="text-sm text-amber-600">Awaiting...</span>
              {!hp.id.startsWith('virtual-') && (
                <>
                  <button
                    onClick={() => onRecordRelease(hp)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
                    title="Record hold point release"
                  >
                    <ClipboardCheck className="h-3 w-3" />
                    <span>Record Release</span>
                  </button>
                  <button
                    onClick={() => onChase(hp)}
                    disabled={chasingHpId === hp.id}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send follow-up notification"
                  >
                    {chasingHpId === hp.id ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Chasing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3" />
                        <span>Chase</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </>
          )}
          {hp.status === 'released' && (
            <>
              <span className="text-sm text-green-600">&#x2713; Released</span>
              {!hp.id.startsWith('virtual-') && (
                <button
                  onClick={() => onGenerateEvidence(hp)}
                  disabled={generatingPdf === hp.id}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Generate Evidence Package PDF"
                >
                  {generatingPdf === hp.id ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3 w-3" />
                      <span>Evidence PDF</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
