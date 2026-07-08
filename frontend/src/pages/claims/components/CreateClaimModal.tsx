import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { ConformedLot, NewClaimFormData } from '../types';
import type {
  ClaimReadinessLot,
  EvidenceReadinessItem,
  ProjectClaimReadiness,
} from '@/types/evidenceReadiness';
import {
  calculateLotClaimAmount,
  formatCurrency,
  getClaimIncrementError,
  getClaimPeriodError,
  parseClaimPercentageInput,
} from '../utils';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { queryKeys } from '@/lib/queryKeys';
import { logError } from '@/lib/logger';
import { formatDateKey } from '@/lib/localDate';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface CreateClaimModalProps {
  projectId: string;
  onClose: () => void;
  onClaimCreated: () => void;
}

type ClaimableLot = ConformedLot & {
  actionBlocked: boolean;
  readinessItems: EvidenceReadinessItem[];
};

interface ClaimableVariation {
  id: string;
  variationNumber: string;
  title: string;
  status: string;
  approvedAmount: number | null;
  clientReference?: string | null;
}

interface VariationsResponse {
  variations?: ClaimableVariation[];
}

function readinessItems(lot: ClaimReadinessLot): EvidenceReadinessItem[] {
  return [...lot.claim.blockers, ...lot.claim.warnings, ...lot.claim.support];
}

function mapReadinessLot(lot: ClaimReadinessLot): ClaimableLot {
  const items = readinessItems(lot);
  const claimedPercentage = lot.claim.claimedPercentage ?? 0;
  const remainingPercentage = lot.claim.remainingPercentage ?? 100 - claimedPercentage;

  return {
    id: lot.lotId,
    lotNumber: lot.lotNumber,
    activity: lot.activityType ?? 'Unknown',
    budgetAmount: lot.claim.budgetAmount ?? null,
    selected: false,
    // Default to whatever is left to claim on this lot, not always 100%.
    percentComplete: String(Number(remainingPercentage.toFixed(2))),
    claimedPercentage,
    remainingPercentage,
    actionBlocked: lot.claim.blockers.some((item) => item.blocksAction),
    readinessItems: items,
  };
}

function getSelectedLotClaimIncrementError(
  value: string,
  remainingPercentage: number,
): string | null {
  const incrementError = getClaimIncrementError(value, remainingPercentage);
  if (incrementError) return incrementError;

  const parsed = parseClaimPercentageInput(value);
  return parsed !== null && parsed <= 0 ? 'Claim percentage must be greater than 0.' : null;
}

export const CreateClaimModal = React.memo(function CreateClaimModal({
  projectId,
  onClose,
  onClaimCreated,
}: CreateClaimModalProps) {
  const queryClient = useQueryClient();
  const [conformedLots, setConformedLots] = useState<ClaimableLot[]>([]);
  const [selectedVariationIds, setSelectedVariationIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const creatingRef = useRef(false);
  const [newClaim, setNewClaim] = useState<NewClaimFormData>(() => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
      periodStart: formatDateKey(firstOfMonth),
      periodEnd: formatDateKey(lastOfMonth),
      selectedLots: [],
    };
  });

  const fetchConformedLots = useCallback(async () => {
    setLoadingLots(true);
    setLoadError(null);
    try {
      const data = await apiFetch<ProjectClaimReadiness>(
        `/api/projects/${encodeURIComponent(projectId)}/claim-readiness`,
      );
      setConformedLots(data.lots.map(mapReadinessLot));
    } catch (error) {
      logError('Error fetching conformed lots:', error);
      setConformedLots([]);
      setLoadError(extractErrorMessage(error, 'Could not load claimable lots. Please try again.'));
    } finally {
      setLoadingLots(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchConformedLots();
  }, [fetchConformedLots]);

  const variationsQuery = useQuery({
    queryKey: queryKeys.variations(projectId),
    queryFn: () =>
      apiFetch<VariationsResponse>(`/api/projects/${encodeURIComponent(projectId)}/variations`),
    staleTime: 30_000,
    onError: (error) => logError('Error fetching approved variations:', error),
  });

  const approvedVariations = useMemo(
    () =>
      (variationsQuery.data?.variations ?? []).filter(
        (variation) =>
          variation.status === 'approved' &&
          variation.approvedAmount !== null &&
          variation.approvedAmount > 0,
      ),
    [variationsQuery.data?.variations],
  );

  useEffect(() => {
    setSelectedVariationIds((ids) =>
      ids.filter((id) => approvedVariations.some((variation) => variation.id === id)),
    );
  }, [approvedVariations]);

  const toggleLotSelection = useCallback((lotId: string) => {
    setConformedLots((lots) =>
      lots.map((lot) =>
        lot.id === lotId && !lot.actionBlocked ? { ...lot, selected: !lot.selected } : lot,
      ),
    );
  }, []);

  const updateLotPercentage = useCallback((lotId: string, percent: string) => {
    setConformedLots((lots) =>
      lots.map((lot) => (lot.id === lotId ? { ...lot, percentComplete: percent } : lot)),
    );
  }, []);

  const toggleVariationSelection = useCallback((variationId: string) => {
    setSelectedVariationIds((ids) =>
      ids.includes(variationId) ? ids.filter((id) => id !== variationId) : [...ids, variationId],
    );
  }, []);

  const createClaim = async () => {
    if (creatingRef.current) return;

    const periodError = getClaimPeriodError(newClaim.periodStart, newClaim.periodEnd);
    if (periodError) {
      setCreateError(periodError);
      return;
    }

    const selectedLots = conformedLots.filter((l) => l.selected);
    const selectedVariations = approvedVariations.filter((variation) =>
      selectedVariationIds.includes(variation.id),
    );
    if (selectedLots.length === 0 && selectedVariations.length === 0) {
      setCreateError(
        'Please select at least one lot or approved variation to include in the claim.',
      );
      return;
    }

    const claimLots = selectedLots.map((lot) => ({
      lotId: lot.id,
      percentageComplete: parseClaimPercentageInput(lot.percentComplete),
    }));
    if (selectedLots.some((lot) => !lot.percentComplete.trim())) {
      setCreateError('Percent complete is required for every selected lot.');
      return;
    }
    if (claimLots.some((lot) => lot.percentageComplete === null)) {
      setCreateError('Percent complete must be a decimal between 0 and 100.');
      return;
    }
    if (
      selectedLots.some((lot) =>
        Boolean(getSelectedLotClaimIncrementError(lot.percentComplete, lot.remainingPercentage)),
      )
    ) {
      setCreateError(
        'Each selected lot must claim more than 0% and no more than the remaining percentage.',
      );
      return;
    }

    creatingRef.current = true;
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/claims`, {
        method: 'POST',
        body: JSON.stringify({
          periodStart: newClaim.periodStart,
          periodEnd: newClaim.periodEnd,
          lots: claimLots.map((lot) => ({
            lotId: lot.lotId,
            percentageComplete: lot.percentageComplete,
          })),
          variationIds: selectedVariations.map((variation) => variation.id),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.variations(projectId) });
      onClaimCreated();
      onClose();
    } catch (error) {
      logError('Error creating claim:', error);
      setCreateError(
        extractErrorMessage(
          error,
          'Failed to create claim. Please check the selected lots and try again.',
        ),
      );
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const selectedLots = conformedLots.filter((l) => l.selected);
  const selectedVariations = approvedVariations.filter((variation) =>
    selectedVariationIds.includes(variation.id),
  );
  const totalClaimAmount =
    selectedLots.reduce((sum, lot) => sum + calculateLotClaimAmount(lot), 0) +
    selectedVariations.reduce((sum, variation) => sum + (variation.approvedAmount ?? 0), 0);
  const hasPartialProgress = selectedLots.some(
    (l) => (parseClaimPercentageInput(l.percentComplete) ?? 0) < 100,
  );
  const hasPercentageErrors = selectedLots.some((lot) =>
    Boolean(getSelectedLotClaimIncrementError(lot.percentComplete, lot.remainingPercentage)),
  );
  const periodError = getClaimPeriodError(newClaim.periodStart, newClaim.periodEnd);

  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <ModalHeader>Create New Progress Claim</ModalHeader>
      <ModalDescription>
        Select conformed lots and define the claim period for this progress claim.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-6">
          {(loadError || createError) && (
            <div
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium">{loadError || createError}</p>
                {loadError && (
                  <Button type="button" variant="outline" onClick={() => void fetchConformedLots()}>
                    Try again
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Period Selection */}
          <div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="claim-period-start">Period Start</Label>
                <Input
                  id="claim-period-start"
                  type="date"
                  value={newClaim.periodStart}
                  aria-invalid={Boolean(periodError)}
                  onChange={(e) =>
                    setNewClaim((prev) => ({ ...prev, periodStart: e.target.value }))
                  }
                  className={periodError ? 'border-destructive' : ''}
                />
              </div>
              <div>
                <Label htmlFor="claim-period-end">Period End</Label>
                <Input
                  id="claim-period-end"
                  type="date"
                  value={newClaim.periodEnd}
                  aria-invalid={Boolean(periodError)}
                  onChange={(e) => setNewClaim((prev) => ({ ...prev, periodEnd: e.target.value }))}
                  className={periodError ? 'border-destructive' : ''}
                />
              </div>
            </div>
            {periodError && (
              <p className="mt-1.5 text-sm text-destructive" role="alert">
                {periodError}
              </p>
            )}
          </div>

          {/* Lot Selection */}
          <div>
            <Label>Select Conformed Lots to Include</Label>
            <div className="border rounded-lg divide-y max-h-80 overflow-auto mt-1">
              {loadingLots ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading claimable lots...
                </div>
              ) : loadError ? null : conformedLots.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-medium">No conformed lots to claim yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Claims are built from conformed lots — lots whose quality checks are complete
                    and signed off. Conform a lot first, then come back here to claim it.
                  </p>
                  <Link
                    to={`/projects/${projectId}/lots`}
                    className="touch-target mt-3 inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                  >
                    Go to Lots
                  </Link>
                </div>
              ) : (
                conformedLots.map((lot) => {
                  const actionBlockers = lot.readinessItems.filter((item) => item.blocksAction);
                  const evidenceIssues = lot.readinessItems.filter(
                    (item) => !item.blocksAction && item.severity !== 'support',
                  );
                  const supportItems = lot.readinessItems.filter(
                    (item) => item.severity === 'support',
                  );
                  const percentageInputId = `claim-percent-${lot.id}`;
                  const percentageError = getSelectedLotClaimIncrementError(
                    lot.percentComplete,
                    lot.remainingPercentage,
                  );

                  return (
                    <div key={lot.id} className="p-3 hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${lot.lotNumber}`}
                          checked={lot.selected}
                          onChange={() => toggleLotSelection(lot.id)}
                          disabled={lot.actionBlocked}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <div className="flex-1">
                          <span className="font-medium">{lot.lotNumber}</span>
                          <span className="text-muted-foreground ml-2">{lot.activity}</span>
                        </div>
                        <span className="text-muted-foreground text-sm">
                          {formatCurrency(lot.budgetAmount)}
                        </span>
                      </div>
                      {lot.claimedPercentage > 0 && (
                        <p className="mt-1 ml-7 text-xs text-muted-foreground">
                          Previously claimed {Number(lot.claimedPercentage.toFixed(2))}% -{' '}
                          {Number(lot.remainingPercentage.toFixed(2))}% still available
                        </p>
                      )}
                      {(actionBlockers.length > 0 || evidenceIssues.length > 0) && (
                        <div className="mt-2 ml-7 space-y-1">
                          {[...actionBlockers, ...evidenceIssues].slice(0, 3).map((item) => (
                            <p
                              key={`${lot.id}-${item.code}`}
                              className={`flex items-start gap-1.5 text-xs ${
                                item.blocksAction ? 'text-destructive' : 'text-warning'
                              }`}
                            >
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                              <span>
                                <span className="font-medium">{item.title}</span>
                                <span> - {item.detail}</span>
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                      {supportItems.length > 0 &&
                        actionBlockers.length === 0 &&
                        evidenceIssues.length === 0 && (
                          <p className="mt-2 ml-7 flex items-start gap-1.5 text-xs text-success">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span>{supportItems[0].title}</span>
                          </p>
                        )}
                      {lot.selected && (
                        <div className="mt-2 ml-7 flex flex-wrap items-center gap-3">
                          <label
                            htmlFor={percentageInputId}
                            className="text-sm text-muted-foreground"
                          >
                            % to claim this time:
                            <span className="sr-only"> for {lot.lotNumber}</span>
                          </label>
                          <Input
                            id={percentageInputId}
                            type="number"
                            min={0.01}
                            max={lot.remainingPercentage}
                            step="0.01"
                            required
                            aria-invalid={Boolean(percentageError)}
                            aria-describedby={
                              percentageError ? `${percentageInputId}-error` : undefined
                            }
                            value={lot.percentComplete}
                            onChange={(e) => updateLotPercentage(lot.id, e.target.value)}
                            className={`w-20 h-8 text-sm text-center ${
                              percentageError ? 'border-destructive' : ''
                            }`}
                          />
                          <span className="text-sm">%</span>
                          <span className="ml-auto font-semibold text-primary">
                            {formatCurrency(calculateLotClaimAmount(lot))}
                          </span>
                          {percentageError && (
                            <span
                              id={`${percentageInputId}-error`}
                              className="text-sm text-destructive"
                              role="alert"
                              aria-live="assertive"
                            >
                              {percentageError}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {approvedVariations.length > 0 && (
            <div>
              <Label>Approved variations</Label>
              <div className="mt-1 max-h-56 divide-y overflow-auto rounded-lg border">
                {approvedVariations.map((variation) => (
                  <div key={variation.id} className="p-3 hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Select variation ${variation.variationNumber}`}
                        checked={selectedVariationIds.includes(variation.id)}
                        onChange={() => toggleVariationSelection(variation.id)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="font-medium">{variation.variationNumber}</span>
                          <span className="truncate text-sm text-muted-foreground">
                            {variation.title}
                          </span>
                        </div>
                        {variation.clientReference && (
                          <p className="text-xs text-muted-foreground">
                            Client ref {variation.clientReference}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold">
                        {formatCurrency(variation.approvedAmount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Claim Amount</span>
              <span className="text-xl font-bold">{formatCurrency(totalClaimAmount)}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedLots.length} lots selected
              {selectedVariations.length > 0 && (
                <span className="ml-1">+ {selectedVariations.length} variations</span>
              )}
              {hasPartialProgress && <span className="ml-1">(includes partial progress)</span>}
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={createClaim}
          disabled={
            creating ||
            (selectedLots.length === 0 && selectedVariations.length === 0) ||
            hasPercentageErrors ||
            Boolean(periodError)
          }
        >
          {creating ? 'Creating...' : 'Create Claim'}
        </Button>
      </ModalFooter>
    </Modal>
  );
});
