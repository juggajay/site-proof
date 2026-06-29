import { memo, useEffect, useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Link2, Check, Printer } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { getStatusBadgeColor } from '../constants';
import { buildNcrDetailPdfData } from '../ncrDetailPdfData';
import { getAvailableNcrActions } from '../ncrActions';
import type { NcrSortDirection, NcrSortField } from '../ncrRegisterSort';
import type { NCR, UserRole } from '../types';
import { logError } from '@/lib/logger';
import { formatStatusLabel } from '@/lib/statusLabels';

interface NCRTableProps {
  ncrs: NCR[];
  userRole: UserRole | null;
  currentUserId?: string | null;
  actionLoading: boolean;
  copiedNcrId: string | null;
  /** Deep-linked NCR (?ncr=<id>) to scroll to and highlight. */
  highlightedNcrId: string | null;
  /** Active `?sort=` column ('' when the register keeps the server order). */
  sortField: string;
  sortDirection: NcrSortDirection;
  onSort: (field: NcrSortField) => void;
  onCopyLink: (ncrId: string, ncrNumber: string) => void;
  onAssign: (ncr: NCR) => void;
  onRespond: (ncr: NCR) => void;
  onReviewResponse: (ncr: NCR) => void;
  onQmApprove: (ncrId: string) => void;
  onNotifyClient: (ncr: NCR) => void;
  onRectify: (ncr: NCR) => void;
  onRejectRectification: (ncr: NCR) => void;
  onClose: (ncr: NCR) => void;
  onConcession: (ncr: NCR) => void;
}

function NCRTableInner({
  ncrs,
  userRole,
  currentUserId,
  actionLoading,
  copiedNcrId,
  highlightedNcrId,
  sortField,
  sortDirection,
  onSort,
  onCopyLink,
  onAssign,
  onRespond,
  onReviewResponse,
  onQmApprove,
  onNotifyClient,
  onRectify,
  onRejectRectification,
  onClose,
  onConcession,
}: NCRTableProps) {
  const handlePrintPdf = async (ncr: NCR) => {
    const pdfData = buildNcrDetailPdfData(ncr);

    try {
      const { generateNCRDetailPDF } = await import('@/lib/pdfGenerator');
      await generateNCRDetailPDF(pdfData);
      toast({
        title: 'PDF Generated',
        description: `NCR ${ncr.ncrNumber} PDF downloaded successfully`,
      });
    } catch (error) {
      logError('Error generating NCR PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate NCR PDF',
        variant: 'error',
      });
    }
  };

  // Assign/reassign is restricted to NCR management roles, mirroring the
  // backend PATCH /api/ncrs/:id gate.
  const canAssign =
    userRole?.isQualityManager === true ||
    (userRole?.role !== undefined &&
      ['project_manager', 'admin', 'owner', 'site_manager', 'quality_manager'].includes(
        userRole.role,
      ));

  // Row virtualizer
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: ncrs.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 52, // estimated row height in px
    overscan: 5,
  });

  // Scroll the deep-linked NCR into view while its highlight pulse is active.
  useEffect(() => {
    if (!highlightedNcrId) return;
    const index = ncrs.findIndex((ncr) => ncr.id === highlightedNcrId);
    if (index >= 0) rowVirtualizer.scrollToIndex(index, { align: 'center' });
  }, [highlightedNcrId, ncrs, rowVirtualizer]);

  // Sortable column header (same affordance as the lot register).
  const renderSortableHeader = (field: NcrSortField, children: ReactNode) => (
    <th
      className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/70 select-none group"
      aria-sort={
        sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined
      }
      onClick={() => onSort(field)}
      data-testid={`ncr-column-header-${field}`}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="text-muted-foreground">
          {sortField === field ? (
            sortDirection === 'asc' ? (
              '↑'
            ) : (
              '↓'
            )
          ) : (
            <span className="opacity-0 group-hover:opacity-50">{'↕'}</span>
          )}
        </span>
      </div>
    </th>
  );

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
            {renderSortableHeader('severity', 'Severity')}
            {renderSortableHeader('status', 'Status')}
            <th className="px-4 py-3 text-left text-sm font-medium">Responsible</th>
            {renderSortableHeader('due', 'Due')}
            {renderSortableHeader('raised', 'Age')}
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ncrs.length > 0 && rowVirtualizer.getVirtualItems().length > 0 && (
            <tr>
              <td
                colSpan={10}
                style={{
                  height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px`,
                  padding: 0,
                  border: 'none',
                }}
              />
            </tr>
          )}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const ncr = ncrs[virtualRow.index];
            if (!ncr) return null;
            const actions = getAvailableNcrActions(ncr, userRole, currentUserId);
            const closeBlocked =
              actions.closeBlockedPendingQmApproval || actions.closeBlockedSameQmApprover;
            const closeBlockedTitle = actions.closeBlockedPendingQmApproval
              ? 'Requires QM approval first'
              : actions.closeBlockedSameQmApprover
                ? 'A different user must close after QM approval'
                : undefined;
            const ageInDays = Math.floor(
              (Date.now() - new Date(ncr.createdAt).getTime()) / (1000 * 60 * 60 * 24),
            );
            const isOverdue =
              ncr.dueDate &&
              new Date(ncr.dueDate) < new Date() &&
              ncr.status !== 'closed' &&
              ncr.status !== 'closed_concession';

            return (
              <tr
                key={ncr.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={`hover:bg-muted/50 ${ncr.id === highlightedNcrId ? 'bg-primary/10' : ''}`}
                data-deep-linked={ncr.id === highlightedNcrId ? 'true' : undefined}
              >
                <td className="px-4 py-3 font-mono text-sm">{ncr.ncrNumber}</td>
                <td className="px-4 py-3 text-sm">
                  {ncr.ncrLots.length > 0 ? (
                    <span className="text-muted-foreground">
                      {ncr.ncrLots.map((nl) => nl.lot.lotNumber).join(', ')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-xs truncate" title={ncr.description}>
                    {ncr.description}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="capitalize">{ncr.category.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`capitalize ${ncr.severity === 'major' ? 'text-destructive font-medium' : ''}`}
                  >
                    {ncr.severity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(ncr.status)}`}
                  >
                    {formatStatusLabel(ncr.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {ncr.responsibleUser ? (
                    ncr.responsibleUser.fullName || ncr.responsibleUser.email
                  ) : ncr.responsibleSubcontractor ? (
                    ncr.responsibleSubcontractor.companyName
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {ncr.dueDate ? (
                    <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                      {new Date(ncr.dueDate).toLocaleDateString('en-AU')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={ageInDays > 14 ? 'text-warning font-medium' : ''}>
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
                      aria-label={`Copy link to NCR ${ncr.ncrNumber}`}
                    >
                      {copiedNcrId === ncr.id ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {/* Print NCR Button */}
                    <button
                      onClick={() => void handlePrintPdf(ncr)}
                      className="p-1.5 text-xs border rounded hover:bg-muted/50 transition-colors print:hidden"
                      title="Print NCR details"
                      aria-label={`Print NCR ${ncr.ncrNumber}`}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    {/* Assign / Reassign Button (management roles) */}
                    {canAssign && (
                      <button
                        onClick={() => onAssign(ncr)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs border rounded hover:bg-muted/50 disabled:opacity-50"
                        title="Assign or reassign this NCR"
                      >
                        {ncr.responsibleUser || ncr.responsibleSubcontractor
                          ? 'Reassign'
                          : 'Assign'}
                      </button>
                    )}
                    {/* Respond Button for open NCRs */}
                    {actions.respond && (
                      <button
                        onClick={() => onRespond(ncr)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                      >
                        Respond
                      </button>
                    )}

                    {/* QM Review Button for NCRs in investigating status */}
                    {actions.reviewResponse && (
                      <button
                        onClick={() => onReviewResponse(ncr)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                        title="Review the submitted response"
                      >
                        Review Response
                      </button>
                    )}

                    {/* QM Approval Button for major NCRs */}
                    {actions.qmApprove && (
                      <button
                        onClick={() => onQmApprove(ncr.id)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                      >
                        QM Approve
                      </button>
                    )}

                    {/* Notify Client Button for major NCRs */}
                    {actions.notifyClient && (
                      <button
                        onClick={() => onNotifyClient(ncr)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                        title="Notify client about this major NCR"
                      >
                        Notify Client
                      </button>
                    )}

                    {/* Client Notified Badge */}
                    {ncr.clientNotifiedAt && (
                      <span
                        className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded"
                        title={`Client notified on ${new Date(ncr.clientNotifiedAt).toLocaleDateString('en-AU')}`}
                      >
                        ✓ Client Notified
                      </span>
                    )}

                    {/* Rectify Button */}
                    {actions.rectify && (
                      <button
                        onClick={() => onRectify(ncr)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                      >
                        Submit Rectification
                      </button>
                    )}

                    {/* Reject Rectification Button */}
                    {actions.rejectRectification && (
                      <button
                        onClick={() => onRejectRectification(ncr)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
                        title="Reject rectification and return to responsible party"
                      >
                        Reject
                      </button>
                    )}

                    {/* Close Button */}
                    {actions.close && (
                      <button
                        onClick={() => onClose(ncr)}
                        disabled={actionLoading || closeBlocked}
                        className={`px-3 py-1 text-xs rounded disabled:opacity-50 ${
                          closeBlocked
                            ? 'bg-muted-foreground text-muted cursor-not-allowed'
                            : 'bg-success text-success-foreground hover:bg-success/90'
                        }`}
                        title={closeBlockedTitle ?? 'Close NCR'}
                      >
                        Close
                      </button>
                    )}

                    {/* Close with Concession Button */}
                    {actions.concession && (
                      <button
                        onClick={() => onConcession(ncr)}
                        disabled={actionLoading || closeBlocked}
                        className={`px-3 py-1 text-xs rounded disabled:opacity-50 ${
                          closeBlocked
                            ? 'bg-muted-foreground text-muted cursor-not-allowed'
                            : 'bg-warning text-warning-foreground hover:bg-warning/90'
                        }`}
                        title={
                          closeBlockedTitle ??
                          'Close with concession when full rectification is not possible'
                        }
                      >
                        Concession
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {ncrs.length > 0 && rowVirtualizer.getVirtualItems().length > 0 && (
            <tr>
              <td
                colSpan={10}
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
  );
}

export const NCRTable = memo(NCRTableInner);
