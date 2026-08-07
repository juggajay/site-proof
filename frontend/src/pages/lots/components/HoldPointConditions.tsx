import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';
import type { HoldPointDetails, HoldPointReleaseCondition } from '@/pages/holdpoints/types';

const CONDITION_SATISFACTION_ROLES = new Set([
  'quality_manager',
  'project_manager',
  'site_manager',
]);

type EvidenceDocument = {
  id: string;
  filename: string;
};

type SatisfactionResponse = {
  condition: HoldPointReleaseCondition;
  remainingOpenConditionCount: number;
  itpCompletionVerified: boolean;
};

interface HoldPointConditionsProps {
  projectId: string;
  lotId: string;
  itemId: string;
  holdPointId: string;
}

function formatSatisfiedDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-AU') : value;
}

export function HoldPointConditions({
  projectId,
  lotId,
  itemId,
  holdPointId,
}: HoldPointConditionsProps) {
  const { actualRole } = useAuth();
  const queryClient = useQueryClient();
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [evidenceDocumentId, setEvidenceDocumentId] = useState('');
  const canRecordSatisfaction = CONDITION_SATISFACTION_ROLES.has(actualRole ?? '');
  const detailQueryKey = queryKeys.holdPointDetail(lotId, itemId);

  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    queryFn: () =>
      apiFetch<HoldPointDetails>(
        `/api/holdpoints/lot/${encodeURIComponent(lotId)}/item/${encodeURIComponent(itemId)}`,
      ),
    enabled: Boolean(lotId && itemId),
    staleTime: 30_000,
    cacheTime: 5 * 60_000,
  });

  const documentsQuery = useQuery({
    queryKey: [...queryKeys.documents(projectId), 'hold-point-condition-picker'] as const,
    queryFn: () =>
      apiFetch<{ documents?: EvidenceDocument[] }>(
        `/api/documents/${encodeURIComponent(projectId)}?limit=100`,
      ),
    enabled: canRecordSatisfaction && Boolean(projectId),
    staleTime: 30_000,
    cacheTime: 5 * 60_000,
  });

  const satisfactionMutation = useMutation({
    mutationFn: async (conditionId: string) => {
      const body: { note?: string; evidenceDocumentId?: string } = {};
      if (note.trim()) body.note = note.trim();
      if (evidenceDocumentId) body.evidenceDocumentId = evidenceDocumentId;

      return apiFetch<SatisfactionResponse>(
        `/api/holdpoints/${encodeURIComponent(holdPointId)}/conditions/${encodeURIComponent(conditionId)}/record-satisfaction`,
        { method: 'POST', body: JSON.stringify(body) },
      );
    },
    onSuccess: async (response) => {
      queryClient.setQueryData<HoldPointDetails>(detailQueryKey, (current) => {
        const latestRound = current?.holdPoint.latestRound;
        if (!current || !latestRound?.conditions) return current;
        return {
          ...current,
          holdPoint: {
            ...current.holdPoint,
            latestRound: {
              ...latestRound,
              openConditionCount: response.remainingOpenConditionCount,
              conditions: latestRound.conditions.map((condition) =>
                condition.id === response.condition.id
                  ? { ...condition, ...response.condition }
                  : condition,
              ),
            },
          },
        };
      });
      setEditingConditionId(null);
      setNote('');
      setEvidenceDocumentId('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: detailQueryKey, refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: queryKeys.holdPoints(projectId) }),
      ]);
    },
  });

  if (detailQuery.isLoading) {
    return <p className="mt-2 text-xs text-muted-foreground">Loading release conditions…</p>;
  }

  if (detailQuery.error) {
    return (
      <p role="alert" className="mt-2 text-xs text-destructive">
        {extractErrorMessage(detailQuery.error, 'Could not load release conditions.')}
      </p>
    );
  }

  const conditions = detailQuery.data?.holdPoint.latestRound?.conditions ?? [];

  return (
    <ol className="mt-3 space-y-2">
      {conditions.map((condition) => {
        const satisfied = Boolean(condition.recordedSatisfiedAt);
        const editing = editingConditionId === condition.id;
        return (
          <li key={condition.id} className="rounded border border-warning/20 bg-background/60 p-2">
            <p className="text-xs font-medium">
              {condition.sequence}. {condition.text}
            </p>
            {satisfied && condition.recordedSatisfiedAt ? (
              <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                <p>
                  Recorded satisfied by {condition.recordedSatisfiedByName || 'Unknown user'} on{' '}
                  {formatSatisfiedDate(condition.recordedSatisfiedAt)}
                </p>
                {condition.satisfactionNote && <p>{condition.satisfactionNote}</p>}
              </div>
            ) : editing ? (
              <div className="mt-2 space-y-2">
                <div>
                  <Label htmlFor={`condition-note-${condition.id}`} className="text-xs">
                    Satisfaction note (optional)
                  </Label>
                  <textarea
                    id={`condition-note-${condition.id}`}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={5000}
                    rows={3}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor={`condition-evidence-${condition.id}`} className="text-xs">
                    Evidence document (optional)
                  </Label>
                  <NativeSelect
                    id={`condition-evidence-${condition.id}`}
                    value={evidenceDocumentId}
                    onChange={(event) => setEvidenceDocumentId(event.target.value)}
                    disabled={documentsQuery.isLoading}
                  >
                    <option value="">No evidence document</option>
                    {(documentsQuery.data?.documents ?? []).map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.filename}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                {Boolean(satisfactionMutation.error) && (
                  <p role="alert" className="text-xs text-destructive">
                    {extractErrorMessage(
                      satisfactionMutation.error,
                      'Failed to record condition satisfaction.',
                    )}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => satisfactionMutation.mutate(condition.id)}
                    disabled={satisfactionMutation.isLoading}
                  >
                    {satisfactionMutation.isLoading ? 'Recording…' : 'Record satisfaction'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingConditionId(null)}
                    disabled={satisfactionMutation.isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : canRecordSatisfaction ? (
              <button
                type="button"
                onClick={() => {
                  setEditingConditionId(condition.id);
                  setNote('');
                  setEvidenceDocumentId('');
                }}
                className="mt-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Record satisfaction
              </button>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Not yet recorded satisfied.</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
