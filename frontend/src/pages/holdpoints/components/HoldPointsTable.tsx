import React, { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Link2, Check, Download, RefreshCw, ClipboardCheck } from 'lucide-react';
import type { HoldPoint, HoldPointSortDirection, HoldPointSortField, StatusFilter } from '../types';
import {
  buildFilterEmptyStateMessage,
  formatHoldPointDate,
  getStatusBadge,
  getStatusLabel,
  isNoticeExpired,
  isOverdue,
} from './holdPointTableUtils';
import { getReleaseIdentityParts } from '../holdPointReleaseIdentity';

interface HoldPointsTableProps {
  holdPoints: HoldPoint[];
  filteredHoldPoints: HoldPoint[];
  loading: boolean;
  statusFilter: StatusFilter;
  searchQuery: string;
  sortField: HoldPointSortField;
  sortDirection: HoldPointSortDirection;
  /** Deep-linked hold point (?hp=<id>) to scroll to and highlight. */
  highlightedHpId: string | null;
  copiedHpId: string | null;
  generatingPdf: string | null;
  chasingHpId: string | null;
  batchSelectableHoldPointIds: Set<string>;
  selectedBatchHoldPointIds: Set<string>;
  onSort: (field: HoldPointSortField) => void;
  onCopyLink: (hpId: string, lotNumber: string, description: string) => void;
  onRequestRelease: (hp: HoldPoint) => void;
  onRecordRelease: (hp: HoldPoint) => void;
  onChase: (hp: HoldPoint) => void;
  onGenerateEvidence: (hp: HoldPoint) => void;
  onToggleBatchSelection: (hp: HoldPoint) => void;
  onClearFilter: () => void;
}

interface SortableHeaderProps {
  field: HoldPointSortField;
  sortField: HoldPointSortField;
  sortDirection: HoldPointSortDirection;
  onSort: (field: HoldPointSortField) => void;
  children: React.ReactNode;
}

// Clickable column header with the lot register's sort affordance (LotTable
// idiom): arrow on the active column, hover-revealed `↕` on the rest.
function SortableHeader({
  field,
  sortField,
  sortDirection,
  onSort,
  children,
}: SortableHeaderProps) {
  return (
    <th
      className="group px-4 py-3 text-left text-sm font-medium cursor-pointer select-none hover:bg-muted/70"
      aria-sort={
        sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      onClick={() => onSort(field)}
      data-testid={`hp-column-header-${field}`}
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
}

export const HoldPointsTable = React.memo(function HoldPointsTable({
  holdPoints,
  filteredHoldPoints,
  loading,
  statusFilter,
  searchQuery,
  sortField,
  sortDirection,
  highlightedHpId,
  copiedHpId,
  generatingPdf,
  chasingHpId,
  batchSelectableHoldPointIds,
  selectedBatchHoldPointIds,
  onSort,
  onCopyLink,
  onRequestRelease,
  onRecordRelease,
  onChase,
  onGenerateEvidence,
  onToggleBatchSelection,
  onClearFilter,
}: HoldPointsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredHoldPoints.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });

  // Scroll the deep-linked hold point into view while its highlight pulse is active.
  useEffect(() => {
    if (!highlightedHpId) return;
    const index = filteredHoldPoints.findIndex((hp) => hp.id === highlightedHpId);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'center' });
  }, [highlightedHpId, filteredHoldPoints, virtualizer]);

  if (loading) {
    return (
      <div className="flex justify-center p-8" role="status" aria-label="Loading hold points">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (holdPoints.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <div className="text-4xl mb-4">&#x1f512;</div>
        <h3 className="text-lg font-semibold mb-2">No Hold Points</h3>
        <p className="text-muted-foreground mb-4">
          Hold points are created when ITPs with hold point items are assigned to lots. Create an
          ITP template with hold point items and assign it to a lot to see hold points here.
        </p>
      </div>
    );
  }

  if (filteredHoldPoints.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <div className="text-4xl mb-4">&#x1f50d;</div>
        <h3 className="text-lg font-semibold mb-2">No Hold Points Match Filter</h3>
        <p className="text-muted-foreground mb-4">
          {buildFilterEmptyStateMessage(statusFilter, searchQuery)}
        </p>
        <button onClick={onClearFilter} className="text-primary hover:underline">
          Show all hold points
        </button>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    // Single <table> inside the scroll container with top/bottom spacer rows
    // (the lots/NCR register virtualization idiom) so header and body columns
    // share one column model and screen readers see one coherent table — the
    // previous header-table + per-row tables broke both alignment and semantics.
    <div
      ref={parentRef}
      className="rounded-lg border overflow-auto"
      style={{ maxHeight: 'calc(100vh - 300px)' }}
      data-testid="holdpoints-scroll-container"
    >
      <table className="w-full">
        <thead className="bg-muted/50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Select</th>
            <SortableHeader
              field="lot"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            >
              Lot
            </SortableHeader>
            <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
            <SortableHeader
              field="status"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            >
              Status
            </SortableHeader>
            <SortableHeader
              field="notified"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            >
              Notified
            </SortableHeader>
            <SortableHeader
              field="scheduled"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            >
              Scheduled
            </SortableHeader>
            <SortableHeader
              field="released"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            >
              Released
            </SortableHeader>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {/* Top spacer: pushes the first rendered row to its virtual position. */}
          {virtualItems.length > 0 && (
            <tr>
              <td
                colSpan={8}
                style={{ height: `${virtualItems[0]?.start ?? 0}px`, padding: 0, border: 'none' }}
              />
            </tr>
          )}
          {virtualItems.map((virtualRow) => {
            const hp = filteredHoldPoints[virtualRow.index];
            if (!hp) return null;
            return (
              <HoldPointRow
                key={virtualRow.key}
                innerRef={virtualizer.measureElement}
                dataIndex={virtualRow.index}
                hp={hp}
                isDeepLinked={hp.id === highlightedHpId}
                copiedHpId={copiedHpId}
                generatingPdf={generatingPdf}
                chasingHpId={chasingHpId}
                canSelectForBatch={batchSelectableHoldPointIds.has(hp.id)}
                isSelectedForBatch={selectedBatchHoldPointIds.has(hp.id)}
                onCopyLink={onCopyLink}
                onRequestRelease={onRequestRelease}
                onRecordRelease={onRecordRelease}
                onChase={onChase}
                onGenerateEvidence={onGenerateEvidence}
                onToggleBatchSelection={onToggleBatchSelection}
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
        </tbody>
      </table>
    </div>
  );
});

interface HoldPointRowProps {
  hp: HoldPoint;
  /** True while this row is the deep-linked record's highlight pulse target. */
  isDeepLinked: boolean;
  /** Virtualizer measure ref + index, applied to the <tr> for dynamic sizing. */
  innerRef?: (el: HTMLTableRowElement | null) => void;
  dataIndex?: number;
  copiedHpId: string | null;
  generatingPdf: string | null;
  chasingHpId: string | null;
  canSelectForBatch: boolean;
  isSelectedForBatch: boolean;
  onCopyLink: (hpId: string, lotNumber: string, description: string) => void;
  onRequestRelease: (hp: HoldPoint) => void;
  onRecordRelease: (hp: HoldPoint) => void;
  onChase: (hp: HoldPoint) => void;
  onGenerateEvidence: (hp: HoldPoint) => void;
  onToggleBatchSelection: (hp: HoldPoint) => void;
}

function HoldPointRow({
  hp,
  isDeepLinked,
  innerRef,
  dataIndex,
  copiedHpId,
  generatingPdf,
  chasingHpId,
  canSelectForBatch,
  isSelectedForBatch,
  onCopyLink,
  onRequestRelease,
  onRecordRelease,
  onChase,
  onGenerateEvidence,
  onToggleBatchSelection,
}: HoldPointRowProps) {
  const overdue = isOverdue(hp);
  const noticeExpired = isNoticeExpired(hp);
  const releaseIdentity = hp.releasedAt ? getReleaseIdentityParts(hp) : null;

  return (
    <tr
      ref={innerRef}
      data-index={dataIndex}
      className={`border-b hover:bg-muted/25 ${overdue ? 'bg-destructive/10 border-l-4 border-l-destructive' : ''} ${isDeepLinked ? 'bg-primary/10' : ''}`}
      data-deep-linked={isDeepLinked ? 'true' : undefined}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelectedForBatch}
          disabled={!canSelectForBatch}
          onChange={() => onToggleBatchSelection(hp)}
          aria-label={`Select ${hp.description} for batch release`}
          className="h-4 w-4 rounded border-border"
        />
      </td>
      <td className="px-4 py-3 font-medium">
        {hp.lotNumber}
        {overdue && (
          <span className="ml-2 px-1.5 py-0.5 text-xs bg-destructive/10 text-destructive rounded font-normal">
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
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {hp.notificationSentAt ? (
          <>
            {formatHoldPointDate(hp.notificationSentAt)}
            {noticeExpired && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-warning/10 text-warning rounded font-normal">
                NOTICE EXPIRED
              </span>
            )}
          </>
        ) : (
          '-'
        )}
      </td>
      <td
        className={`px-4 py-3 text-sm ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
      >
        {formatHoldPointDate(hp.scheduledDate)}
      </td>
      <td className="px-4 py-3 text-sm">
        {hp.releasedAt ? (
          <div>
            <div>{formatHoldPointDate(hp.releasedAt)}</div>
            {releaseIdentity && (
              <>
                <div className="text-xs text-muted-foreground">{releaseIdentity.primary}</div>
                {releaseIdentity.secondary && (
                  <div className="text-xs text-muted-foreground">{releaseIdentity.secondary}</div>
                )}
              </>
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
            aria-label={`Copy link to hold point ${hp.lotNumber}`}
          >
            {copiedHpId === hp.id ? (
              <Check className="h-3.5 w-3.5 text-success" />
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
              <span className="text-sm text-warning">Awaiting...</span>
              {!hp.id.startsWith('virtual-') && (
                <>
                  <button
                    onClick={() => onRecordRelease(hp)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-success/10 text-success border border-success/20 rounded hover:bg-success/15"
                    title="Record hold point release"
                  >
                    <ClipboardCheck className="h-3 w-3" />
                    <span>Record Manual Release</span>
                  </button>
                  <button
                    onClick={() => onChase(hp)}
                    disabled={chasingHpId === hp.id}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-warning/10 text-warning border border-warning/20 rounded hover:bg-warning/15 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <span className="text-sm text-muted-foreground">&#x2713; Released</span>
              {!hp.id.startsWith('virtual-') && (
                <button
                  onClick={() => onGenerateEvidence(hp)}
                  disabled={generatingPdf === hp.id}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/5 text-primary border border-primary/20 rounded hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Generate Evidence Package PDF"
                >
                  {generatingPdf === hp.id ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
  );
}
