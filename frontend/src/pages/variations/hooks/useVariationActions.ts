import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { extractErrorMessage } from '@/lib/errorHandling';
import { formatDateKey } from '@/lib/localDate';
import { formatStatusLabel } from '@/lib/statusLabels';
import { toast } from '@/components/ui/toaster';
import { queryKeys } from '@/lib/queryKeys';
import type { Variation, VariationEvidencePayload, VariationFormData } from '../types';

function optionalTrimmed(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function nullableTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function createPayload(data: VariationFormData) {
  return {
    title: data.title.trim(),
    ...(optionalTrimmed(data.description)
      ? { description: optionalTrimmed(data.description) }
      : {}),
    ...(optionalTrimmed(data.clientReference)
      ? { clientReference: optionalTrimmed(data.clientReference) }
      : {}),
    ...(data.lotId ? { lotId: data.lotId } : {}),
    ...(data.approvedAmount != null ? { approvedAmount: data.approvedAmount } : {}),
  };
}

function updatePayload(data: VariationFormData) {
  return {
    title: data.title.trim(),
    description: nullableTrimmed(data.description),
    clientReference: nullableTrimmed(data.clientReference),
    lotId: data.lotId || null,
    approvedAmount: data.approvedAmount ?? null,
  };
}

interface UseVariationActionsOptions {
  projectId: string | undefined;
  fetchVariations: () => Promise<void>;
  setError: (error: string | null) => void;
  closeModal: () => void;
}

export function useVariationActions({
  projectId,
  fetchVariations,
  setError,
  closeModal,
}: UseVariationActionsOptions) {
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedVariationId, setCopiedVariationId] = useState<string | null>(null);
  const actionLoadingRef = useRef(false);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(null), 3000);
  };

  const invalidateVariations = useCallback(async () => {
    if (!projectId) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.variations(projectId) });
  }, [projectId, queryClient]);

  const runAction = useCallback(
    async (action: () => Promise<void>) => {
      if (!projectId || actionLoadingRef.current) return;
      actionLoadingRef.current = true;
      setActionLoading(true);
      setError(null);
      try {
        await action();
      } catch (err) {
        setError(extractErrorMessage(err, 'Variation action failed'));
      } finally {
        actionLoadingRef.current = false;
        setActionLoading(false);
      }
    },
    [projectId, setError],
  );

  const handleCreateVariation = useCallback(
    async (data: VariationFormData) => {
      await runAction(async () => {
        await apiFetch(`/api/projects/${encodeURIComponent(projectId!)}/variations`, {
          method: 'POST',
          body: JSON.stringify(createPayload(data)),
        });
        closeModal();
        showSuccess('Variation created');
        await fetchVariations();
      });
    },
    [closeModal, fetchVariations, projectId, runAction],
  );

  const handleUpdateVariation = useCallback(
    async (id: string, data: VariationFormData) => {
      await runAction(async () => {
        await apiFetch(
          `/api/projects/${encodeURIComponent(projectId!)}/variations/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            body: JSON.stringify(updatePayload(data)),
          },
        );
        closeModal();
        showSuccess('Variation updated');
        await fetchVariations();
      });
    },
    [closeModal, fetchVariations, projectId, runAction],
  );

  const handleSubmitVariation = useCallback(
    async (id: string) => {
      await runAction(async () => {
        await apiFetch(
          `/api/projects/${encodeURIComponent(projectId!)}/variations/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            body: JSON.stringify({ status: 'submitted' }),
          },
        );
        closeModal();
        showSuccess('Variation submitted');
        await fetchVariations();
      });
    },
    [closeModal, fetchVariations, projectId, runAction],
  );

  const handleApproveVariation = useCallback(
    async (id: string, approvedAmount: number) => {
      await runAction(async () => {
        await apiFetch(
          `/api/projects/${encodeURIComponent(projectId!)}/variations/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            body: JSON.stringify({ status: 'approved', approvedAmount }),
          },
        );
        closeModal();
        showSuccess('Variation approved');
        await fetchVariations();
      });
    },
    [closeModal, fetchVariations, projectId, runAction],
  );

  const handleRejectVariation = useCallback(
    async (id: string, rejectionReason: string) => {
      await runAction(async () => {
        await apiFetch(
          `/api/projects/${encodeURIComponent(projectId!)}/variations/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            body: JSON.stringify({ status: 'rejected', rejectionReason: rejectionReason.trim() }),
          },
        );
        closeModal();
        showSuccess('Variation rejected');
        await fetchVariations();
      });
    },
    [closeModal, fetchVariations, projectId, runAction],
  );

  const handleDeleteVariation = useCallback(
    async (id: string) => {
      await runAction(async () => {
        await apiFetch(
          `/api/projects/${encodeURIComponent(projectId!)}/variations/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        );
        closeModal();
        showSuccess('Variation deleted');
        await fetchVariations();
      });
    },
    [closeModal, fetchVariations, projectId, runAction],
  );

  const handleAddEvidence = useCallback(
    async (id: string, payload: VariationEvidencePayload) => {
      await apiFetch(
        `/api/projects/${encodeURIComponent(projectId!)}/variations/${encodeURIComponent(id)}/evidence`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );
      await invalidateVariations();
    },
    [invalidateVariations, projectId],
  );

  const handleRemoveEvidence = useCallback(
    async (id: string, evidenceId: string) => {
      await apiFetch(
        `/api/projects/${encodeURIComponent(projectId!)}/variations/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}`,
        { method: 'DELETE' },
      );
      await invalidateVariations();
    },
    [invalidateVariations, projectId],
  );

  const handleCopyVariationLink = useCallback(
    async (variationId: string, variationNumber: string) => {
      const url = `${window.location.origin}/projects/${encodeURIComponent(projectId || '')}/variations?variation=${encodeURIComponent(variationId)}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedVariationId(variationId);
      toast({
        title: 'Link copied',
        description: `Link to ${variationNumber} has been copied to your clipboard.`,
      });
      window.setTimeout(() => setCopiedVariationId(null), 2000);
    },
    [projectId],
  );

  const handleExportCSV = useCallback(
    (variations: Variation[]) => {
      downloadCsv(`variation-register-${projectId || 'all'}-${formatDateKey()}.csv`, [
        ['VAR #', 'Title', 'Client Ref', 'Amount', 'Status', 'Updated'],
        ...variations.map((variation) => [
          variation.variationNumber,
          variation.title,
          variation.clientReference ?? '',
          variation.approvedAmount ?? '',
          formatStatusLabel(variation.status),
          new Date(variation.updatedAt).toLocaleDateString('en-AU'),
        ]),
      ]);
    },
    [projectId],
  );

  return {
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
  };
}
