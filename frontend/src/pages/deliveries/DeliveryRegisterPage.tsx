/**
 * Wave C5-b — the project-wide delivery register.
 *
 * Why a register and not a lot tab: the delivery that matters most is the one
 * nobody linked to a lot, and that one is invisible from every lot page by
 * definition. This surface is the only place it can be found — and, with the
 * inline evidence editor, fixed.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCurrentProjectRole } from '@/hooks/useCurrentProjectRole';
import { apiFetch } from '@/lib/api';
import { buildCsv } from '@/lib/csv';
import { downloadBlob } from '@/lib/downloads';
import { openDocumentAccessUrl } from '@/lib/documentAccess';
import { queryKeys } from '@/lib/queryKeys';
import { hasRoleInGroup, ROLE_GROUPS } from '@/lib/roles';
import { formatStatusLabel } from '@/lib/statusLabels';

import { DeliveryEvidenceEditor, type EvidenceLotOption } from './DeliveryEvidenceEditor';
import {
  buildDeliveryCsvRows,
  DELIVERY_REGISTER_PAGE_SIZE,
  EMPTY_DELIVERY_FILTERS,
  formatDeliveryQuantity,
  hasActiveDeliveryFilters,
  isDeliveryDocketFiled,
  readFiltersFromParams,
  readOffsetFromParams,
  useDeliveryRegisterQuery,
  writeFiltersToParams,
  type DeliveryRegisterFilters,
  type DeliveryRegisterResponse,
  type DeliveryRow,
} from './deliveryRegisterData';

const COLUMN_COUNT = 8;

type FilterChange = (next: Partial<DeliveryRegisterFilters>) => void;

function formatDiaryDate(value: string | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function DocketCell({ delivery }: { delivery: DeliveryRow }) {
  if (isDeliveryDocketFiled(delivery) && delivery.docketDocument) {
    return (
      <button
        type="button"
        className="text-left text-sm text-primary underline-offset-2 hover:underline"
        onClick={() =>
          void openDocumentAccessUrl(delivery.docketDocument!.id, null, {
            disposition: 'inline',
          })
        }
      >
        {delivery.docketDocument.filename}
      </button>
    );
  }
  return <Badge variant="outline">{formatStatusLabel('delivery_docket_not_filed')}</Badge>;
}

/**
 * The two project-wide counts. Both are prompts, never blockers: an unfiled
 * docket and an unlinked delivery are things to go and do, not reasons to
 * refuse a conformance.
 */
function RegisterNotices({
  unlinkedCount,
  missingDocketCount,
  onFilter,
}: {
  unlinkedCount: number;
  missingDocketCount: number;
  onFilter: FilterChange;
}) {
  if (unlinkedCount <= 0 && missingDocketCount <= 0) return null;

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4" data-testid="delivery-readiness">
      {missingDocketCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            <b>{missingDocketCount}</b>{' '}
            {missingDocketCount === 1 ? 'delivery is' : 'deliveries are'} waiting on a docket. They
            are still recorded — filing the docket is what turns the record into evidence.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => onFilter({ docket: 'not_filed' })}
          >
            Show the {missingDocketCount}
          </Button>
        </div>
      ) : null}
      {unlinkedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            <b>{unlinkedCount}</b> {unlinkedCount === 1 ? 'delivery is' : 'deliveries are'} not
            linked to a lot. Linking them is what puts them on a lot&rsquo;s evidence folio.
          </span>
          <Badge variant="secondary" className="ml-auto">
            Support — never blocks a conform
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onFilter({ link: 'unlinked' })}
          >
            Show the {unlinkedCount}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RegisterFilterBar({
  filters,
  supplierDraft,
  disabled,
  refreshing,
  filtersActive,
  onSupplierDraft,
  onFilter,
  onClear,
}: {
  filters: DeliveryRegisterFilters;
  supplierDraft: string;
  disabled: boolean;
  refreshing: boolean;
  filtersActive: boolean;
  onSupplierDraft: (value: string) => void;
  onFilter: FilterChange;
  onClear: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Supplier</span>
          <Input
            className="w-56"
            placeholder="Search supplier"
            value={supplierDraft}
            disabled={disabled}
            onChange={(event) => onSupplierDraft(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Lot link</span>
          <NativeSelect
            className="w-44"
            value={filters.link}
            disabled={disabled}
            onChange={(event) =>
              onFilter({ link: event.target.value as DeliveryRegisterFilters['link'] })
            }
          >
            <option value="all">All deliveries</option>
            <option value="linked">Linked to a lot</option>
            <option value="unlinked">Not linked</option>
          </NativeSelect>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Docket</span>
          <NativeSelect
            className="w-48"
            value={filters.docket}
            disabled={disabled}
            onChange={(event) =>
              onFilter({ docket: event.target.value as DeliveryRegisterFilters['docket'] })
            }
          >
            <option value="all">All deliveries</option>
            <option value="filed">Docket filed</option>
            <option value="not_filed">Not filed in CIVOS</option>
          </NativeSelect>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">From</span>
          <Input
            type="date"
            className="w-40"
            value={filters.from}
            disabled={disabled}
            onChange={(event) => onFilter({ from: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">To</span>
          <Input
            type="date"
            className="w-40"
            value={filters.to}
            disabled={disabled}
            onChange={(event) => onFilter({ to: event.target.value })}
          />
        </label>
        {filtersActive ? (
          <Button type="button" variant="ghost" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
        {refreshing ? (
          <span className="text-sm text-muted-foreground" role="status">
            Refreshing…
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "Nothing here" and "nothing matched" are different answers and get different
 * copy — a filtered empty register that reads as an empty project is how a
 * missing docket stops being chased.
 */
function RegisterEmptyState({
  filtersActive,
  diaryPath,
  onClear,
}: {
  filtersActive: boolean;
  diaryPath: string;
  onClear: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-8 text-center">
      {filtersActive ? (
        <>
          <p className="font-medium">No deliveries match these filters</p>
          <Button type="button" variant="outline" className="mt-4" onClick={onClear}>
            Clear filters
          </Button>
        </>
      ) : (
        <>
          <p className="font-medium">No deliveries recorded yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Deliveries reach this register from the daily diary.
          </p>
          <Link to={diaryPath} className="mt-4 inline-block text-sm text-primary hover:underline">
            Go to the daily diary
          </Link>
        </>
      )}
    </div>
  );
}

function DeliveryTableRow({
  delivery,
  canEdit,
  isEditing,
  onToggleEdit,
}: {
  delivery: DeliveryRow;
  canEdit: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
}) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {formatDiaryDate(delivery.diary?.date)}
      </td>
      <td className="px-4 py-3 text-sm font-medium">{delivery.description || '-'}</td>
      <td className="px-4 py-3 text-sm">{delivery.supplier || '-'}</td>
      <td className="px-4 py-3 text-right text-sm">{formatDeliveryQuantity(delivery) || '-'}</td>
      <td className="px-4 py-3 text-sm">
        {delivery.lot ? (
          <Badge variant="secondary">{delivery.lot.lotNumber}</Badge>
        ) : (
          <Badge variant="outline">{formatStatusLabel('delivery_no_lot')}</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{delivery.batchRef || '-'}</td>
      <td className="px-4 py-3 text-sm">
        <DocketCell delivery={delivery} />
      </td>
      <td className="px-4 py-3 text-right">
        {canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={onToggleEdit}>
            {isEditing ? 'Editing' : 'Edit'}
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

export function DeliveryRegisterPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingId, setEditingId] = useState<string | null>(null);

  const filters = readFiltersFromParams(searchParams);
  const offset = readOffsetFromParams(searchParams);

  const projectRole = useCurrentProjectRole(projectId);
  const canEditEvidence = hasRoleInGroup(projectRole, ROLE_GROUPS.DELIVERY_EVIDENCE_EDITORS);

  const { data, isLoading, isFetching, isError, refetch } = useDeliveryRegisterQuery(
    projectId,
    filters,
    offset,
  );

  const { data: lotsData } = useQuery({
    queryKey: queryKeys.lots(projectId ?? 'none'),
    queryFn: () =>
      apiFetch<{ lots: EvidenceLotOption[] }>(
        `/api/lots?projectId=${encodeURIComponent(projectId ?? '')}`,
      ),
    enabled: Boolean(projectId) && canEditEvidence,
  });
  const lots = useMemo(() => lotsData?.lots ?? [], [lotsData]);

  // A failed refresh must not blank a register someone is working through, so
  // the last response that DID load is held and re-rendered under a banner
  // saying so. `keepPreviousData` only covers the in-flight case: react-query
  // drops to `data: undefined` once the query errors.
  const lastLoadedRef = useRef<DeliveryRegisterResponse | null>(null);
  if (data) {
    lastLoadedRef.current = data;
  }
  const shown = data ?? (isError ? lastLoadedRef.current : null);

  const deliveries = shown?.deliveries ?? [];
  const filtersActive = hasActiveDeliveryFilters(filters);
  const diaryPath = `/projects/${encodeURIComponent(projectId ?? '')}/diary`;

  const applyFilters: FilterChange = (next) => {
    setEditingId(null);
    // Offset always resets: page 3 of one filter set is not page 3 of another.
    // `replace` so typing a supplier name doesn't bury the back button.
    setSearchParams(writeFiltersToParams(searchParams, { ...filters, ...next }, 0), {
      replace: true,
    });
  };

  const goToOffset = (nextOffset: number) => {
    setEditingId(null);
    setSearchParams(writeFiltersToParams(searchParams, filters, Math.max(0, nextOffset)));
  };

  // The supplier box is the only free-text filter, so it is the only one that
  // would otherwise fire a request per keystroke.
  const [supplierDraft, setSupplierDraft] = useState(filters.supplier);
  useEffect(() => {
    if (supplierDraft === filters.supplier) return;
    const timeout = window.setTimeout(() => applyFilters({ supplier: supplierDraft }), 350);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierDraft, filters.supplier]);

  const clearFilters = () => {
    setSupplierDraft('');
    applyFilters(EMPTY_DELIVERY_FILTERS);
  };

  const handleExport = () => {
    const csv = buildCsv(buildDeliveryCsvRows(deliveries));
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      `delivery-register-page-${Math.floor(offset / DELIVERY_REGISTER_PAGE_SIZE) + 1}.csv`,
      'delivery-register.csv',
    );
  };

  const showSkeleton = isLoading && !shown;
  const showHardError = isError && !shown;
  const rangeStart = shown && shown.total > 0 ? offset + 1 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Delivery Register</h1>
          <p className="text-muted-foreground">
            Every delivery recorded in a daily diary, with the evidence attached to it
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={deliveries.length === 0}
          onClick={handleExport}
        >
          {/* Honest by name: the API pages, so this is the page, not the register. */}
          Export current page
        </Button>
      </div>

      {shown ? (
        <RegisterNotices
          unlinkedCount={shown.unlinkedCount}
          missingDocketCount={shown.missingDocketCount}
          onFilter={applyFilters}
        />
      ) : null}

      <RegisterFilterBar
        filters={filters}
        supplierDraft={supplierDraft}
        disabled={showSkeleton}
        refreshing={isFetching && !showSkeleton}
        filtersActive={filtersActive}
        onSupplierDraft={setSupplierDraft}
        onFilter={applyFilters}
        onClear={clearFilters}
      />

      {isError && shown ? (
        // Stale rows stay on screen: an old page of deliveries is more use than
        // an empty one, as long as it is labelled as old.
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
          role="alert"
        >
          <p className="text-sm font-medium text-destructive">
            Couldn&rsquo;t load deliveries. Showing the last results that loaded.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      {showHardError ? (
        <div className="rounded-lg border bg-card p-8 text-center" role="alert">
          <p className="font-medium">Couldn&rsquo;t load deliveries</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The register didn&rsquo;t load. Nothing has been changed.
          </p>
          <Button type="button" className="mt-4" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : showSkeleton ? (
        <div className="space-y-2 rounded-lg border bg-card p-4" data-testid="delivery-skeleton">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : deliveries.length === 0 ? (
        <RegisterEmptyState
          filtersActive={filtersActive}
          diaryPath={diaryPath}
          onClear={clearFilters}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Lot</th>
                  <th className="px-4 py-3">Batch / mix ref</th>
                  <th className="px-4 py-3">Docket</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {deliveries.map((delivery) => (
                  <Fragment key={delivery.id}>
                    <DeliveryTableRow
                      delivery={delivery}
                      canEdit={canEditEvidence}
                      isEditing={editingId === delivery.id}
                      onToggleEdit={() =>
                        setEditingId(editingId === delivery.id ? null : delivery.id)
                      }
                    />
                    {canEditEvidence && editingId === delivery.id ? (
                      <DeliveryEvidenceEditor
                        delivery={delivery}
                        projectId={projectId!}
                        lots={lots}
                        columnCount={COLUMN_COUNT}
                        onClose={() => setEditingId(null)}
                      />
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Showing <b className="text-foreground">{rangeStart}</b>&ndash;
              <b className="text-foreground">{offset + deliveries.length}</b> of{' '}
              <b className="text-foreground">{shown?.total ?? 0}</b>
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => goToOffset(offset - DELIVERY_REGISTER_PAGE_SIZE)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!shown?.hasMore}
                onClick={() => goToOffset(offset + DELIVERY_REGISTER_PAGE_SIZE)}
              >
                Next {DELIVERY_REGISTER_PAGE_SIZE}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
