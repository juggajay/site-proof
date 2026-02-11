import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { useSubcontractorAccess } from '@/hooks/useSubcontractorAccess'
import { useViewerAccess } from '@/hooks/useViewerAccess'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useAuth } from '@/lib/auth'
import { BulkCreateLotsWizard } from '@/components/lots/BulkCreateLotsWizard'
import { ImportLotsModal } from '@/components/lots/ImportLotsModal'
import { ExportLotsModal } from '@/components/lots/ExportLotsModal'
import { LotQuickView } from '@/components/lots/LotQuickView'
import { PrintLabelsModal } from '@/components/lots/PrintLabelsModal'
import { LinearMapView } from '@/components/lots/LinearMapView'
import { Printer, Plus } from 'lucide-react'
import { ContextFAB } from '@/components/mobile/ContextFAB'
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp'

// Extracted components
import { LotFiltersBar, type ColumnId, DEFAULT_COLUMN_ORDER } from './components/LotFiltersBar'
import { LotTable } from './components/LotTable'
import { LotMobileList } from './components/LotMobileList'
import { CreateLotModal } from './components/CreateLotModal'
import { LotContextMenu } from './components/LotContextMenu'
import { DeleteLotModal } from './components/DeleteLotModal'
import { BulkDeleteModal, BulkStatusModal, BulkAssignModal } from './components/BulkActionModals'

// Extracted hooks
import { useLotsData } from './hooks/useLotsData'
import { useLotsActions } from './hooks/useLotsActions'

// Roles that can delete lots
const LOT_DELETE_ROLES = ['owner', 'admin', 'project_manager']

// Column persistence keys
const COLUMN_STORAGE_KEY = 'siteproof_lot_columns'
const COLUMN_ORDER_STORAGE_KEY = 'siteproof_lot_column_order'

// Feature #438: Okabe-Ito color-blind safe palette (shared with LinearMapView)
const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  on_hold: 'bg-orange-100 text-orange-800',
  not_started: 'bg-gray-100 text-gray-700',
}

export function LotsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { canViewBudgets } = useCommercialAccess()
  const { isSubcontractor } = useSubcontractorAccess()
  const { canCreate } = useViewerAccess()
  const isMobile = useIsMobile()

  // URL-based filter state
  const statusFilterParam = searchParams.get('status') || ''
  const statusFilters = statusFilterParam ? statusFilterParam.split(',').filter(Boolean) : []
  const activityFilter = searchParams.get('activity') || ''
  const searchQuery = searchParams.get('search') || ''
  const sortField = searchParams.get('sort') || 'lotNumber'
  const sortDirection = (searchParams.get('dir') || 'asc') as 'asc' | 'desc'
  const chainageMinFilter = searchParams.get('chMin') || ''
  const chainageMaxFilter = searchParams.get('chMax') || ''
  const subcontractorFilter = searchParams.get('subcontractor') || ''
  const areaZoneFilter = searchParams.get('areaZone') || ''

  // Data hook
  const {
    lots, setLots, loading, error, setError, projectName, subcontractors, projectAreas,
    activityTypes, areaZones, filteredLots, displayedLots, hasMore, loadMoreRef, loadingMore,
    fetchLots, fetchSubcontractors,
  } = useLotsData({
    projectId, isSubcontractor, statusFilters, activityFilter, searchQuery,
    sortField, sortDirection, chainageMinFilter, chainageMaxFilter, subcontractorFilter, areaZoneFilter,
  })

  // Actions hook
  const actions = useLotsActions({
    lots, setLots, displayedLots, fetchLots, fetchSubcontractors, subcontractors,
  })

  // Access checks
  const canDelete = user?.role ? LOT_DELETE_ROLES.includes(user.role) : false

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'card' | 'linear'>(() => {
    const stored = localStorage.getItem('siteproof_lot_view_mode')
    if (stored === 'card' || stored === 'linear') return stored
    return 'list'
  })

  // Column customization state
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(() => {
    try {
      const stored = localStorage.getItem(COLUMN_STORAGE_KEY)
      if (stored) return JSON.parse(stored) as ColumnId[]
    } catch (_e) { /* fallback */ }
    return DEFAULT_COLUMN_ORDER
  })

  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(() => {
    try {
      const stored = localStorage.getItem(COLUMN_ORDER_STORAGE_KEY)
      if (stored) return JSON.parse(stored) as ColumnId[]
    } catch (_e) { /* fallback */ }
    return DEFAULT_COLUMN_ORDER
  })

  const orderedVisibleColumns = useMemo(() => {
    return columnOrder.filter(colId => visibleColumns.includes(colId))
  }, [columnOrder, visibleColumns])

  const toggleViewMode = (mode: 'list' | 'card' | 'linear') => {
    setViewMode(mode)
    actions.toggleViewMode(mode)
  }

  // =====================
  // Render
  // =====================
  return (
    <div className="space-y-6 p-6">
      {/* Print-only Header */}
      <div className="hidden print:block report-header mb-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Lot Register</h1>
        {projectName && <p className="text-gray-600 mb-1">{projectName}</p>}
        <div className="text-sm text-gray-500">
          Generated: {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-xs text-gray-400 mt-2">SiteProof - Quality Management System</div>
      </div>

      {/* Print-only Footer */}
      <div className="hidden print:block report-footer fixed bottom-0 left-0 right-0 text-center text-xs text-gray-400 py-2 bg-white border-t">
        &copy; {new Date().getFullYear()} SiteProof - Confidential
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Lot Register</h1>
          <ContextHelp title={HELP_CONTENT.lots.title} content={HELP_CONTENT.lots.content} />
        </div>
        <div className="flex items-center gap-3">
          {!isMobile && (
            <>
              <button onClick={() => actions.setExportModalOpen(true)} className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10">Export CSV</button>
              <button onClick={() => window.print()} className="rounded-lg border border-gray-500 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 print:hidden">
                <Printer className="h-4 w-4" /> Print Register
              </button>
            </>
          )}
          {canCreate && actions.selectedLots.size > 0 && (
            <>
              <button onClick={() => actions.setBulkStatusModalOpen(true)} className="rounded-lg border border-blue-500 px-4 py-2 text-sm text-blue-500 hover:bg-blue-50">
                Update Status ({actions.selectedLots.size})
              </button>
              {!isSubcontractor && (
                <button onClick={actions.handleOpenBulkAssignModal} className="rounded-lg border border-purple-500 px-4 py-2 text-sm text-purple-500 hover:bg-purple-50">
                  Assign Subcontractor ({actions.selectedLots.size})
                </button>
              )}
            </>
          )}
          {canDelete && actions.selectedLots.size > 0 && (
            <button onClick={() => actions.setBulkDeleteModalOpen(true)} className="rounded-lg border border-red-500 px-4 py-2 text-sm text-red-500 hover:bg-red-50">
              Delete Selected ({actions.selectedLots.size})
            </button>
          )}
          {actions.selectedLots.size > 0 && (
            <button onClick={() => actions.setPrintLabelsModalOpen(true)} className="rounded-lg border border-green-500 px-4 py-2 text-sm text-green-500 hover:bg-green-50">
              Print Labels ({actions.selectedLots.size})
            </button>
          )}
          {!isSubcontractor && canCreate && (
            <>
              {!isMobile && (
                <>
                  <button onClick={() => actions.setImportModalOpen(true)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Import CSV</button>
                  <button onClick={() => actions.setBulkWizardOpen(true)} className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10">Bulk Create Lots</button>
                </>
              )}
              <button onClick={() => actions.setCreateModalOpen(true)} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Create Lot</button>
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {isSubcontractor
          ? `Viewing lots assigned to your company for project ${projectId}.`
          : `Manage lots for project ${projectId}. The lot is the atomic unit of the system.`}
      </p>

      {/* Filters */}
      <LotFiltersBar
        isMobile={isMobile}
        isSubcontractor={isSubcontractor}
        canViewBudgets={canViewBudgets}
        statusFilters={statusFilters}
        activityFilter={activityFilter}
        searchQuery={searchQuery}
        chainageMinFilter={chainageMinFilter}
        chainageMaxFilter={chainageMaxFilter}
        subcontractorFilter={subcontractorFilter}
        areaZoneFilter={areaZoneFilter}
        sortField={sortField}
        sortDirection={sortDirection}
        activityTypes={activityTypes}
        areaZones={areaZones}
        subcontractors={subcontractors}
        totalLots={lots.length}
        filteredLotsCount={filteredLots.length}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        onUpdateFilters={actions.updateFilters}
        visibleColumns={visibleColumns}
        onSetVisibleColumns={setVisibleColumns}
        columnOrder={columnOrder}
        onSetColumnOrder={setColumnOrder}
      />

      {/* Loading Skeleton */}
      {loading && (
        <div className="rounded-lg border overflow-hidden">
          <div className="bg-muted/50 border-b px-4 py-3">
            <div className="flex gap-4">
              {[16, 96, 128, 80, 80, 96, 80].map((w, i) => (
                <div key={i} className="h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" style={{ width: w }} />
              ))}
            </div>
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
              <div className="flex gap-4 items-center">
                {[16, 80, 160, 64, 80, 96, 80].map((w, j) => (
                  <div key={j} className={`h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse ${j === 4 ? 'rounded-full h-6' : ''}`} style={{ width: w }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Desktop Table View */}
      {!loading && !error && viewMode === 'list' && !isMobile && projectId && (
        <LotTable
          displayedLots={displayedLots}
          filteredLots={filteredLots}
          allLots={lots}
          orderedVisibleColumns={orderedVisibleColumns}
          searchQuery={searchQuery}
          sortField={sortField}
          sortDirection={sortDirection}
          canDelete={canDelete}
          canCreate={canCreate}
          canViewBudgets={canViewBudgets}
          isSubcontractor={isSubcontractor}
          projectId={projectId}
          selectedLots={actions.selectedLots}
          onSelectLot={actions.handleSelectLot}
          onSelectAll={actions.handleSelectAll}
          allDeletableSelected={actions.allDeletableSelected}
          onSort={actions.handleSort}
          onDeleteClick={actions.handleDeleteClick}
          onCloneLot={actions.handleCloneLot}
          onContextMenu={actions.handleContextMenu}
          onLotMouseEnter={actions.handleLotMouseEnter}
          onLotMouseLeave={actions.handleLotMouseLeave}
          onOpenCreateModal={() => actions.setCreateModalOpen(true)}
          loadMoreRef={loadMoreRef}
          loadingMore={loadingMore}
          hasMore={hasMore}
        />
      )}

      {/* Card / Mobile View */}
      {!loading && !error && (viewMode === 'card' || (viewMode === 'list' && isMobile)) && projectId && (
        <LotMobileList
          displayedLots={displayedLots}
          filteredLots={filteredLots}
          allLots={lots}
          isMobile={isMobile}
          isSubcontractor={isSubcontractor}
          canCreate={canCreate}
          projectId={projectId}
          onContextMenu={actions.handleContextMenu}
          onRefresh={fetchLots}
          loadMoreRef={loadMoreRef}
          loadingMore={loadingMore}
          hasMore={hasMore}
        />
      )}

      {/* Feature #151 - Linear Map View */}
      {!loading && !error && viewMode === 'linear' && (
        <div className="rounded-lg border overflow-hidden" data-testid="linear-map-view">
          {filteredLots.filter(l => l.chainageStart !== null || l.chainageEnd !== null).length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">&#128506;</div>
              <h3 className="text-lg font-semibold text-gray-900">No chainage data</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add chainage values to lots to see them on the linear map.</p>
            </div>
          ) : (
            <LinearMapView lots={filteredLots} onLotClick={(lot) => navigate(`/projects/${projectId}/lots/${lot.id}`)} statusColors={statusColors} areas={projectAreas} />
          )}
        </div>
      )}

      {/* Context Menu */}
      {projectId && (
        <LotContextMenu
          contextMenu={actions.contextMenu}
          projectId={projectId}
          canCreate={canCreate}
          canDelete={canDelete}
          onClose={actions.closeContextMenu}
          onDeleteClick={actions.handleDeleteClick}
          onCloneLot={actions.handleCloneLot}
        />
      )}

      {/* Quick View Popup */}
      {actions.quickViewLot && projectId && (
        <LotQuickView lotId={actions.quickViewLot.id} projectId={projectId} position={actions.quickViewLot.position} onClose={actions.handleQuickViewClose} />
      )}

      {/* Single Delete Modal */}
      <DeleteLotModal
        isOpen={actions.deleteModalOpen}
        lot={actions.lotToDelete}
        onClose={() => { actions.setDeleteModalOpen(false); actions.setLotToDelete(null) }}
        onDeleted={actions.handleDeleteSuccess}
        onError={(msg) => setError(msg)}
      />

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={actions.bulkDeleteModalOpen}
        selectedCount={actions.selectedLots.size}
        onClose={() => actions.setBulkDeleteModalOpen(false)}
        onConfirm={actions.handleBulkDelete}
      />

      {/* Bulk Status Update Modal */}
      <BulkStatusModal
        isOpen={actions.bulkStatusModalOpen}
        selectedCount={actions.selectedLots.size}
        onClose={() => actions.setBulkStatusModalOpen(false)}
        onConfirm={actions.handleBulkStatusUpdate}
      />

      {/* Bulk Assign Modal */}
      <BulkAssignModal
        isOpen={actions.bulkAssignModalOpen}
        selectedCount={actions.selectedLots.size}
        subcontractors={subcontractors}
        onClose={() => actions.setBulkAssignModalOpen(false)}
        onConfirm={actions.handleBulkAssignSubcontractor}
      />

      {/* Create Lot Modal */}
      {projectId && (
        <CreateLotModal
          isOpen={actions.createModalOpen}
          onClose={() => actions.setCreateModalOpen(false)}
          onSuccess={actions.handleCreateSuccess}
          projectId={projectId}
        />
      )}

      {/* Bulk Create Lots Wizard */}
      {actions.bulkWizardOpen && projectId && (
        <BulkCreateLotsWizard projectId={projectId} onClose={() => actions.setBulkWizardOpen(false)} onSuccess={() => { actions.setBulkWizardOpen(false); fetchLots() }} />
      )}

      {/* Import Lots Modal */}
      {actions.importModalOpen && projectId && (
        <ImportLotsModal projectId={projectId} onClose={() => actions.setImportModalOpen(false)} onSuccess={() => { actions.setImportModalOpen(false); fetchLots() }} />
      )}

      {/* Export Lots Modal */}
      {actions.exportModalOpen && projectId && (
        <ExportLotsModal projectId={projectId} lots={filteredLots} canViewBudgets={canViewBudgets} isSubcontractor={isSubcontractor} onClose={() => actions.setExportModalOpen(false)} />
      )}

      {/* Print Labels Modal */}
      {actions.printLabelsModalOpen && projectId && (
        <PrintLabelsModal lots={lots.filter(lot => actions.selectedLots.has(lot.id))} projectId={projectId} onClose={() => actions.setPrintLabelsModalOpen(false)} />
      )}

      {/* Mobile Floating Action Button */}
      {!isSubcontractor && canCreate && (
        <ContextFAB actions={[{ id: 'add-lot', label: 'Add Lot', icon: <Plus className="w-5 h-5" />, color: 'bg-primary', onClick: () => actions.setCreateModalOpen(true) }]} />
      )}
    </div>
  )
}
