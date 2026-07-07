import { useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import type { ITPInstance } from '../types';

interface UseItpTemplateAssignmentParams {
  lotId: string | undefined;
  setItpInstance: Dispatch<SetStateAction<ITPInstance | null>>;
  setItpLoadError: Dispatch<SetStateAction<string | null>>;
  refetchReadiness: () => void;
}

export function useItpTemplateAssignment({
  lotId,
  setItpInstance,
  setItpLoadError,
  refetchReadiness,
}: UseItpTemplateAssignmentParams) {
  const [assigningTemplate, setAssigningTemplate] = useState(false);

  const assignTemplate = async (templateId: string) => {
    if (!lotId || assigningTemplate) return false;

    setAssigningTemplate(true);
    setItpLoadError(null);

    try {
      const data = await apiFetch<{ instance: ITPInstance }>('/api/itp/instances', {
        method: 'POST',
        body: JSON.stringify({ lotId, templateId }),
      });
      setItpInstance(data.instance);
      void refetchReadiness();
      // Modal closing is handled by the ITPChecklistTab component.
      return true;
    } catch (err) {
      logError('Failed to assign template:', err);
      toast({
        title: 'Failed to assign ITP template',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
      return false;
    } finally {
      setAssigningTemplate(false);
    }
  };

  const unassignTemplate = async (instanceId: string) => {
    if (!instanceId || assigningTemplate) return false;

    setAssigningTemplate(true);
    setItpLoadError(null);

    try {
      await apiFetch(`/api/itp/instances/${encodeURIComponent(instanceId)}`, {
        method: 'DELETE',
      });
      setItpInstance(null);
      void refetchReadiness();
      void refetchConformStatus();
      return true;
    } catch (err) {
      logError('Failed to unassign template:', err);
      toast({
        title: 'Failed to unassign ITP template',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
      return false;
    } finally {
      setAssigningTemplate(false);
    }
  };

  return { assigningTemplate, assignTemplate, unassignTemplate };
}
