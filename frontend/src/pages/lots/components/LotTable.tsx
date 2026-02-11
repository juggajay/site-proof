import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Calendar, FileText, TestTube, AlertTriangle } from 'lucide-react'
import { COLUMN_CONFIG, type ColumnId } from './LotFiltersBar'
import type { Lot } from '../lotsPageTypes'

// Default column widths in pixels
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  lotNumber: 140,
  description: 200,
  chainage: 100,
  activityType: 130,
  status: 110,
  subcontractor: 140,
  budget: 100,
}

const COLUMN_WIDTH_STORAGE_KEY = 'siteproof_lot_column_widths'

// Feature #438: Okabe-Ito color-blind safe palette
const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  on_hold: 'bg-orange-100 text-orange-800',
  not_started: 'bg-gray-100 text-gray-700',
}

// Helper function to highlight search terms in text
function highlightSearchTerm(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm || !text) return text

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)

  if (parts.length === 1) return text

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

// Format chainage for display
function formatChainage(lot: Lot) {
  if (lot.chainageStart != null && lot.chainageEnd != null) {
    return lot.chainageStart === lot.chainageEnd
      ? `${lot.chainageStart}`
      : `${lot.chainageStart}-${lot.chainageEnd}`
  }
  return lot.chainageStart ?? lot.chainageEnd ?? '\u2014'
}

interface LotTableProps {
  displayedLots: Lot[]
  filteredLots: Lot[]
  allLots: Lot[]
  orderedVisibleColumns: ColumnId[]
  searchQuery: string
  sortField: string
  sortDirection: 'asc' | 'desc'
  canDelete: boolean
  canCreate: boolean
  canViewBudgets: boolean
  isSubcontractor: boolean
  projectId: string
  // Selection
  selectedLots: Set<string>
  onSelectLot: (lotId: string) => void
  onSelectAll: () => void
  allDeletableSelected: boolean
  // Handlers
  onSort: (field: string) => void
  onDeleteClick: (lot: Lot) => void
  onCloneLot: (lot: Lot) => void
  onContextMenu: (e: React.MouseEvent, lot: Lot) => void
  onLotMouseEnter: (lotId: string, event: React.MouseEvent) => void
  onLotMouseLeave: () => void
  onOpenCreateModal: () => void
  // Infinite scroll
  loadMoreRef: React.RefObject<HTMLDivElement | null>
  loadingMore: boolean
  hasMore: boolean
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRowExpansion = useCallback((lotId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(lotId)) {
        next.delete(lotId)
      } else {
        next.add(lotId)
      }
      return next
    })
  }, [])

  // Column widths state for resizing
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY)
      if (stored) {
        return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(stored) }
      }
    } catch (e) {
      console.error('Error loading column widths:', e)
    }
    return DEFAULT_COLUMN_WIDTHS
  })
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const resizeStartX = useRef<number>(0)
  const resizeStartWidth = useRef<number>(0)

  // Handle column resize
  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnId)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = columnWidths[columnId] || DEFAULT_COLUMN_WIDTHS[columnId] || 100
  }, [columnWidths])

  useEffect(() => {
    if (!resizingColumn) return

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current
      const newWidth = Math.max(60, resizeStartWidth.current + diff)
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth,
      }))
    }

    const handleMouseUp = () => {
      if (resizingColumn) {
        setColumnWidths(prev => {
          localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(prev))
          return prev
        })
        setResizingColumn(null)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingColumn])

  // Sortable column header component with resize handle
  const SortableHeader = useCallback(({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/70 select-none relative group/resize"
      style={{ width: columnWidths[field] || DEFAULT_COLUMN_WIDTHS[field] || 'auto', minWidth: 60 }}
      onClick={() => onSort(field)}
      data-testid={`column-header-${field}`}
    >
      <div className="flex items-center gap-1 pr-2">
        {children}
        <span className="text-muted-foreground">
          {sortField === field ? (
            sortDirection === 'asc' ? '\u2191' : '\u2193'
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
  ), [columnWidths, sortField, sortDirection, onSort, handleResizeStart])

  // Row virtualizer for table body
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Memoize expanded rows key to trigger virtualizer re-measurement
  const expandedRowsKey = useMemo(() => Array.from(expandedRows).sort().join(','), [expandedRows])

  const rowVirtualizer = useVirtualizer({
    count: displayedLots.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: useCallback((index: number) => {
      // Expanded rows are taller
      const lot = displayedLots[index]
      return lot && expandedRows.has(lot.id) ? 220 : 52
    }, [displayedLots, expandedRowsKey]),
    overscan: 5,
  })

  // Re-measure all rows when expandedRows changes
  useEffect(() => {
    rowVirtualizer.measure()
  }, [expandedRowsKey, rowVirtualizer])

  const colSpanCount = canDelete ? (isSubcontractor ? 7 : 9) : (isSubcontractor ? 6 : 8)

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
                  className="h-4 w-4 rounded border-gray-300"
                  title="Select all"
                />
              </th>
            )}
            {orderedVisibleColumns.map((columnId) => {
              if (columnId === 'subcontractor' && isSubcontractor) return null
              if (columnId === 'budget' && !canViewBudgets) return null

              const column = COLUMN_CONFIG.find(c => c.id === columnId)
              if (!column) return null

              if (['lotNumber', 'description', 'chainage', 'activityType', 'status'].includes(columnId)) {
                return (
                  <SortableHeader key={columnId} field={columnId}>
                    {column.label}
                  </SortableHeader>
                )
              }

              return (
                <th
                  key={columnId}
                  className="text-left p-3 font-medium relative group/resize"
                  style={{ width: columnWidths[columnId] || DEFAULT_COLUMN_WIDTHS[columnId] || 'auto', minWidth: 60 }}
                  data-testid={`column-header-${columnId}`}
                >
                  <div className="pr-2">{column.label}</div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover/resize:bg-muted-foreground/30"
                    onMouseDown={(e) => handleResizeStart(e, columnId)}
                    data-testid={`column-resize-${columnId}`}
                  />
                </th>
              )
            })}
            <th className="text-left p-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayedLots.length === 0 ? (
            <tr>
              <td colSpan={colSpanCount} className="p-12 text-center">
                {allLots.length === 0 ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-5xl">📋</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {isSubcontractor ? 'No lots assigned yet' : 'No lots yet'}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isSubcontractor
                          ? 'No lots have been assigned to your company for this project.'
                          : 'Get started by creating your first lot for this project.'}
                      </p>
                    </div>
                    {!isSubcontractor && canCreate && (
                      <button
                        onClick={onOpenCreateModal}
                        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                      >
                        Create your first lot
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">No lots match the current filters.</span>
                )}
              </td>
            </tr>
          ) : (
            <>
              {/* Spacer row to push content to correct virtual position */}
              {rowVirtualizer.getVirtualItems().length > 0 && (
                <tr>
                  <td
                    colSpan={colSpanCount}
                    style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px`, padding: 0, border: 'none' }}
                  />
                </tr>
              )}
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const lot = displayedLots[virtualRow.index]
                if (!lot) return null
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
                                e.stopPropagation()
                                toggleRowExpansion(lot.id)
                              }}
                              className="p-1 hover:bg-muted rounded transition-transform"
                              data-testid={`expand-row-${lot.id}`}
                              title={expandedRows.has(lot.id) ? 'Collapse details' : 'Expand details'}
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
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            )}
                          </div>
                        </td>
                      )}
                      {orderedVisibleColumns.map((columnId) => {
                        if (columnId === 'subcontractor' && isSubcontractor) return null
                        if (columnId === 'budget' && !canViewBudgets) return null

                        switch (columnId) {
                          case 'lotNumber':
                            return (
                              <td key={columnId} className="p-3 font-medium">
                                {highlightSearchTerm(lot.lotNumber, searchQuery)}
                              </td>
                            )
                          case 'description':
                            return (
                              <td key={columnId} className="p-3 max-w-xs">
                                <span className="block truncate" title={lot.description || ''}>
                                  {lot.description ? highlightSearchTerm(lot.description, searchQuery) : '\u2014'}
                                </span>
                              </td>
                            )
                          case 'chainage':
                            return <td key={columnId} className="p-3">{formatChainage(lot)}</td>
                          case 'activityType':
                            return <td key={columnId} className="p-3 capitalize">{lot.activityType || '\u2014'}</td>
                          case 'status':
                            return (
                              <td key={columnId} className="p-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[lot.status] || 'bg-gray-100'}`}>
                                  {lot.status.replace('_', ' ')}
                                </span>
                              </td>
                            )
                          case 'subcontractor':
                            return <td key={columnId} className="p-3">{lot.assignedSubcontractor?.companyName || '\u2014'}</td>
                          case 'budget':
                            return <td key={columnId} className="p-3">{lot.budgetAmount ? `$${lot.budgetAmount.toLocaleString()}` : '\u2014'}</td>
                          default:
                            return null
                        }
                      })}
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button
                            className="text-sm text-primary hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
                            onClick={() => navigate(`/projects/${projectId}/lots/${lot.id}`, {
                              state: { returnFilters: searchParams.toString() }
                            })}
                          >
                            View
                          </button>
                          {canCreate && lot.status !== 'conformed' && lot.status !== 'claimed' && (
                            <button
                              className="text-sm text-amber-600 hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
                              onClick={() => navigate(`/projects/${projectId}/lots/${lot.id}/edit`)}
                            >
                              Edit
                            </button>
                          )}
                          {canCreate && (
                            <button
                              className="text-sm text-blue-600 hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
                              onClick={() => onCloneLot(lot)}
                              title="Clone lot with adjacent chainage"
                            >
                              Clone
                            </button>
                          )}
                          {canDelete && lot.status !== 'conformed' && lot.status !== 'claimed' && (
                            <button
                              className="text-sm text-red-600 hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
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
                      <tr className="bg-muted/30 border-b animate-in fade-in slide-in-from-top-2 duration-200" data-testid={`expanded-row-${lot.id}`}>
                        <td colSpan={colSpanCount} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            {/* Dates Section */}
                            <div className="space-y-2">
                              <h4 className="font-semibold flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Dates
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p>Created: {lot.createdAt ? new Date(lot.createdAt).toLocaleDateString() : '\u2014'}</p>
                                <p>Updated: {lot.updatedAt ? new Date(lot.updatedAt).toLocaleDateString() : '\u2014'}</p>
                              </div>
                            </div>

                            {/* Linked Items Section */}
                            <div className="space-y-2">
                              <h4 className="font-semibold flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Linked Items
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p>ITPs: {lot.itpCount ?? 0}</p>
                                <p>Test Results: {lot.testCount ?? 0}</p>
                                <p>Documents: {lot.documentCount ?? 0}</p>
                              </div>
                            </div>

                            {/* Status & Quality Section */}
                            <div className="space-y-2">
                              <h4 className="font-semibold flex items-center gap-2">
                                <TestTube className="h-4 w-4" />
                                Quality
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p className="flex items-center gap-1">
                                  {(lot.ncrCount ?? 0) > 0 && (
                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                  )}
                                  NCRs: {lot.ncrCount ?? 0}
                                </p>
                                <p>Hold Points: {lot.holdPointCount ?? 0}</p>
                                {lot.areaZone && <p>Area/Zone: {lot.areaZone}</p>}
                              </div>
                            </div>
                          </div>
                          {lot.notes && (
                            <div className="mt-3 pt-3 border-t">
                              <h4 className="font-semibold text-sm mb-1">Notes</h4>
                              <p className="text-sm text-muted-foreground">{lot.notes}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
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
      <div ref={loadMoreRef as React.RefObject<HTMLDivElement>} className="border-t p-4">
        {loadingMore && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Loading more lots...</span>
          </div>
        )}
        {!loadingMore && hasMore && (
          <div className="text-center text-sm text-muted-foreground">
            Showing {displayedLots.length} of {filteredLots.length} lots - Scroll down to load more
          </div>
        )}
        {!hasMore && filteredLots.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Showing all {filteredLots.length} lots
          </div>
        )}
      </div>
    </div>
  )
})
