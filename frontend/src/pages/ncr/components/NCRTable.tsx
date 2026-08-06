import { memo, useEffect, useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from '@/components/ui/toaster';
import { RowActions } from '@/components/ui/RowActions';
import { getStatusBadgeColor } from '../constants';
import { buildNcrDetailPdfData } from '../ncrDetailPdfData';
import { getAvailableNcrActions } from '../ncrActions';
import { buildNcrRowActions } from '../ncrRowActions';
import type { NcrSortDirection, NcrSortField } from '../ncrRegisterSort';
import type { NCR, UserRole } from '../types';
import { fetchPdfBranding } from '@/lib/pdf/fetchBranding';
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
      if (ncr.project?.id) {
        // Company block (logo/ABN/address) is best-effort — null keeps the
        // PDF unbranded rather than failing the download.
        pdfData.company = await fetchPdfBranding(ncr.project.id);
      }
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
      className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/70 select-none group"
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
            <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">NCR #</th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">Lots</th>
            {/* Description takes the slack the actions column gave back — the
                only column that grows, capped so it cannot push the register
                wider than the screen on its own. */}
            <th className="w-full px-4 py-3 text-left text-sm font-medium">Description</th>
            <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">Category</th>
            {renderSortableHeader('severity', 'Severity')}
            {renderSortableHeader('status', 'Status')}
            <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">
              Responsible
            </th>
            {renderSortableHeader('due', 'Due')}
            {renderSortableHeader('raised', 'Age')}
            {/* Fixed width: one primary action + the overflow trigger. */}
            <th className="w-[150px] px-4 py-3 text-left text-sm font-medium">Actions</th>
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
            const ageInDays = Math.floor(
              (Date.now() - new Date(ncr.createdAt).getTime()) / (1000 * 60 * 60 * 24),
            );
            const isOverdue =
              ncr.dueDate &&
              new Date(ncr.dueDate) < new Date() &&
              ncr.status !== 'closed' &&
              ncr.status !== 'closed_concession';
            const lotNumbers = ncr.ncrLots.map((nl) => nl.lot.lotNumber).join(', ');
            const { primary, overflow } = buildNcrRowActions(
              ncr,
              actions,
              { canAssign, actionLoading, copied: copiedNcrId === ncr.id },
              {
                onCopyLink,
                onPrint: (target) => void handlePrintPdf(target),
                onAssign,
                onRespond,
                onReviewResponse,
                onQmApprove,
                onNotifyClient,
                onRectify,
                onRejectRectification,
                onClose,
                onConcession,
              },
            );

            return (
              <tr
                key={ncr.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={`hover:bg-muted/50 ${ncr.id === highlightedNcrId ? 'bg-primary/10' : ''}`}
                data-deep-linked={ncr.id === highlightedNcrId ? 'true' : undefined}
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-sm">{ncr.ncrNumber}</td>
                <td className="px-4 py-3 text-sm">
                  <div
                    className="max-w-[160px] truncate text-muted-foreground"
                    title={lotNumbers || undefined}
                  >
                    {lotNumbers || '-'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[420px] truncate" title={ncr.description}>
                    {ncr.description}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span className="capitalize">{ncr.category.replace(/_/g, ' ')}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span
                    className={`capitalize ${ncr.severity === 'major' ? 'text-destructive font-medium' : ''}`}
                  >
                    {ncr.severity}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(ncr.status)}`}
                  >
                    {formatStatusLabel(ncr.status)}
                  </span>
                  {/* A fact about the NCR, not an action — it belongs with the
                      status, not in the actions column it used to widen. */}
                  {ncr.clientNotifiedAt && (
                    <div
                      className="mt-0.5 text-xs text-muted-foreground"
                      title={`Client notified on ${new Date(ncr.clientNotifiedAt).toLocaleDateString('en-AU')}`}
                    >
                      ✓ Client Notified
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="max-w-[160px] truncate">
                    {ncr.responsibleUser ? (
                      ncr.responsibleUser.fullName || ncr.responsibleUser.email
                    ) : ncr.responsibleSubcontractor ? (
                      ncr.responsibleSubcontractor.companyName
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  {ncr.dueDate ? (
                    <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                      {new Date(ncr.dueDate).toLocaleDateString('en-AU')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span className={ageInDays > 14 ? 'text-warning font-medium' : ''}>
                    {ageInDays}d
                  </span>
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    primary={primary}
                    actions={overflow}
                    menuLabel={`More actions for NCR ${ncr.ncrNumber}`}
                  />
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
