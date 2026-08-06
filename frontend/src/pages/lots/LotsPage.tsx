import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useMemo, lazy, Suspense } from 'react';
import { useCommercialAccess } from '@/hooks/useCommercialAccess';
import { useSubcontractorAccess } from '@/hooks/useSubcontractorAccess';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useAuth } from '@/lib/auth';
import { canCreateLots, canDeleteLots, canEditLots, canManageProjectSettings } from '@/lib/roles';
import { getProjectScopedRole } from '@/lib/subcontractorIdentity';
import { BulkCreateLotsWizard } from '@/components/lots/BulkCreateLotsWizard';
import { ImportReviewModal } from '@/pages/projects/copilot/ImportReviewModal';
import { useImportBatches } from '@/pages/projects/copilot/importData';
import { useRollbackProposal } from '@/pages/projects/copilot/copilotData';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { ExportLotsModal } from '@/components/lots/ExportLotsModal';
import { LotQuickView } from '@/components/lots/LotQuickView';
import { PrintLabelsModal } from '@/components/lots/PrintLabelsModal';
import { LinearMapView } from '@/components/lots/LinearMapView';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContextFAB } from '@/components/mobile/ContextFAB';
import { AccessDeniedState } from '@/components/AccessDeniedState';
import { readLocalStorageItem } from '@/lib/storagePreferences';

// Extracted components
import { LotFiltersBar } from './components/LotFiltersBar';
import { LotsPageHeader } from './components/LotsPageHeader';
import {
  COLUMN_ORDER_STORAGE_KEY,
  COLUMN_STORAGE_KEY,
  type ColumnId,
} from './components/lotFilterConfig';
import { LotTable } from './components/LotTable';
import { LotMobileList } from './components/LotMobileList';
import { CreateLotModal } from './components/CreateLotModal';
import { LotContextMenu } from './components/LotContextMenu';
import { DeleteLotModal } from './components/DeleteLotModal';
import {
  BulkDeleteModal,
  BulkStatusModal,
  BulkAssignModal,
  BulkTestAttributesModal,
} from './components/BulkActionModals';
import { useGoverningRuleset } from '@/hooks/useGoverningRuleset';

// Extracted hooks
import { useLotsData } from './hooks/useLotsData';
import { useLotsActions } from './hooks/useLotsActions';
import { parseColumnOrderPreference, parseColumnPreference } from './lotsPagePreferences';

// Lazy so Leaflet (map engine + tiles) never enters the core/register bundle;
// only loaded when the user switches to the map view.
const LotMapView = lazy(() => import('./map/LotMapView').then((m) => ({ default: m.LotMapView })));

const LOT_VIEW_MODE_STORAGE_KEY = 'siteproof_lot_view_mode';

export function LotsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { canViewBudgets, commercialAccessReason } = useCommercialAccess();
  const { isSubcontractor } = useSubcontractorAccess();
  const isMobile = useIsMobile();
  // Wave C1 (§9.4): the bulk affordance only appears where a shipped frequency
  // ruleset governs the project.
  const { governingRuleset, rulesetLoadFailed, retryRulesetLoad } = useGoverningRuleset(projectId);

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
    accessDenied,
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

  // Lot register imports (Wave B B2) — the batch list backs resume and roll back.
  const importBatchesQuery = useImportBatches(projectId, 'lot_register');
  const importRollbackMutation = useRollbackProposal(projectId);

  const handleImportRollback = async (proposalId: string) => {
    try {
      await importRollbackMutation.mutateAsync(proposalId);
      void importBatchesQuery.refetch();
      fetchLots();
      toast({ title: 'Import rolled back', description: 'Those lots have been removed.' });
    } catch (error) {
      logError('Failed to roll back lot import:', error);
      toast({
        title: 'Could not roll back',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  // Access checks
  const projectScopedRole = getProjectScopedRole(user);
  const canCreate = canCreateLots(projectScopedRole);
  const canEdit = canEditLots(projectScopedRole);
  const canDelete = canDeleteLots(projectScopedRole);

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'card' | 'linear' | 'map'>(() => {
    const stored = readLocalStorageItem(LOT_VIEW_MODE_STORAGE_KEY);
    if (stored === 'card' || stored === 'linear' || stored === 'map') return stored;
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

  const canManageSettings = canManageProjectSettings(projectScopedRole);
  const filteredLotIds = useMemo(() => new Set(filteredLots.map((lot) => lot.id)), [filteredLots]);

  const toggleViewMode = (mode: 'list' | 'card' | 'linear' | 'map') => {
    setViewMode(mode);
    actions.toggleViewMode(mode);
  };

  if (!loading && accessDenied) {
    return <AccessDeniedState message={error ?? undefined} />;
  }

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
        <div className="text-xs text-muted-foreground mt-2">CIVOS - Quality Management System</div>
      </div>

      {/* Print-only Footer */}
      <div className="hidden print:block report-footer fixed bottom-0 left-0 right-0 text-center text-xs text-muted-foreground py-2 bg-card border-t">
        &copy; {new Date().getFullYear()} CIVOS - Confidential
      </div>

      {/* Page Header */}
      <LotsPageHeader
        isMobile={isMobile}
        isSubcontractor={isSubcontractor}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        selectedCount={actions.selectedLots.size}
        hasGoverningRuleset={Boolean(governingRuleset)}
        rulesetLoadFailed={rulesetLoadFailed}
        onRetryRulesetLoad={retryRulesetLoad}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        onOpenExport={() => actions.setExportModalOpen(true)}
        onPrintRegister={() => window.print()}
        onOpenImport={() => actions.setImportModalOpen(true)}
        onOpenBulkWizard={() => actions.setBulkWizardOpen(true)}
        onOpenCreate={() => actions.setCreateModalOpen(true)}
        onOpenBulkStatus={() => actions.setBulkStatusModalOpen(true)}
        onOpenBulkAssign={actions.handleOpenBulkAssignModal}
        onOpenBulkTestAttributes={() => actions.setBulkTestAttributesModalOpen(true)}
        onOpenBulkDelete={() => actions.setBulkDeleteModalOpen(true)}
        onOpenPrintLabels={() => actions.setPrintLabelsModalOpen(true)}
      />
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

      {/* Loading Skeleton — desktop table only.
          Mobile/card view renders LotMobileList with isLoading=true (see below)
          so it shows its own layout-matched card skeleton instead of this table skeleton. */}
      {loading && !isMobile && viewMode !== 'card' && (
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
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
          role="alert"
          aria-live="assertive"
        >
          <p className="font-medium">Could not load lots</p>
          <p className="mt-1 text-sm">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-destructive/30 bg-card text-destructive hover:bg-destructive/10"
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

      {/* Card / Mobile View — rendered during loading too so LotMobileList shows
          its own layout-matched skeleton (isLoading=true, displayedLots empty).
          Error state suppresses the list entirely (existing behaviour). */}
      {!error && (viewMode === 'card' || (viewMode === 'list' && isMobile)) && projectId && (
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
          isLoading={loading}
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
              areas={projectAreas}
            />
          )}
        </div>
      )}

      {/* Phase 2 - Satellite Basemap Map View */}
      {!loading && !error && viewMode === 'map' && projectId && (
        <div className="rounded-lg border overflow-hidden" data-testid="map-view">
          <Suspense
            fallback={
              <div className="p-12 text-center text-sm text-muted-foreground" role="status">
                Loading map…
              </div>
            }
          >
            <LotMapView
              projectId={projectId}
              filteredLotIds={filteredLotIds}
              canManageSettings={canManageSettings}
              projectName={projectName}
              lots={lots}
            />
          </Suspense>
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

      {/* Bulk Set Testing Attributes Modal — Wave C1 */}
      {governingRuleset && (
        <BulkTestAttributesModal
          isOpen={actions.bulkTestAttributesModalOpen}
          selectedCount={actions.selectedLots.size}
          ruleset={governingRuleset}
          onClose={() => actions.setBulkTestAttributesModalOpen(false)}
          onConfirm={actions.handleBulkSetTestAttributes}
        />
      )}

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
          canViewBudgets={canViewBudgets}
          commercialAccessReason={commercialAccessReason}
          initialActivityType={activityFilter || undefined}
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

      {/* Lot register import — Wave B B2. Replaces the client-side CSV importer:
          the server parses the file, every lot is reviewed beside its register,
          nothing is written until one proposal is accepted, and the whole batch
          can be rolled back. */}
      {actions.importModalOpen && projectId && (
        <ImportReviewModal
          projectId={projectId}
          kind="lot_register"
          batches={importBatchesQuery.data ?? []}
          onRollback={(proposalId) => void handleImportRollback(proposalId)}
          onApplied={() => {
            void importBatchesQuery.refetch();
            fetchLots();
          }}
          onClose={() => actions.setImportModalOpen(false)}
        />
      )}

      {/* Export Lots Modal */}
      {actions.exportModalOpen && projectId && (
        <ExportLotsModal
          projectId={projectId}
          projectName={projectName}
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
