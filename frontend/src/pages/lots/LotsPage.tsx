import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useCommercialAccess } from '@/hooks/useCommercialAccess';
import { useSubcontractorAccess } from '@/hooks/useSubcontractorAccess';
import { useViewerAccess } from '@/hooks/useViewerAccess';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useAuth } from '@/lib/auth';
import { BulkCreateLotsWizard } from '@/components/lots/BulkCreateLotsWizard';
import { ImportLotsModal } from '@/components/lots/ImportLotsModal';
import { ExportLotsModal } from '@/components/lots/ExportLotsModal';
import { LotQuickView } from '@/components/lots/LotQuickView';
import { PrintLabelsModal } from '@/components/lots/PrintLabelsModal';
import { LinearMapView } from '@/components/lots/LinearMapView';
import { Printer, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContextFAB } from '@/components/mobile/ContextFAB';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';
import { parseJsonPreference, readLocalStorageItem } from '@/lib/storagePreferences';

// Extracted components
import { LotFiltersBar, type ColumnId, DEFAULT_COLUMN_ORDER } from './components/LotFiltersBar';
import { LotTable } from './components/LotTable';
import { LotMobileList } from './components/LotMobileList';
import { CreateLotModal } from './components/CreateLotModal';
import { LotContextMenu } from './components/LotContextMenu';
import { DeleteLotModal } from './components/DeleteLotModal';
import { BulkDeleteModal, BulkStatusModal, BulkAssignModal } from './components/BulkActionModals';

// Extracted hooks
import { useLotsData } from './hooks/useLotsData';
import { useLotsActions } from './hooks/useLotsActions';

// Roles that can delete lots
const LOT_DELETE_ROLES = ['owner', 'admin', 'project_manager'];

// Column persistence keys
const COLUMN_STORAGE_KEY = 'siteproof_lot_columns';
const COLUMN_ORDER_STORAGE_KEY = 'siteproof_lot_column_order';
const LOT_VIEW_MODE_STORAGE_KEY = 'siteproof_lot_view_mode';
const VALID_COLUMN_IDS = new Set<ColumnId>(DEFAULT_COLUMN_ORDER);

// Feature #438: Okabe-Ito color-blind safe palette (shared with LinearMapView)
const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
  in_progress: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200',
  completed: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200',
  on_hold: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200',
  not_started: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200',
};

function getValidColumnIds(value: unknown): ColumnId[] | null {
  if (!Array.isArray(value)) return null;

  const columns = value.filter(
    (item): item is ColumnId => typeof item === 'string' && VALID_COLUMN_IDS.has(item as ColumnId),
  );

  return Array.from(new Set(columns));
}

function parseColumnPreference(raw: string | null): ColumnId[] {
  return parseJsonPreference(raw, DEFAULT_COLUMN_ORDER, (value) => {
    const columns = getValidColumnIds(value);
    if (!columns) return null;
    return columns.includes('lotNumber') ? columns : ['lotNumber', ...columns];
  });
}

function parseColumnOrderPreference(raw: string | null): ColumnId[] {
  return parseJsonPreference(raw, DEFAULT_COLUMN_ORDER, (value) => {
    const columns = getValidColumnIds(value);
    if (!columns) return null;

    const withoutRequiredColumn = columns.filter((column) => column !== 'lotNumber');
    const orderedColumns = ['lotNumber', ...withoutRequiredColumn] as ColumnId[];
    const missingColumns = DEFAULT_COLUMN_ORDER.filter(
      (column) => !orderedColumns.includes(column),
    );
    return [...orderedColumns, ...missingColumns];
  });
}

export function LotsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { canViewBudgets } = useCommercialAccess();
  const { isSubcontractor } = useSubcontractorAccess();
  const { canCreate } = useViewerAccess();
  const isMobile = useIsMobile();

  // URL-based filter state
  const statusFilterParam = searchParams.get('status') || '';
  const statusFilters = statusFilterParam ? statusFilterParam.split(',').filter(Boolean) : [];
  const activityFilter = searchParams.get('activity') || '';
  const searchQuery = searchParams.get('search') || '';
  const sortField = searchParams.get('sort') || 'lotNumber';
  const sortDirection = (searchParams.get('dir') || 'asc') as 'asc' | 'desc';
  const chainageMinFilter = searchParams.get('chMin') || '';
  const chainageMaxFilter = searchParams.get('chMax') || '';
  const subcontractorFilter = searchParams.get('subcontractor') || '';
  const areaZoneFilter = searchParams.get('areaZone') || '';

  // Data hook
  const {
    lots,
    setLots,
    loading,
    error,
    setError,
    projectName,
    subcontractors,
    projectAreas,
    activityTypes,
    areaZones,
    filteredLots,
    displayedLots,
    hasMore,
    loadMoreRef,
    loadingMore,
    fetchLots,
    fetchSubcontractors,
  } = useLotsData({
    projectId,
    isSubcontractor,
    statusFilters,
    activityFilter,
    searchQuery,
    sortField,
    sortDirection,
    chainageMinFilter,
    chainageMaxFilter,
    subcontractorFilter,
    areaZoneFilter,
  });

  // Actions hook
  const actions = useLotsActions({
    lots,
    setLots,
    displayedLots,
    fetchLots,
    fetchSubcontractors,
    subcontractors,
  });

  // Access checks
  const canDelete = user?.role ? LOT_DELETE_ROLES.includes(user.role) : false;

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'card' | 'linear'>(() => {
    const stored = readLocalStorageItem(LOT_VIEW_MODE_STORAGE_KEY);
    if (stored === 'card' || stored === 'linear') return stored;
    return 'list';
  });

  // Column customization state
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(() => {
    return parseColumnPreference(readLocalStorageItem(COLUMN_STORAGE_KEY));
  });

  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(() => {
    return parseColumnOrderPreference(readLocalStorageItem(COLUMN_ORDER_STORAGE_KEY));
  });

  const orderedVisibleColumns = useMemo(() => {
    return columnOrder.filter((colId) => visibleColumns.includes(colId));
  }, [columnOrder, visibleColumns]);

  const projectLabel = projectName || projectId || 'this project';

  const toggleViewMode = (mode: 'list' | 'card' | 'linear') => {
    setViewMode(mode);
    actions.toggleViewMode(mode);
  };

  // =====================
  // Render
  // =====================
  return (
    <div className="space-y-6 p-6">
      {/* Print-only Header */}
      <div className="hidden print:block report-header mb-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Lot Register</h1>
        {projectName && <p className="text-muted-foreground mb-1">{projectName}</p>}
        <div className="text-sm text-muted-foreground">
          Generated:{' '}
          {new Date().toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          SiteProof - Quality Management System
        </div>
      </div>

      {/* Print-only Footer */}
      <div className="hidden print:block report-footer fixed bottom-0 left-0 right-0 text-center text-xs text-muted-foreground py-2 bg-card border-t">
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
              <Button variant="outline" onClick={() => actions.setExportModalOpen(true)}>
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => window.print()} className="print:hidden">
                <Printer className="h-4 w-4" /> Print Register
              </Button>
            </>
          )}
          {canCreate && actions.selectedLots.size > 0 && (
            <>
              <Button variant="outline" onClick={() => actions.setBulkStatusModalOpen(true)}>
                Update Status ({actions.selectedLots.size})
              </Button>
              {!isSubcontractor && (
                <Button variant="outline" onClick={actions.handleOpenBulkAssignModal}>
                  Assign Subcontractor ({actions.selectedLots.size})
                </Button>
              )}
            </>
          )}
          {canDelete && actions.selectedLots.size > 0 && (
            <Button
              variant="outline"
              className="text-red-600 border-red-600 hover:bg-red-50"
              onClick={() => actions.setBulkDeleteModalOpen(true)}
            >
              Delete Selected ({actions.selectedLots.size})
            </Button>
          )}
          {actions.selectedLots.size > 0 && (
            <Button
              variant="outline"
              className="text-green-600 border-green-600 hover:bg-green-50"
              onClick={() => actions.setPrintLabelsModalOpen(true)}
            >
              Print Labels ({actions.selectedLots.size})
            </Button>
          )}
          {!isSubcontractor && canCreate && (
            <>
              {!isMobile && (
                <>
                  <Button variant="outline" onClick={() => actions.setImportModalOpen(true)}>
                    Import CSV
                  </Button>
                  <Button variant="outline" onClick={() => actions.setBulkWizardOpen(true)}>
                    Bulk Create Lots
                  </Button>
                </>
              )}
              <Button onClick={() => actions.setCreateModalOpen(true)}>Create Lot</Button>
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {isSubcontractor
          ? `Viewing lots assigned to your company for ${projectLabel}.`
          : `Manage lots for ${projectLabel}. The lot is the atomic unit of the system.`}
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
        <div className="rounded-lg border overflow-hidden" role="status" aria-label="Loading lots">
          <div className="bg-muted/50 border-b px-4 py-3">
            <div className="flex gap-4">
              {[16, 96, 128, 80, 80, 96, 80].map((w, i) => (
                <div key={i} className="h-4 rounded bg-muted animate-pulse" style={{ width: w }} />
              ))}
            </div>
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-4 py-3 border-b border-border last:border-b-0">
              <div className="flex gap-4 items-center">
                {[16, 80, 160, 64, 80, 96, 80].map((w, j) => (
                  <div
                    key={j}
                    className={`h-4 rounded bg-muted animate-pulse ${j === 4 ? 'rounded-full h-6' : ''}`}
                    style={{ width: w }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
          role="alert"
          aria-live="assertive"
        >
          <p className="font-medium">Could not load lots</p>
          <p className="mt-1 text-sm">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-red-300 bg-white text-red-700 hover:bg-red-100"
            onClick={() => void fetchLots()}
          >
            Try again
          </Button>
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
          cloningLotId={actions.cloningLotId}
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
      {!loading &&
        !error &&
        (viewMode === 'card' || (viewMode === 'list' && isMobile)) &&
        projectId && (
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
          {filteredLots.filter((l) => l.chainageStart !== null || l.chainageEnd !== null).length ===
          0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">&#128506;</div>
              <h3 className="text-lg font-semibold text-foreground">No chainage data</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add chainage values to lots to see them on the linear map.
              </p>
            </div>
          ) : (
            <LinearMapView
              lots={filteredLots}
              onLotClick={(lot) =>
                navigate(
                  `/projects/${encodeURIComponent(projectId || '')}/lots/${encodeURIComponent(lot.id)}`,
                )
              }
              statusColors={statusColors}
              areas={projectAreas}
            />
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
        <LotQuickView
          lotId={actions.quickViewLot.id}
          projectId={projectId}
          position={actions.quickViewLot.position}
          onClose={actions.handleQuickViewClose}
        />
      )}

      {/* Single Delete Modal */}
      <DeleteLotModal
        isOpen={actions.deleteModalOpen}
        lot={actions.lotToDelete}
        onClose={() => {
          actions.setDeleteModalOpen(false);
          actions.setLotToDelete(null);
        }}
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
        <BulkCreateLotsWizard
          projectId={projectId}
          onClose={() => actions.setBulkWizardOpen(false)}
          onSuccess={() => {
            actions.setBulkWizardOpen(false);
            fetchLots();
          }}
        />
      )}

      {/* Import Lots Modal */}
      {actions.importModalOpen && projectId && (
        <ImportLotsModal
          projectId={projectId}
          onClose={() => actions.setImportModalOpen(false)}
          onSuccess={() => {
            actions.setImportModalOpen(false);
            fetchLots();
          }}
        />
      )}

      {/* Export Lots Modal */}
      {actions.exportModalOpen && projectId && (
        <ExportLotsModal
          projectId={projectId}
          lots={filteredLots}
          canViewBudgets={canViewBudgets}
          isSubcontractor={isSubcontractor}
          onClose={() => actions.setExportModalOpen(false)}
        />
      )}

      {/* Print Labels Modal */}
      {actions.printLabelsModalOpen && projectId && (
        <PrintLabelsModal
          lots={lots.filter((lot) => actions.selectedLots.has(lot.id))}
          projectId={projectId}
          onClose={() => actions.setPrintLabelsModalOpen(false)}
        />
      )}

      {/* Mobile Floating Action Button */}
      {!isSubcontractor && canCreate && (
        <ContextFAB
          actions={[
            {
              id: 'add-lot',
              label: 'Add Lot',
              icon: <Plus className="w-5 h-5" />,
              color: 'bg-primary',
              onClick: () => actions.setCreateModalOpen(true),
            },
          ]}
        />
      )}
    </div>
  );
}
