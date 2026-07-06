import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import type { Lot, LotSubcontractorAssignment, SubcontractorCompany } from '../types';

interface UseLotSubcontractorAssignmentsParams {
  projectId: string | undefined;
  lotId: string | undefined;
  lot: Lot | null;
  isSubcontractor: boolean;
  canManageAssignments?: boolean;
  setLot: Dispatch<SetStateAction<Lot | null>>;
}

export function useLotSubcontractorAssignments({
  projectId,
  lotId,
  lot,
  isSubcontractor,
  canManageAssignments = false,
  setLot,
}: UseLotSubcontractorAssignmentsParams) {
  const queryClient = useQueryClient();
  const [showSubcontractorModal, setShowSubcontractorModal] = useState(false);
  const [subcontractors, setSubcontractors] = useState<SubcontractorCompany[]>([]);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<string>('');
  const [assigningSubcontractor, setAssigningSubcontractor] = useState(false);
  const [showAssignSubcontractorModal, setShowAssignSubcontractorModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<LotSubcontractorAssignment | null>(
    null,
  );

  useEffect(() => {
    if (showSubcontractorModal && projectId) {
      const fetchSubcontractors = async () => {
        try {
          const data = await apiFetch<{ subcontractors: SubcontractorCompany[] }>(
            `/api/subcontractors/for-project/${encodeURIComponent(projectId)}`,
          );
          setSubcontractors(data.subcontractors || []);
        } catch (err) {
          logError('Failed to fetch subcontractors:', err);
        }
      };
      fetchSubcontractors();
    }
  }, [showSubcontractorModal, projectId]);

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

  const handleAssignSubcontractor = async () => {
    if (!lot) return;

    setAssigningSubcontractor(true);

    try {
      const data = await apiFetch<{ message: string }>(
        `/api/lots/${encodeURIComponent(lot.id)}/assign`,
        {
          method: 'POST',
          body: JSON.stringify({
            subcontractorId: selectedSubcontractor || null,
          }),
        },
      );

      toast({
        title: selectedSubcontractor ? 'Subcontractor assigned' : 'Subcontractor unassigned',
        description: data.message,
      });

      // Refresh lot data.
      setShowSubcontractorModal(false);
      setSelectedSubcontractor('');
      try {
        const lotData = await apiFetch<{ lot: Lot }>(`/api/lots/${encodeURIComponent(lot.id)}`);
        setLot(lotData.lot);
      } catch {
        /* ignore */
      }
    } catch (err) {
      logError('Failed to assign subcontractor:', err);
      toast({
        title: 'Assignment failed',
        description: extractErrorMessage(err, 'An error occurred'),
        variant: 'error',
      });
    } finally {
      setAssigningSubcontractor(false);
    }
  };

  return {
    assignments,
    myAssignment,
    showSubcontractorModal,
    setShowSubcontractorModal,
    subcontractors,
    selectedSubcontractor,
    setSelectedSubcontractor,
    assigningSubcontractor,
    showAssignSubcontractorModal,
    setShowAssignSubcontractorModal,
    editingAssignment,
    setEditingAssignment,
    removeAssignmentPending: removeAssignmentMutation.isPending,
    removeAssignment: (assignmentId: string) => removeAssignmentMutation.mutate(assignmentId),
    handleAssignSubcontractor,
    handleAssignmentSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] });
    },
  };
}
