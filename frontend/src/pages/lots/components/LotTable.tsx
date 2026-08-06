import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { COLUMN_CONFIG, type ColumnId } from './lotFilterConfig';
import {
  LotExpandedDetailsRow,
  LotGroupBandRow,
  LotTableEmptyState,
  LotTableLoadMoreIndicator,
} from './LotTableSections';
import {
  ACTIONS_COLUMN_WIDTH,
  COLUMN_WIDTH_STORAGE_KEY,
  DEFAULT_COLUMN_WIDTHS,
  SELECT_COLUMN_WIDTH,
  parseColumnWidthsPreference,
} from './lotTableDisplay';
import { LotRowActions } from './LotRowActions';
import { LotTableCell } from './LotTableCells';
import { buildLotRegisterRows, type LotGroupBy } from './lotRegisterQueue';
import type { Lot } from '../lotsPageTypes';
import { readLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';

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
  // Grouping
  groupBy: LotGroupBy | null;
  groupCounts: Map<string, number>;
  collapsedGroups: Set<string>;
  onToggleGroup: (groupKey: string) => void;
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
  groupBy,
  groupCounts,
  collapsedGroups,
  onToggleGroup,
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

  // Row virtualizer for table body. When a grouping is active the virtualized
  // list interleaves collapsible group bands with the lot rows, so it runs over
  // a flattened row model rather than over displayedLots directly.
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () => buildLotRegisterRows({ displayedLots, groupBy, groupCounts, collapsedGroups }),
    [displayedLots, groupBy, groupCounts, collapsedGroups],
  );

  // Memoize expanded rows key to trigger virtualizer re-measurement
  const expandedRowsKey = useMemo(() => Array.from(expandedRows).sort().join(','), [expandedRows]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const row = rows[index];
        if (!row) return 52;
        if (row.kind === 'band') return 40;
        // Expanded rows are taller
        return expandedRows.has(row.lot.id) ? 220 : 52;
      },
      [rows, expandedRows],
    ),
    overscan: 5,
  });

  // Re-measure all rows when expandedRows or the grouping changes
  useEffect(() => {
    rowVirtualizer.measure();
  }, [expandedRowsKey, rows, rowVirtualizer]);

  // Counted rather than guessed: select column + the data columns actually
  // rendered for this role + the actions column. A hard-coded total silently
  // goes wrong every time the column set changes.
  const colSpanCount = useMemo(() => {
    const dataColumns = orderedVisibleColumns.filter((columnId) => {
      if (columnId === 'subcontractor' && isSubcontractor) return false;
      if (columnId === 'budget' && !canViewBudgets) return false;
      return COLUMN_CONFIG.some((column) => column.id === columnId);
    }).length;
    return (canDelete ? 1 : 0) + dataColumns + 1;
  }, [orderedVisibleColumns, isSubcontractor, canViewBudgets, canDelete]);

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
              <th className="p-3" style={{ width: SELECT_COLUMN_WIDTH }}>
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
                [
                  'lotNumber',
                  'description',
                  'chainage',
                  'activityType',
                  'status',
                  'daysOpen',
                ].includes(columnId)
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
            <th
              className="text-left p-3 font-medium"
              style={{ width: ACTIONS_COLUMN_WIDTH, minWidth: ACTIONS_COLUMN_WIDTH }}
            >
              Actions
            </th>
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
                const row = rows[virtualRow.index];
                if (!row) return null;

                if (row.kind === 'band') {
                  return (
                    <tr
                      key={row.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="border-b bg-muted/60"
                    >
                      <LotGroupBandRow
                        groupKey={row.key}
                        label={row.label}
                        count={row.count}
                        collapsed={row.collapsed}
                        colSpanCount={colSpanCount}
                        onToggle={onToggleGroup}
                      />
                    </tr>
                  );
                }

                const lot = row.lot;
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
                        return (
                          <LotTableCell
                            key={columnId}
                            columnId={columnId}
                            lot={lot}
                            searchQuery={searchQuery}
                          />
                        );
                      })}
                      <td className="p-3">
                        <LotRowActions
                          lot={lot}
                          projectId={projectId}
                          canCreate={canCreate}
                          canDelete={canDelete}
                          cloningLotId={cloningLotId}
                          onCloneLot={onCloneLot}
                          onDeleteClick={onDeleteClick}
                        />
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
