import { memo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Link2, Check, Printer } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { generateNCRDetailPDF, NCRDetailData } from '@/lib/pdfGenerator'
import { getStatusBadgeColor } from '../constants'
import type { NCR, UserRole } from '../types'

interface NCRTableProps {
  ncrs: NCR[]
  userRole: UserRole | null
  actionLoading: boolean
  copiedNcrId: string | null
  onCopyLink: (ncrId: string, ncrNumber: string) => void
  onRespond: (ncr: NCR) => void
  onReviewResponse: (ncr: NCR) => void
  onQmApprove: (ncrId: string) => void
  onNotifyClient: (ncr: NCR) => void
  onRectify: (ncr: NCR) => void
  onRejectRectification: (ncr: NCR) => void
  onClose: (ncr: NCR) => void
  onConcession: (ncr: NCR) => void
}

function NCRTableInner({
  ncrs,
  userRole,
  actionLoading,
  copiedNcrId,
  onCopyLink,
  onRespond,
  onReviewResponse,
  onQmApprove,
  onNotifyClient,
  onRectify,
  onRejectRectification,
  onClose,
  onConcession,
}: NCRTableProps) {
  const handlePrintPdf = (ncr: NCR) => {
    const pdfData: NCRDetailData = {
      ncr: {
        ncrNumber: ncr.ncrNumber,
        description: ncr.description,
        category: ncr.category,
        severity: ncr.severity,
        status: ncr.status,
        qmApprovalRequired: ncr.qmApprovalRequired,
        qmApprovedAt: ncr.qmApprovedAt,
        qmApprovedBy: ncr.qmApprovedBy,
        raisedBy: ncr.raisedBy,
        responsibleUser: ncr.responsibleUser,
        dueDate: ncr.dueDate,
        createdAt: ncr.createdAt,
      },
      project: {
        name: ncr.project?.name || 'Unknown Project',
        projectNumber: ncr.project?.projectNumber || 'N/A',
      },
      lots: ncr.ncrLots?.map(nl => ({
        lotNumber: nl.lot.lotNumber,
        description: nl.lot.description || null,
      })) || [],
    }

    try {
      generateNCRDetailPDF(pdfData)
      toast({
        title: 'PDF Generated',
        description: `NCR ${ncr.ncrNumber} PDF downloaded successfully`,
      })
    } catch (error) {
      console.error('Error generating NCR PDF:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate NCR PDF',
        variant: 'error',
      })
    }
  }

  // Row virtualizer
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: ncrs.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 52, // estimated row height in px
    overscan: 5,
  })

  return (
    <div
      ref={scrollContainerRef}
      className="bg-card rounded-lg border overflow-auto"
      style={{ maxHeight: 'calc(100vh - 300px)' }}
    >
      <table className="w-full">
        <thead className="bg-muted/50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">NCR #</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Lots</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Responsible</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Due</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Age</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ncrs.length > 0 && rowVirtualizer.getVirtualItems().length > 0 && (
            <tr>
              <td
                colSpan={9}
                style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px`, padding: 0, border: 'none' }}
              />
            </tr>
          )}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const ncr = ncrs[virtualRow.index]
            if (!ncr) return null
            const ageInDays = Math.floor((Date.now() - new Date(ncr.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            const isOverdue = ncr.dueDate && new Date(ncr.dueDate) < new Date() && ncr.status !== 'closed' && ncr.status !== 'closed_concession'

            return (
              <tr
                key={ncr.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="hover:bg-muted/50"
              >
                <td className="px-4 py-3 font-mono text-sm">{ncr.ncrNumber}</td>
                <td className="px-4 py-3 text-sm">
                  {ncr.ncrLots.length > 0 ? (
                    <span className="text-muted-foreground">
                      {ncr.ncrLots.map(nl => nl.lot.lotNumber).join(', ')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-xs truncate" title={ncr.description}>{ncr.description}</div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="capitalize">{ncr.category.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(ncr.status)}`}>
                    {ncr.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {ncr.responsibleUser ? (
                    ncr.responsibleUser.fullName || ncr.responsibleUser.email
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {ncr.dueDate ? (
                    <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                      {new Date(ncr.dueDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={ageInDays > 14 ? 'text-amber-600 font-medium' : ''}>
                    {ageInDays}d
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {/* Copy Link Button */}
                    <button
                      onClick={() => onCopyLink(ncr.id, ncr.ncrNumber)}
                      className="p-1.5 text-xs border rounded hover:bg-muted/50 transition-colors"
                      title="Copy link to this NCR"
                    >
                      {copiedNcrId === ncr.id ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {/* Print NCR Button */}
                    <button
                      onClick={() => handlePrintPdf(ncr)}
                      className="p-1.5 text-xs border rounded hover:bg-muted/50 transition-colors print:hidden"
                      title="Print NCR details"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    {/* Respond Button for open NCRs */}
                    {ncr.status === 'open' && (
                      <button
                        onClick={() => onRespond(ncr)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                      >
                        Respond
                      </button>
                    )}

                    {/* QM Review Button for NCRs in investigating status */}
                    {ncr.status === 'investigating' &&
                     (userRole?.isQualityManager || userRole?.role === 'project_manager' || userRole?.role === 'admin') && (
                      <button
                        onClick={() => onReviewResponse(ncr)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50"
                        title="Review the submitted response"
                      >
                        Review Response
                      </button>
                    )}

                    {/* QM Approval Button for major NCRs */}
                    {ncr.severity === 'major' &&
                     !ncr.qmApprovedAt &&
                     ncr.status === 'verification' &&
                     userRole?.isQualityManager && (
                      <button
                        onClick={() => onQmApprove(ncr.id)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                      >
                        QM Approve
                      </button>
                    )}

                    {/* Notify Client Button for major NCRs */}
                    {ncr.severity === 'major' &&
                     ncr.clientNotificationRequired &&
                     !ncr.clientNotifiedAt &&
                     (userRole?.role === 'project_manager' || userRole?.role === 'quality_manager' || userRole?.role === 'admin' || userRole?.role === 'owner') && (
                      <button
                        onClick={() => onNotifyClient(ncr)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                        title="Notify client about this major NCR"
                      >
                        Notify Client
                      </button>
                    )}

                    {/* Client Notified Badge */}
                    {ncr.clientNotifiedAt && (
                      <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 rounded" title={`Client notified on ${new Date(ncr.clientNotifiedAt).toLocaleDateString()}`}>
                        ✓ Client Notified
                      </span>
                    )}

                    {/* Rectify Button */}
                    {(ncr.status === 'investigating' || ncr.status === 'rectification') && (
                      <button
                        onClick={() => onRectify(ncr)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Submit Rectification
                      </button>
                    )}

                    {/* Reject Rectification Button */}
                    {ncr.status === 'verification' &&
                     (userRole?.isQualityManager || userRole?.role === 'project_manager' || userRole?.role === 'admin') && (
                      <button
                        onClick={() => onRejectRectification(ncr)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        title="Reject rectification and return to responsible party"
                      >
                        Reject
                      </button>
                    )}

                    {/* Close Button */}
                    {ncr.status === 'verification' && (
                      <button
                        onClick={() => onClose(ncr)}
                        disabled={actionLoading || (ncr.severity === 'major' && !ncr.qmApprovedAt)}
                        className={`px-3 py-1 text-xs rounded disabled:opacity-50 ${
                          ncr.severity === 'major' && !ncr.qmApprovedAt
                            ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                        title={ncr.severity === 'major' && !ncr.qmApprovedAt ? 'Requires QM approval first' : 'Close NCR'}
                      >
                        Close
                      </button>
                    )}

                    {/* Close with Concession Button */}
                    {(ncr.status === 'verification' || ncr.status === 'rectification') && (
                      <button
                        onClick={() => onConcession(ncr)}
                        disabled={actionLoading || (ncr.severity === 'major' && !ncr.qmApprovedAt)}
                        className={`px-3 py-1 text-xs rounded disabled:opacity-50 ${
                          ncr.severity === 'major' && !ncr.qmApprovedAt
                            ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                            : 'bg-amber-600 text-white hover:bg-amber-700'
                        }`}
                        title={ncr.severity === 'major' && !ncr.qmApprovedAt ? 'Requires QM approval first' : 'Close with concession when full rectification is not possible'}
                      >
                        Concession
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
          {ncrs.length > 0 && rowVirtualizer.getVirtualItems().length > 0 && (
            <tr>
              <td
                colSpan={9}
                style={{
                  height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0)}px`,
                  padding: 0,
                  border: 'none',
                }}
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export const NCRTable = memo(NCRTableInner)
