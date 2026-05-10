import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { toast } from '@/components/ui/toaster';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

interface SubcontractorCompany {
  id: string;
  companyName: string;
  status: string;
}

interface LotSubcontractorAssignment {
  id: string;
  subcontractorCompanyId: string;
  canCompleteITP: boolean;
  itpRequiresVerification: boolean;
  subcontractorCompany: {
    id: string;
    companyName: string;
  };
}

const assignSubcontractorSchema = z.object({
  selectedSubcontractor: z.string(),
  canCompleteITP: z.boolean(),
  itpRequiresVerification: z.boolean(),
});

type AssignSubcontractorFormData = z.infer<typeof assignSubcontractorSchema>;

interface AssignSubcontractorModalProps {
  lotId: string;
  lotNumber: string;
  projectId: string;
  existingAssignment?: LotSubcontractorAssignment | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AssignSubcontractorModal({
  lotId,
  lotNumber,
  projectId,
  existingAssignment,
  onClose,
  onSuccess,
}: AssignSubcontractorModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!existingAssignment;

  const { register, handleSubmit, reset, watch } = useForm<AssignSubcontractorFormData>({
    resolver: zodResolver(assignSubcontractorSchema),
    mode: 'onBlur',
    defaultValues: {
      selectedSubcontractor: existingAssignment?.subcontractorCompanyId || '',
      canCompleteITP: existingAssignment?.canCompleteITP || false,
      itpRequiresVerification: existingAssignment?.itpRequiresVerification ?? true,
    },
  });

  const selectedSubcontractor = watch('selectedSubcontractor');
  const canCompleteITP = watch('canCompleteITP');

  // Reset form when existingAssignment changes
  useEffect(() => {
    if (existingAssignment) {
      reset({
        selectedSubcontractor: existingAssignment.subcontractorCompanyId,
        canCompleteITP: existingAssignment.canCompleteITP,
        itpRequiresVerification: existingAssignment.itpRequiresVerification,
      });
    } else {
      reset({
        selectedSubcontractor: '',
        canCompleteITP: false,
        itpRequiresVerification: true,
      });
    }
  }, [existingAssignment, reset]);

  // Fetch subcontractors for this project
  const {
    data: subcontractors = [],
    isLoading: loadingSubcontractors,
    error: subError,
  } = useQuery({
    queryKey: ['subcontractors', projectId],
    queryFn: async () => {
      const response = await apiFetch<{ subcontractors: SubcontractorCompany[] }>(
        `/api/subcontractors/for-project/${projectId}`,
      );
      // Include approved, pending_approval, active - exclude rejected/suspended/removed
      return response.subcontractors.filter(
        (s) => s.status !== 'rejected' && s.status !== 'suspended' && s.status !== 'removed',
      );
    },
    enabled: !isEditing && !!projectId,
    retry: false,
  });

  // Fetch existing assignments to filter out already assigned subcontractors
  const {
    data: existingAssignments = [],
    isLoading: loadingAssignments,
    error: assignError,
  } = useQuery({
    queryKey: ['lot-assignments', lotId],
    queryFn: () => apiFetch<LotSubcontractorAssignment[]>(`/api/lots/${lotId}/subcontractors`),
    enabled: !isEditing,
    retry: false,
  });

  const availableSubcontractors = subcontractors.filter(
    (s) => !existingAssignments.some((a) => a.subcontractorCompanyId === s.id),
  );

  const assignMutation = useMutation({
    mutationFn: async (data: AssignSubcontractorFormData) => {
      if (isEditing && existingAssignment) {
        return apiFetch(`/api/lots/${lotId}/subcontractors/${existingAssignment.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            canCompleteITP: data.canCompleteITP,
            itpRequiresVerification: data.itpRequiresVerification,
          }),
        });
      }
      return apiFetch(`/api/lots/${lotId}/subcontractors`, {
        method: 'POST',
        body: JSON.stringify({
          subcontractorCompanyId: data.selectedSubcontractor,
          canCompleteITP: data.canCompleteITP,
          itpRequiresVerification: data.itpRequiresVerification,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] });
      queryClient.invalidateQueries({ queryKey: ['lots'] });
      queryClient.invalidateQueries({ queryKey: ['lot', lotId] });
      toast({
        title: isEditing ? 'Permissions updated' : 'Subcontractor assigned',
        description: isEditing
          ? 'ITP permissions have been updated.'
          : 'Subcontractor has been assigned to this lot.',
        variant: 'success',
      });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save assignment',
        variant: 'error',
      });
    },
  });

  const onFormSubmit = (data: AssignSubcontractorFormData) => {
    if (!isEditing && !data.selectedSubcontractor) {
      toast({
        title: 'Error',
        description: 'Please select a subcontractor',
        variant: 'error',
      });
      return;
    }
    assignMutation.mutate(data);
  };

  const isLoading = loadingSubcontractors || loadingAssignments;

  return (
    <Modal onClose={onClose} className="w-full max-w-md">
      <ModalHeader onClose={onClose}>
        {isEditing ? 'Edit Subcontractor Permissions' : 'Assign Subcontractor'} - {lotNumber}
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          {!isEditing && (
            <div className="space-y-2">
              <Label>Subcontractor Company</Label>
              {!projectId ? (
                <p className="text-sm text-red-500">
                  Error: Project ID is missing. Please reload the page.
                </p>
              ) : subError || assignError ? (
                <p className="text-sm text-red-500">
                  Error loading data:{' '}
                  {(subError as Error)?.message ||
                    (assignError as Error)?.message ||
                    'Authentication failed. Please refresh the page.'}
                </p>
              ) : isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading subcontractors...</span>
                </div>
              ) : (
                <>
                  <NativeSelect {...register('selectedSubcontractor')}>
                    <option value="">Select subcontractor...</option>
                    {availableSubcontractors.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.companyName}
                      </option>
                    ))}
                  </NativeSelect>
                  {availableSubcontractors.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {subcontractors.length === 0
                        ? 'No subcontractors found for this project. Invite subcontractors from the Subcontractors page first.'
                        : 'All subcontractors are already assigned to this lot.'}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {isEditing && (
            <div className="text-sm text-muted-foreground">
              Editing permissions for:{' '}
              <strong>{existingAssignment?.subcontractorCompany.companyName}</strong>
            </div>
          )}

          <div className="space-y-3">
            <Label>ITP Permissions</Label>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="canCompleteITP"
                {...register('canCompleteITP')}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
              />
              <div>
                <Label htmlFor="canCompleteITP" className="cursor-pointer">
                  Allow ITP completion
                </Label>
                <p className="text-sm text-muted-foreground">
                  Subcontractor can complete checklist items
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="itpRequiresVerification"
                {...register('itpRequiresVerification')}
                disabled={!canCompleteITP}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className={!canCompleteITP ? 'opacity-50' : ''}>
                <Label
                  htmlFor="itpRequiresVerification"
                  className={canCompleteITP ? 'cursor-pointer' : 'cursor-not-allowed'}
                >
                  Require verification (recommended)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Completions need head contractor approval
                </p>
              </div>
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit(onFormSubmit)}
          disabled={assignMutation.isPending || (!isEditing && !selectedSubcontractor)}
        >
          {assignMutation.isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : isEditing ? (
            'Save'
          ) : (
            'Assign'
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
