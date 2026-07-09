import { useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage, extractErrorDetails } from '@/lib/errorHandling';
import { downloadCsv } from '@/lib/csv';
import { formatDateKey } from '@/lib/localDate';
import { formatStatusLabel } from '@/lib/statusLabels';
import { queryKeys } from '@/lib/queryKeys';
import type { NCR } from '../types';

const optionalTrimmed = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

interface UseNCRActionsOptions {
  projectId: string | undefined;
  fetchNcrs: () => Promise<void>;
  setError: (error: string | null) => void;
  closeModal: () => void;
}

interface UseNCRActionsReturn {
  actionLoading: boolean;
  successMessage: string | null;
  copiedNcrId: string | null;
  handleCreateNcr: (formData: {
    description: string;
    category: string;
    severity: string;
    specificationReference?: string;
    lotIds?: string[];
    dueDate?: string;
    responsibleUserId?: string;
    responsibleSubcontractorId?: string;
  }) => Promise<void>;
  handleAssignNcr: (
    ncrId: string,
    assignment: {
      responsibleUserId?: string | null;
      responsibleSubcontractorId?: string | null;
    },
  ) => Promise<void>;
  handleRespond: (
    ncrId: string,
    responseData: {
      rootCauseCategory: string;
      rootCauseDescription: string;
      proposedCorrectiveAction: string;
    },
  ) => Promise<void>;
  handleRequestQmApproval: (ncrId: string) => Promise<void>;
  handleCloseNcr: (
    ncrId: string,
    closeData: { verificationNotes: string; lessonsLearned: string },
  ) => Promise<void>;
  handleCloseWithConcession: (
    ncrId: string,
    data: {
      concessionJustification: string;
      concessionRiskAssessment: string;
      clientApprovalReference?: string;
      verificationNotes?: string;
    },
  ) => Promise<void>;
  handleExportCSV: (filteredNcrs: NCR[]) => void;
  handleCopyNcrLink: (ncrId: string, ncrNumber: string) => Promise<void>;
}

export function useNCRActions({
  projectId,
  fetchNcrs,
  setError,
  closeModal,
}: UseNCRActionsOptions): UseNCRActionsReturn {
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedNcrId, setCopiedNcrId] = useState<string | null>(null);
  const actionLoadingRef = useRef(false);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const refreshCloseoutReaders = useCallback(async () => {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: ['lot'] }),
      queryClient.invalidateQueries({ queryKey: ['lot-readiness'] }),
    ];

    if (projectId) {
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: queryKeys.lots(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.claimReadiness(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.foremanBadges(projectId) }),
      );
    }

    await Promise.all(invalidations);
  }, [projectId, queryClient]);

  const handleCopyNcrLink = useCallback(
    async (ncrId: string, ncrNumber: string) => {
      const url = `${window.location.origin}/projects/${encodeURIComponent(projectId || '')}/ncr?ncr=${encodeURIComponent(ncrId)}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedNcrId(ncrId);
        toast({
          title: 'Link copied!',
          description: `Link to ${ncrNumber} has been copied to your clipboard.`,
        });
        setTimeout(() => setCopiedNcrId(null), 2000);
      } catch {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedNcrId(ncrId);
        toast({
          title: 'Link copied!',
          description: `Link to ${ncrNumber} has been copied to your clipboard.`,
        });
        setTimeout(() => setCopiedNcrId(null), 2000);
      }
    },
    [projectId],
  );

  const handleCreateNcr = useCallback(
    async (formData: {
      description: string;
      category: string;
      severity: string;
      specificationReference?: string;
      lotIds?: string[];
      dueDate?: string;
      responsibleUserId?: string;
      responsibleSubcontractorId?: string;
    }) => {
      if (!projectId || actionLoadingRef.current) return;
      actionLoadingRef.current = true;
      setActionLoading(true);
      try {
        await apiFetch('/api/ncrs', {
          method: 'POST',
          body: JSON.stringify({
            projectId,
            ...formData,
            description: formData.description.trim(),
            specificationReference: optionalTrimmed(formData.specificationReference),
            dueDate: optionalTrimmed(formData.dueDate),
          }),
        });
        closeModal();
        showSuccess('NCR created successfully');
        await fetchNcrs();
        await refreshCloseoutReaders();
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to create NCR'));
      } finally {
        actionLoadingRef.current = false;
        setActionLoading(false);
      }
    },
    [projectId, fetchNcrs, refreshCloseoutReaders, setError, closeModal],
  );

  const handleAssignNcr = useCallback(
    async (
      ncrId: string,
      assignment: {
        responsibleUserId?: string | null;
        responsibleSubcontractorId?: string | null;
      },
    ) => {
      if (actionLoadingRef.current) return;
      actionLoadingRef.current = true;
      setActionLoading(true);
      try {
        await apiFetch(`/api/ncrs/${encodeURIComponent(ncrId)}`, {
          method: 'PATCH',
          body: JSON.stringify(assignment),
        });
        closeModal();
        showSuccess('NCR assignment updated');
        await fetchNcrs();
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to update NCR assignment'));
      } finally {
        actionLoadingRef.current = false;
        setActionLoading(false);
      }
    },
    [fetchNcrs, setError, closeModal],
  );

  const handleRespond = useCallback(
    async (
      ncrId: string,
      responseData: {
        rootCauseCategory: string;
        rootCauseDescription: string;
        proposedCorrectiveAction: string;
      },
    ) => {
      if (actionLoadingRef.current) return;
      actionLoadingRef.current = true;
      setActionLoading(true);
      try {
        await apiFetch(`/api/ncrs/${encodeURIComponent(ncrId)}/respond`, {
          method: 'POST',
          body: JSON.stringify({
            rootCauseCategory: responseData.rootCauseCategory,
            rootCauseDescription: responseData.rootCauseDescription.trim(),
            proposedCorrectiveAction: responseData.proposedCorrectiveAction.trim(),
          }),
        });
        closeModal();
        showSuccess('NCR response submitted - status changed to Investigating');
        await fetchNcrs();
        await refreshCloseoutReaders();
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to submit response'));
      } finally {
        actionLoadingRef.current = false;
        setActionLoading(false);
      }
    },
    [fetchNcrs, refreshCloseoutReaders, setError, closeModal],
  );

  const handleRequestQmApproval = useCallback(
    async (ncrId: string) => {
      if (actionLoadingRef.current) return;
      actionLoadingRef.current = true;
      setActionLoading(true);
      try {
        const data = await apiFetch<{ message: string }>(
          `/api/ncrs/${encodeURIComponent(ncrId)}/qm-approve`,
          { method: 'POST' },
        );
        showSuccess(data.message || 'QM approval granted');
        await fetchNcrs();
        await refreshCloseoutReaders();
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to approve NCR'));
      } finally {
        actionLoadingRef.current = false;
        setActionLoading(false);
      }
    },
    [fetchNcrs, refreshCloseoutReaders, setError],
  );

  const handleCloseNcr = useCallback(
    async (ncrId: string, closeData: { verificationNotes: string; lessonsLearned: string }) => {
      if (actionLoadingRef.current) return;
      actionLoadingRef.current = true;
      setActionLoading(true);
      try {
        const responseData = await apiFetch<{ message: string }>(
          `/api/ncrs/${encodeURIComponent(ncrId)}/close`,
          {
            method: 'POST',
            body: JSON.stringify({
              verificationNotes: closeData.verificationNotes.trim(),
              lessonsLearned: closeData.lessonsLearned.trim(),
            }),
          },
        );
        closeModal();
        showSuccess(responseData.message || 'NCR closed successfully');
        await fetchNcrs();
        await refreshCloseoutReaders();
      } catch (err) {
        const details = extractErrorDetails(err);
        if (details?.requiresQmApproval) {
          setError(
            'Major NCRs require Quality Manager approval before closure. Please request QM approval first.',
          );
        } else {
          setError(extractErrorMessage(err, 'Failed to close NCR'));
        }
      } finally {
        actionLoadingRef.current = false;
        setActionLoading(false);
      }
    },
    [fetchNcrs, refreshCloseoutReaders, setError, closeModal],
  );

  const handleCloseWithConcession = useCallback(
    async (
      ncrId: string,
      data: {
        concessionJustification: string;
        concessionRiskAssessment: string;
        clientApprovalReference?: string;
        verificationNotes?: string;
      },
    ) => {
      if (actionLoadingRef.current) return;
      actionLoadingRef.current = true;
      setActionLoading(true);
      try {
        await apiFetch(`/api/ncrs/${encodeURIComponent(ncrId)}/close`, {
          method: 'POST',
          body: JSON.stringify({
            withConcession: true,
            concessionJustification: data.concessionJustification.trim(),
            concessionRiskAssessment: data.concessionRiskAssessment.trim(),
            clientApprovalReference: data.clientApprovalReference,
            verificationNotes: optionalTrimmed(data.verificationNotes),
          }),
        });
        closeModal();
        showSuccess('NCR closed with concession successfully');
        await fetchNcrs();
        await refreshCloseoutReaders();
      } catch (err) {
        const details = extractErrorDetails(err);
        if (details?.requiresQmApproval) {
          setError('Major NCRs require Quality Manager approval before closure with concession.');
        } else {
          setError(extractErrorMessage(err, 'Failed to close NCR with concession'));
        }
      } finally {
        actionLoadingRef.current = false;
        setActionLoading(false);
      }
    },
    [fetchNcrs, refreshCloseoutReaders, setError, closeModal],
  );

  const handleExportCSV = useCallback(
    (filteredNcrs: NCR[]) => {
      const headers = [
        'NCR Number',
        'Lots',
        'Description',
        'Category',
        'Severity',
        'Status',
        'Raised By',
        'Responsible',
        'Root Cause',
        'Due Date',
        'Created At',
        'Closed At',
      ];
      const rows = filteredNcrs.map((ncr) => [
        ncr.ncrNumber,
        ncr.ncrLots.map((nl) => nl.lot.lotNumber).join('; ') || '-',
        ncr.description,
        ncr.category,
        ncr.severity,
        formatStatusLabel(ncr.status),
        ncr.raisedBy ? ncr.raisedBy.fullName || ncr.raisedBy.email : '-',
        ncr.responsibleUser
          ? ncr.responsibleUser.fullName || ncr.responsibleUser.email
          : ncr.responsibleSubcontractor
            ? ncr.responsibleSubcontractor.companyName
            : 'Unassigned',
        ncr.rootCauseDescription || ncr.rootCauseCategory || '-',
        ncr.dueDate ? new Date(ncr.dueDate).toLocaleDateString('en-AU') : '-',
        new Date(ncr.createdAt).toLocaleDateString('en-AU'),
        ncr.closedAt ? new Date(ncr.closedAt).toLocaleDateString('en-AU') : '-',
      ]);
      downloadCsv(`ncr-register-${projectId || 'all'}-${formatDateKey()}.csv`, [headers, ...rows]);
    },
    [projectId],
  );

  return {
    actionLoading,
    successMessage,
    copiedNcrId,
    handleCreateNcr,
    handleAssignNcr,
    handleRespond,
    handleRequestQmApproval,
    handleCloseNcr,
    handleCloseWithConcession,
    handleExportCSV,
    handleCopyNcrLink,
  };
}
