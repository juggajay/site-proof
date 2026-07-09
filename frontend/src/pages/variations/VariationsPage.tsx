import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { getAuthToken } from '@/lib/auth';
import { formatStatusLabel } from '@/lib/statusLabels';
import { Button } from '@/components/ui/button';
import { ContextFAB } from '@/components/mobile/ContextFAB';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useRegisterDeepLink } from '@/hooks/useRegisterDeepLink';
import { CreateVariationModal } from './components/CreateVariationModal';
import { VariationDetailSheet } from './components/VariationDetailSheet';
import { VariationMobileList } from './components/VariationMobileList';
import { VariationTable } from './components/VariationTable';
import { useVariationActions } from './hooks/useVariationActions';
import { useVariationModals } from './hooks/useVariationModals';
import { useVariationsData } from './hooks/useVariationsData';
import type { Variation, VariationStatusFilter } from './types';
import { VARIATION_STATUSES } from './types';

const getVariationId = (variation: Variation) => variation.id;
const VARIATION_LINK_NOT_FOUND = {
  title: "Couldn't find that variation",
  description: 'The link may belong to another project, or the variation may have been deleted.',
};

function statusFilterLabel(status: VariationStatusFilter, count: number) {
  return status === 'all' ? `All ${count}` : `${formatStatusLabel(status)} ${count}`;
}

function VariationStatusFilters({
  selectedStatus,
  variations,
  onChange,
}: {
  selectedStatus: VariationStatusFilter;
  variations: Variation[];
  onChange: (status: VariationStatusFilter) => void;
}) {
  const counts = useMemo(() => {
    const next = new Map<VariationStatusFilter, number>([['all', variations.length]]);
    for (const status of VARIATION_STATUSES) {
      next.set(status, variations.filter((variation) => variation.status === status).length);
    }
    return next;
  }, [variations]);

  const filters: VariationStatusFilter[] = ['all', ...VARIATION_STATUSES];

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-2">
      {filters.map((status) => {
        const isActive = selectedStatus === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={
              isActive
                ? 'rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
                : 'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
            }
          >
            {statusFilterLabel(status, counts.get(status) ?? 0)}
          </button>
        );
      })}
    </div>
  );
}

export function VariationsPage() {
  const { projectId } = useParams();
  const token = getAuthToken();
  const isMobile = useIsMobile();
  const [selectedStatus, setSelectedStatus] = useState<VariationStatusFilter>('all');

  const { variations, lots, loading, error, setError, fetchVariations } = useVariationsData({
    projectId,
    token,
  });
  const { activeModal, selectedVariation, openModal, closeModal } = useVariationModals();
  const {
    actionLoading,
    successMessage,
    copiedVariationId,
    handleCreateVariation,
    handleUpdateVariation,
    handleSubmitVariation,
    handleApproveVariation,
    handleRejectVariation,
    handleDeleteVariation,
    handleAddEvidence,
    handleRemoveEvidence,
    handleCopyVariationLink,
    handleExportCSV,
  } = useVariationActions({ projectId, fetchVariations, setError, closeModal });

  const lotsById = useMemo(() => new Map(lots.map((lot) => [lot.id, lot])), [lots]);

  const { highlightedId: deepLinkedVariationId } = useRegisterDeepLink({
    param: 'variation',
    loading: loading || Boolean(error),
    records: variations,
    getRecordId: getVariationId,
    notFound: VARIATION_LINK_NOT_FOUND,
  });

  const { containerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: async () => {
      await fetchVariations();
    },
    enabled: isMobile,
  });

  const displayedVariations = useMemo(
    () =>
      selectedStatus === 'all'
        ? variations
        : variations.filter((variation) => variation.status === selectedStatus),
    [selectedStatus, variations],
  );

  const handleSubmitForm = useCallback(
    async (data: Parameters<typeof handleCreateVariation>[0]) => {
      if (activeModal === 'edit' && selectedVariation) {
        await handleUpdateVariation(selectedVariation.id, data);
        return;
      }
      await handleCreateVariation(data);
    },
    [activeModal, handleCreateVariation, handleUpdateVariation, selectedVariation],
  );

  if (loading) {
    return (
      <div
        className="flex h-64 items-center justify-center"
        role="status"
        aria-label="Loading variations"
      >
        <span className="sr-only">Loading variations...</span>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Variation Register</h1>
            <ContextHelp
              title={HELP_CONTENT.variations.title}
              content={HELP_CONTENT.variations.content}
            />
          </div>
          <p className="mt-1 text-muted-foreground">
            Track changed or extra work from proposal through approval and claim.
          </p>
        </div>
        <div className="flex gap-2">
          {!isMobile && displayedVariations.length > 0 && (
            <Button
              variant="outline"
              onClick={() => handleExportCSV(displayedVariations, lotsById)}
            >
              Export CSV
            </Button>
          )}
          <Button onClick={() => openModal('create')}>
            <Plus className="h-4 w-4" />
            New Variation
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={fetchVariations}>
                Try again
              </Button>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-destructive hover:text-destructive/80"
                aria-label="Dismiss variation error"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-success"
        >
          {successMessage}
        </div>
      )}

      <VariationStatusFilters
        selectedStatus={selectedStatus}
        variations={variations}
        onChange={setSelectedStatus}
      />

      {!error && displayedVariations.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center">
          <h3 className="text-lg font-medium">
            {variations.length === 0 ? 'No variations yet' : 'No variations match your filters'}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-muted-foreground">
            {variations.length === 0
              ? 'Track changed or extra work, get it approved, claim it in a progress claim'
              : 'Try a different status filter.'}
          </p>
          {variations.length === 0 && (
            <Button className="mt-4" onClick={() => openModal('create')}>
              <Plus className="h-4 w-4" />
              New Variation
            </Button>
          )}
        </div>
      ) : !error && isMobile ? (
        <VariationMobileList
          variations={displayedVariations}
          lotsById={lotsById}
          containerRef={containerRef}
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          progress={progress}
          highlightedVariationId={deepLinkedVariationId}
          onSelect={(variation) => openModal('detail', variation)}
          onCopyLink={handleCopyVariationLink}
        />
      ) : !error ? (
        <VariationTable
          variations={displayedVariations}
          lotsById={lotsById}
          highlightedVariationId={deepLinkedVariationId}
          copiedVariationId={copiedVariationId}
          onSelect={(variation) => openModal('detail', variation)}
          onCopyLink={handleCopyVariationLink}
        />
      ) : null}

      <CreateVariationModal
        isOpen={activeModal === 'create' || activeModal === 'edit'}
        variation={activeModal === 'edit' ? selectedVariation : null}
        lots={lots}
        loading={actionLoading}
        onClose={closeModal}
        onSubmit={handleSubmitForm}
      />

      <VariationDetailSheet
        isOpen={activeModal === 'detail'}
        variation={selectedVariation}
        lotsById={lotsById}
        actionLoading={actionLoading}
        onClose={closeModal}
        onEdit={(variation) => openModal('edit', variation)}
        onSubmitVariation={handleSubmitVariation}
        onApprove={handleApproveVariation}
        onReject={handleRejectVariation}
        onDelete={handleDeleteVariation}
        onAddEvidence={handleAddEvidence}
        onRemoveEvidence={handleRemoveEvidence}
      />

      {projectId && (
        <ContextFAB
          actions={[
            {
              id: 'new-variation',
              label: 'New Variation',
              icon: <Plus className="h-5 w-5" />,
              color: 'bg-primary',
              onClick: () => openModal('create'),
            },
          ]}
          mainColor="bg-primary"
        />
      )}
    </div>
  );
}
