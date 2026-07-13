import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { COLUMN_CONFIG, type ColumnId } from './lotFilterConfig';
import {
  LotExpandedDetailsRow,
  LotTableEmptyState,
  LotTableLoadMoreIndicator,
} from './LotTableSections';
import {
  COLUMN_WIDTH_STORAGE_KEY,
  DEFAULT_COLUMN_WIDTHS,
  formatChainage,
  highlightSearchTerm,
  parseColumnWidthsPreference,
} from './lotTableDisplay';
import type { Lot } from '../lotsPageTypes';
import { readLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';
import { formatStatusLabel } from '@/lib/statusLabels';
import { getLotStatusBadgeClass } from '@/lib/lotStatusOverview';

interface LotTableProps {
  displayedLots: Lot[];
  filteredLots: Lot[];
  allLots: Lot[];
  orderedVisibleColumns: ColumnId[];
  searchQuery: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  canDelete: boolean;
  canCreate: boolean;
  canViewBudgets: boolean;
  isSubcontractor: boolean;
  projectId: string;
  // Selection
  selectedLots: Set<string>;
  cloningLotId: string | null;
  onSelectLot: (lotId: string) => void;
  onSelectAll: () => void;
  allDeletableSelected: boolean;
  // Handlers
  onSort: (field: string) => void;
  onDeleteClick: (lot: Lot) => void;
  onCloneLot: (lot: Lot) => void;
  onContextMenu: (e: React.MouseEvent, lot: Lot) => void;
  onLotMouseEnter: (lotId: string, event: React.MouseEvent) => void;
  onLotMouseLeave: () => void;
  onOpenCreateModal: () => void;
  // Infinite scroll
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  loadingMore: boolean;
  hasMore: boolean;
}

export const LotTable = React.memo(function LotTable({
  displayedLots,
  filteredLots,
  allLots,
  orderedVisibleColumns,
  searchQuery,
  sortField,
  sortDirection,
  canDelete,
  canCreate,
  canViewBudgets,
  isSubcontractor,
  projectId,
  selectedLots,
  cloningLotId,
  onSelectLot,
  onSelectAll,
  allDeletableSelected,
  onSort,
  onDeleteClick,
  onCloneLot,
  onContextMenu,
  onLotMouseEnter,
  onLotMouseLeave,
  onOpenCreateModal,
  loadMoreRef,
  loadingMore,
  hasMore,
}: LotTableProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpansion = useCallback((lotId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) {
        next.delete(lotId);
      } else {
        next.add(lotId);
      }
      return next;
    });
  }, []);

  // Column widths state for resizing
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    return parseColumnWidthsPreference(readLocalStorageItem(COLUMN_WIDTH_STORAGE_KEY));
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // Handle column resize
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingColumn(columnId);
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = columnWidths[columnId] || DEFAULT_COLUMN_WIDTHS[columnId] || 100;
    },
    [columnWidths],
  );

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(60, resizeStartWidth.current + diff);
      setColumnWidths((prev) => ({
        ...prev,
        [resizingColumn]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      if (resizingColumn) {
        setColumnWidths((prev) => {
          writeLocalStorageItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(prev));
          return prev;
        });
        setResizingColumn(null);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn]);

  // Sortable column header component with resize handle
  const SortableHeader = useCallback(
    ({ field, children }: { field: string; children: React.ReactNode }) => (
      <th
        className="text-left p-3 font-medium cursor-pointer hover:bg-muted/70 select-none relative group/resize"
        style={{
          width: columnWidths[field] || DEFAULT_COLUMN_WIDTHS[field] || 'auto',
          minWidth: 60,
        }}
        onClick={() => onSort(field)}
        data-testid={`column-header-${field}`}
      >
        <div className="flex items-center gap-1 pr-2">
          {children}
          <span className="text-muted-foreground">
            {sortField === field ? (
              sortDirection === 'asc' ? (
                '\u2191'
              ) : (
                '\u2193'
              )
            ) : (
              <span className="opacity-0 group-hover:opacity-50">{'\u2195'}</span>
            )}
          </span>
        </div>
        {/* Resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover/resize:bg-muted-foreground/30"
          onMouseDown={(e) => handleResizeStart(e, field)}
          onClick={(e) => e.stopPropagation()}
          data-testid={`column-resize-${field}`}
        />
      </th>
    ),
    [columnWidths, sortField, sortDirection, onSort, handleResizeStart],
  );

  // Row virtualizer for table body
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Memoize expanded rows key to trigger virtualizer re-measurement
  const expandedRowsKey = useMemo(() => Array.from(expandedRows).sort().join(','), [expandedRows]);

  const rowVirtualizer = useVirtualizer({
    count: displayedLots.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: useCallback(
      (index: number) => {
        // Expanded rows are taller
        const lot = displayedLots[index];
        return lot && expandedRows.has(lot.id) ? 220 : 52;
      },
      [displayedLots, expandedRows],
    ),
    overscan: 5,
  });

  // Re-measure all rows when expandedRows changes
  useEffect(() => {
    rowVirtualizer.measure();
  }, [expandedRowsKey, rowVirtualizer]);

  const colSpanCount = canDelete ? (isSubcontractor ? 7 : 9) : isSubcontractor ? 6 : 8;

  return (
    <div
      ref={scrollContainerRef}
      className={`rounded-lg border overflow-auto max-h-[calc(100vh-280px)] ${resizingColumn ? 'cursor-col-resize select-none' : ''}`}
      data-testid="scrollable-table-container"
    >
      <table className="w-full" style={{ tableLayout: 'fixed' }} data-testid="lots-table">
        <thead className="border-b sticky top-0 z-10 bg-muted" data-testid="sticky-table-header">
          <tr>
            {canDelete && (
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allDeletableSelected}
                  onChange={onSelectAll}
                  className="h-4 w-4 rounded border-border accent-primary"
                  aria-label="Select all deletable lots"
                  title="Select all"
                />
              </th>
            )}
            {orderedVisibleColumns.map((columnId) => {
              if (columnId === 'subcontractor' && isSubcontractor) return null;
              if (columnId === 'budget' && !canViewBudgets) return null;

              const column = COLUMN_CONFIG.find((c) => c.id === columnId);
              if (!column) return null;

              if (
                ['lotNumber', 'description', 'chainage', 'activityType', 'status'].includes(
                  columnId,
                )
              ) {
                return (
                  <SortableHeader key={columnId} field={columnId}>
                    {column.label}
                  </SortableHeader>
                );
              }

              return (
                <th
                  key={columnId}
                  className="text-left p-3 font-medium relative group/resize"
                  style={{
                    width: columnWidths[columnId] || DEFAULT_COLUMN_WIDTHS[columnId] || 'auto',
                    minWidth: 60,
                  }}
                  data-testid={`column-header-${columnId}`}
                >
                  <div className="pr-2">{column.label}</div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover/resize:bg-muted-foreground/30"
                    onMouseDown={(e) => handleResizeStart(e, columnId)}
                    data-testid={`column-resize-${columnId}`}
                  />
                </th>
              );
            })}
            <th className="text-left p-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayedLots.length === 0 ? (
            <LotTableEmptyState
              allLotsCount={allLots.length}
              colSpanCount={colSpanCount}
              canCreate={canCreate}
              isSubcontractor={isSubcontractor}
              onOpenCreateModal={onOpenCreateModal}
            />
          ) : (
            <>
              {/* Spacer row to push content to correct virtual position */}
              {rowVirtualizer.getVirtualItems().length > 0 && (
                <tr>
                  <td
                    colSpan={colSpanCount}
                    style={{
                      height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px`,
                      padding: 0,
                      border: 'none',
                    }}
                  />
                </tr>
              )}
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const lot = displayedLots[virtualRow.index];
                if (!lot) return null;
                return (
                  <React.Fragment key={lot.id}>
                    <tr
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="border-b hover:bg-muted/25 cursor-pointer"
                      onMouseEnter={(e) => onLotMouseEnter(lot.id, e)}
                      onMouseLeave={onLotMouseLeave}
                      onContextMenu={(e) => onContextMenu(e, lot)}
                    >
                      {canDelete && (
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpansion(lot.id);
                              }}
                              className="p-1 hover:bg-muted rounded transition-transform"
                              data-testid={`expand-row-${lot.id}`}
                              title={
                                expandedRows.has(lot.id) ? 'Collapse details' : 'Expand details'
                              }
                            >
                              {expandedRows.has(lot.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            {lot.status !== 'conformed' && lot.status !== 'claimed' && (
                              <input
                                type="checkbox"
                                checked={selectedLots.has(lot.id)}
                                onChange={() => onSelectLot(lot.id)}
                                className="h-4 w-4 rounded border-border accent-primary"
                                aria-label={`Select lot ${lot.lotNumber}`}
                              />
                            )}
                          </div>
                        </td>
                      )}
                      {orderedVisibleColumns.map((columnId) => {
                        if (columnId === 'subcontractor' && isSubcontractor) return null;
                        if (columnId === 'budget' && !canViewBudgets) return null;

                        switch (columnId) {
                          case 'lotNumber':
                            return (
                              <td key={columnId} className="p-3 font-medium">
                                {highlightSearchTerm(lot.lotNumber, searchQuery)}
                              </td>
                            );
                          case 'description':
                            return (
                              <td key={columnId} className="p-3 max-w-xs">
                                <span className="block truncate" title={lot.description || ''}>
                                  {lot.description
                                    ? highlightSearchTerm(lot.description, searchQuery)
                                    : '\u2014'}
                                </span>
                              </td>
                            );
                          case 'chainage':
                            return (
                              <td key={columnId} className="p-3">
                                {formatChainage(lot)}
                              </td>
                            );
                          case 'activityType':
                            return (
                              <td key={columnId} className="p-3 capitalize">
                                {lot.activityType || '\u2014'}
                              </td>
                            );
                          case 'status':
                            return (
                              <td key={columnId} className="p-3">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${getLotStatusBadgeClass(lot.status)}`}
                                >
                                  {formatStatusLabel(lot.status)}
                                </span>
                              </td>
                            );
                          case 'subcontractor':
                            return (
                              <td key={columnId} className="p-3">
                                {lot.assignedSubcontractor?.companyName || '\u2014'}
                              </td>
                            );
                          case 'budget':
                            return (
                              <td key={columnId} className="p-3">
                                {lot.budgetAmount
                                  ? `$${lot.budgetAmount.toLocaleString('en-AU')}`
                                  : '\u2014'}
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button
                            className="text-sm text-primary hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
                            onClick={() =>
                              navigate(
                                `/projects/${encodeURIComponent(projectId)}/lots/${encodeURIComponent(lot.id)}`,
                                {
                                  state: { returnFilters: searchParams.toString() },
                                },
                              )
                            }
                          >
                            View
                          </button>
                          {canCreate && lot.status !== 'conformed' && lot.status !== 'claimed' && (
                            <button
                              className="text-sm text-primary hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
                              onClick={() =>
                                navigate(
                                  `/projects/${encodeURIComponent(projectId)}/lots/${encodeURIComponent(lot.id)}/edit`,
                                )
                              }
                            >
                              Edit
                            </button>
                          )}
                          {canCreate && (
                            <button
                              className="text-sm text-primary hover:underline px-2 py-3 min-h-[44px] touch-manipulation disabled:opacity-50"
                              onClick={() => onCloneLot(lot)}
                              disabled={cloningLotId === lot.id}
                              title="Clone lot with adjacent chainage"
                            >
                              {cloningLotId === lot.id ? 'Cloning...' : 'Clone'}
                            </button>
                          )}
                          {canDelete && lot.status !== 'conformed' && lot.status !== 'claimed' && (
                            <button
                              className="text-sm text-destructive hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
                              onClick={() => onDeleteClick(lot)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded detail row */}
                    {expandedRows.has(lot.id) && (
                      <LotExpandedDetailsRow lot={lot} colSpanCount={colSpanCount} />
                    )}
                  </React.Fragment>
                );
              })}
              {/* Bottom spacer to maintain correct scroll area */}
              {rowVirtualizer.getVirtualItems().length > 0 && (
                <tr>
                  <td
                    colSpan={colSpanCount}
                    style={{
                      height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0)}px`,
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

      {/* Infinite Scroll - Load More Indicator */}
      <LotTableLoadMoreIndicator
        displayedCount={displayedLots.length}
        filteredCount={filteredLots.length}
        hasMore={hasMore}
        loadingMore={loadingMore}
        loadMoreRef={loadMoreRef as React.RefObject<HTMLDivElement>}
      />
    </div>
  );
});
