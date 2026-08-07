import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useCommercialAccess } from '@/hooks/useCommercialAccess';
import { useSubcontractorAccess } from '@/hooks/useSubcontractorAccess';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useAuth } from '@/lib/auth';
import { canCreateLots, canDeleteLots, canEditLots, canManageProjectSettings } from '@/lib/roles';
import { getProjectScopedRole } from '@/lib/subcontractorIdentity';
import { useImportBatches } from '@/pages/projects/copilot/importData';
import { useRollbackProposal } from '@/pages/projects/copilot/copilotData';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { LinearMapView } from '@/components/lots/LinearMapView';
import { Plus } from 'lucide-react';
import { ContextFAB } from '@/components/mobile/ContextFAB';
import { AccessDeniedState } from '@/components/AccessDeniedState';
import { readLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';

// Extracted components
import { LotFiltersBar } from './components/LotFiltersBar';
import { LotsPageHeader } from './components/LotsPageHeader';
import {
  COLUMN_ORDER_STORAGE_KEY,
  COLUMN_STORAGE_KEY,
  type ColumnId,
} from './components/lotFilterConfig';
import { LotTable } from './components/LotTable';
import { LotSelectionBar } from './components/LotSelectionBar';
import {
  COLLAPSED_GROUPS_STORAGE_KEY,
  countLotGroups,
  parseCollapsedGroupsPreference,
  parseLotGroupBy,
  roleDefaultLotPreset,
} from './components/lotRegisterQueue';
import { LotMobileList } from './components/LotMobileList';
import { LotsPageModals } from './components/LotsPageModals';
import { LotTableSkeleton, LotsLoadErrorBanner } from './components/LotsPageChrome';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, actualRole } = useAuth();
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
  const groupBy = parseLotGroupBy(searchParams.get('group'));

  // Role landing view: a quality manager works a queue of blocked lots, so the
  // register opens on "Needs attention" rather than on all 109 rows. Applied
  // once per visit and only when the user arrived with no filters of their own,
  // so picking "All" afterwards sticks.
  const roleDefaultApplied = useRef(false);
  useEffect(() => {
    if (roleDefaultApplied.current || !actualRole) return;
    roleDefaultApplied.current = true;

    const preset = roleDefaultLotPreset(actualRole);
    if (preset && searchParams.toString() === '') {
      setSearchParams(new URLSearchParams(preset.query), { replace: true });
    }
  }, [actualRole, searchParams, setSearchParams]);

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
    groupBy,
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

  // Group band state. Counts come from the whole filtered register so a band
  // reads "Conformed (34)" even while only the first page of rows has loaded.
  // Collapsed keys persist per device alongside the other lot view preferences.
  const groupCounts = useMemo(
    () => (groupBy ? countLotGroups(filteredLots, groupBy) : new Map<string, number>()),
    [filteredLots, groupBy],
  );

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() =>
    parseCollapsedGroupsPreference(readLocalStorageItem(COLLAPSED_GROUPS_STORAGE_KEY)),
  );

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      writeLocalStorageItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

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
  // Map mode is a WORKSPACE: a compact rail (header + filters) over a map that
  // fills the rest of the viewport — not a 520px strip inside a card. h-full
  // resolves against <main>'s definite flex height (MainLayout).
  const isMapWorkspace = viewMode === 'map';
  return (
    <div className={isMapWorkspace ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-6 p-6'}>
      {/* Page Header */}
      <LotsPageHeader
        isMobile={isMobile}
        isSubcontractor={isSubcontractor}
        canCreate={canCreate}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        onOpenExport={() => actions.setExportModalOpen(true)}
        onOpenImport={() => actions.setImportModalOpen(true)}
        onOpenBulkWizard={() => actions.setBulkWizardOpen(true)}
        onOpenCreate={() => actions.setCreateModalOpen(true)}
      />
      {/* The workspace rail stays compact — the map is the page there. */}
      {!isMapWorkspace && (
        <p className="text-sm text-muted-foreground">
          {isSubcontractor
            ? `Viewing lots assigned to your company for ${projectLabel}.`
            : `Manage lots for ${projectLabel}. The lot is the atomic unit of the system.`}
        </p>
      )}

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
        groupBy={groupBy}
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

      {/* Bulk actions live above the rows they act on, not in the page header:
          a selection you cannot see the verbs for is a selection nobody uses. */}
      <LotSelectionBar
        selectedCount={actions.selectedLots.size}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        isSubcontractor={isSubcontractor}
        hasGoverningRuleset={Boolean(governingRuleset)}
        rulesetLoadFailed={rulesetLoadFailed}
        onRetryRulesetLoad={retryRulesetLoad}
        onClearSelection={actions.clearSelection}
        onOpenBulkStatus={() => actions.setBulkStatusModalOpen(true)}
        onOpenBulkAssign={actions.handleOpenBulkAssignModal}
        onOpenBulkTestAttributes={() => actions.setBulkTestAttributesModalOpen(true)}
        onOpenBulkDelete={() => actions.setBulkDeleteModalOpen(true)}
        onOpenPrintLabels={() => actions.setPrintLabelsModalOpen(true)}
      />

      {loading && !isMobile && viewMode !== 'card' && !isMapWorkspace && <LotTableSkeleton />}
      {loading && isMapWorkspace && (
        <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-muted" role="status" />
      )}

      {error && <LotsLoadErrorBanner message={error} onRetry={() => void fetchLots()} />}

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
          groupBy={groupBy}
          groupCounts={groupCounts}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
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

      {/* The spatial workspace: the map takes every remaining viewport pixel. */}
      {!loading && !error && viewMode === 'map' && projectId && (
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border" data-testid="map-view">
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
              variant="workspace"
            />
          </Suspense>
        </div>
      )}

      {/* Every overlay the register can open. Gated on projectId as one block:
            none of them mean anything without a register behind them, and the
            register itself does not render without one either. */}
      {projectId && (
        <LotsPageModals
          projectId={projectId}
          actions={actions}
          lots={lots}
          filteredLots={filteredLots}
          projectName={projectName}
          subcontractors={subcontractors}
          canCreate={canCreate}
          canDelete={canDelete}
          canViewBudgets={canViewBudgets}
          commercialAccessReason={commercialAccessReason}
          isSubcontractor={isSubcontractor}
          activityFilter={activityFilter}
          governingRuleset={governingRuleset ?? null}
          importBatches={importBatchesQuery.data ?? []}
          onImportRollback={(proposalId) => void handleImportRollback(proposalId)}
          onImportApplied={() => {
            void importBatchesQuery.refetch();
            fetchLots();
          }}
          onBulkCreated={() => {
            actions.setBulkWizardOpen(false);
            fetchLots();
          }}
          onError={(message) => setError(message)}
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
