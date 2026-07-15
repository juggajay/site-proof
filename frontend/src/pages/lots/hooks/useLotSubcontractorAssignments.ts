import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { LotSubcontractorAssignment } from '../types';

interface UseLotSubcontractorAssignmentsParams {
  lotId: string | undefined;
  isSubcontractor: boolean;
  canManageAssignments?: boolean;
}

export function useLotSubcontractorAssignments({
  lotId,
  isSubcontractor,
  canManageAssignments = false,
}: UseLotSubcontractorAssignmentsParams) {
  const queryClient = useQueryClient();
  const [showAssignSubcontractorModal, setShowAssignSubcontractorModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<LotSubcontractorAssignment | null>(
    null,
  );

  const { data: assignments = [] } = useQuery({
    queryKey: ['lot-assignments', lotId],
    queryFn: () =>
      apiFetch<LotSubcontractorAssignment[]>(
        `/api/lots/${encodeURIComponent(lotId || '')}/subcontractors`,
      ),
    enabled: !!lotId && canManageAssignments,
  });

  const { data: myAssignment } = useQuery({
    queryKey: ['my-lot-assignment', lotId],
    queryFn: () =>
      apiFetch<LotSubcontractorAssignment>(
        `/api/lots/${encodeURIComponent(lotId || '')}/subcontractors/mine`,
      ).catch(() => null),
    enabled: !!lotId && isSubcontractor,
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch(
        `/api/lots/${encodeURIComponent(lotId || '')}/subcontractors/${encodeURIComponent(assignmentId)}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] });
      toast({ title: 'Subcontractor removed from lot' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: extractErrorMessage(error, 'Failed to remove subcontractor'),
        variant: 'error',
      });
    },
  });

  return {
    assignments,
    myAssignment,
    showAssignSubcontractorModal,
    setShowAssignSubcontractorModal,
    editingAssignment,
    setEditingAssignment,
    removeAssignmentPending: removeAssignmentMutation.isPending,
    removeAssignment: (assignmentId: string) => removeAssignmentMutation.mutate(assignmentId),
    handleAssignmentSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] });
    },
  };
}
