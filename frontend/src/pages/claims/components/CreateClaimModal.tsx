import React, { useRef, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { ConformedLot, NewClaimFormData } from '../types';
import {
  calculateLotClaimAmount,
  formatCurrency,
  getClaimPercentageError,
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
import { logError } from '@/lib/logger';

interface CreateClaimModalProps {
  projectId: string;
  onClose: () => void;
  onClaimCreated: () => void;
}

type ClaimableLot = Omit<ConformedLot, 'selected' | 'percentComplete'>;

export const CreateClaimModal = React.memo(function CreateClaimModal({
  projectId,
  onClose,
  onClaimCreated,
}: CreateClaimModalProps) {
  const [conformedLots, setConformedLots] = useState<ConformedLot[]>([]);
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
      periodStart: firstOfMonth.toISOString().split('T')[0],
      periodEnd: lastOfMonth.toISOString().split('T')[0],
      selectedLots: [],
    };
  });

  const fetchConformedLots = useCallback(async () => {
    setLoadingLots(true);
    setLoadError(null);
    try {
      const queryParams = new URLSearchParams({ status: 'conformed', unclaimed: 'true' });
      const data = await apiFetch<{ lots?: ClaimableLot[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/lots?${queryParams.toString()}`,
      );
      const lots =
        data.lots?.map((lot) => ({ ...lot, selected: false, percentComplete: '100' })) || [];
      setConformedLots(lots);
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

  const toggleLotSelection = useCallback((lotId: string) => {
    setConformedLots((lots) =>
      lots.map((lot) => (lot.id === lotId ? { ...lot, selected: !lot.selected } : lot)),
    );
  }, []);

  const updateLotPercentage = useCallback((lotId: string, percent: string) => {
    setConformedLots((lots) =>
      lots.map((lot) => (lot.id === lotId ? { ...lot, percentComplete: percent } : lot)),
    );
  }, []);

  const createClaim = async () => {
    if (creatingRef.current) return;

    const selectedLots = conformedLots.filter((l) => l.selected);
    if (selectedLots.length === 0) {
      setCreateError('Please select at least one lot to include in the claim.');
      return;
    }

    const claimLots = selectedLots.map((lot) => ({
      lotId: lot.id,
      percentageComplete: parseClaimPercentageInput(lot.percentComplete),
    }));
    if (claimLots.some((lot) => lot.percentageComplete === null)) {
      setCreateError('Percent complete must be a decimal between 0 and 100.');
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
        }),
      });
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
  const totalClaimAmount = selectedLots.reduce((sum, lot) => sum + calculateLotClaimAmount(lot), 0);
  const hasPartialProgress = selectedLots.some(
    (l) => (parseClaimPercentageInput(l.percentComplete) ?? 0) < 100,
  );
  const hasPercentageErrors = selectedLots.some((lot) =>
    Boolean(getClaimPercentageError(lot.percentComplete)),
  );

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
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Period Start</Label>
              <Input
                type="date"
                value={newClaim.periodStart}
                onChange={(e) => setNewClaim((prev) => ({ ...prev, periodStart: e.target.value }))}
              />
            </div>
            <div>
              <Label>Period End</Label>
              <Input
                type="date"
                value={newClaim.periodEnd}
                onChange={(e) => setNewClaim((prev) => ({ ...prev, periodEnd: e.target.value }))}
              />
            </div>
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
                <div className="p-4 text-center text-muted-foreground">
                  No conformed lots available for claiming
                </div>
              ) : (
                conformedLots.map((lot) => (
                  <div key={lot.id} className="p-3 hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={lot.selected}
                        onChange={() => toggleLotSelection(lot.id)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <div className="flex-1">
                        <span className="font-medium">{lot.lotNumber}</span>
                        <span className="text-muted-foreground ml-2">{lot.activity}</span>
                      </div>
                      <span className="text-muted-foreground text-sm">
                        {formatCurrency(lot.budgetAmount)}
                      </span>
                    </div>
                    {lot.selected && (
                      <div className="mt-2 ml-7 flex items-center gap-3">
                        <label className="text-sm text-muted-foreground">% Complete:</label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={lot.percentComplete}
                          onChange={(e) => updateLotPercentage(lot.id, e.target.value)}
                          className={`w-20 h-8 text-sm text-center ${
                            getClaimPercentageError(lot.percentComplete) ? 'border-red-500' : ''
                          }`}
                        />
                        <span className="text-sm">%</span>
                        <span className="ml-auto font-semibold text-primary">
                          {formatCurrency(calculateLotClaimAmount(lot))}
                        </span>
                        {getClaimPercentageError(lot.percentComplete) && (
                          <span className="text-sm text-red-600" role="alert" aria-live="assertive">
                            {getClaimPercentageError(lot.percentComplete)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Total */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Claim Amount</span>
              <span className="text-xl font-bold">{formatCurrency(totalClaimAmount)}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedLots.length} lots selected
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
          disabled={creating || selectedLots.length === 0 || hasPercentageErrors}
        >
          {creating ? 'Creating...' : 'Create Claim'}
        </Button>
      </ModalFooter>
    </Modal>
  );
});
