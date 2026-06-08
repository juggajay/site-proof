import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { MobileITPChecklist } from '@/components/foreman/MobileITPChecklist';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage, handleApiError } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import type { ITPCompletion, ITPInstance } from '../lots/types';
import { getItpPhotoValidationError } from '../lots/lib/itpEvidence';
import { useItpCompletionActions } from '../lots/hooks/useItpCompletionActions';
import { uploadItpEvidencePhoto } from '../lots/hooks/useLotPhotoUpload';

interface Lot {
  id: string;
  projectId: string;
  lotNumber: string;
  description?: string;
  status: string;
  subcontractorAssignments?: {
    canCompleteITP: boolean;
    itpRequiresVerification: boolean;
  }[];
}

export function SubcontractorLotITPPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const [lot, setLot] = useState<Lot | null>(null);
  const [itpInstance, setItpInstance] = useState<ITPInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [canCompleteItems, setCanCompleteItems] = useState(false);

  const fetchData = useCallback(async () => {
    if (!lotId) return;

    try {
      // Fetch lot details
      const lotData = await apiFetch<{ lot: Lot }>(`/api/lots/${lotId}?portalModule=itps`);
      setLot(lotData.lot);

      // Check if subcontractor can complete items (check all assignments)
      const canComplete =
        lotData.lot.subcontractorAssignments?.some(
          (a: { canCompleteITP: boolean }) => a.canCompleteITP,
        ) ?? false;
      setCanCompleteItems(canComplete);

      // Fetch ITP instance for this lot
      try {
        const itpData = await apiFetch<{ instance: ITPInstance | null }>(
          `/api/itp/instances/lot/${lotId}?subcontractorView=true`,
        );
        setItpInstance(itpData.instance);
      } catch {
        // No ITP instance for this lot
      }
    } catch (err) {
      logError('Error fetching data:', err);
      setError(extractErrorMessage(err, 'Failed to load ITP data'));
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    if (lotId) {
      fetchData();
    }
  }, [lotId, fetchData]);

  const requireCompletionAccess = () => {
    if (canCompleteItems) return true;

    toast({
      title: 'View only',
      description: 'You do not have permission to complete ITP items for this lot.',
      variant: 'error',
    });
    return false;
  };

  // The four completion actions (toggle / N/A / Failed / notes) live in the
  // shared `useItpCompletionActions` hook so the portal and the lot-detail (HC)
  // path drive the same request + control logic. The page keeps owning the
  // trust boundary: `requireCompletionAccess` is injected as `requireAccess`, so
  // the hook can never act without the permission the page already enforced.
  //
  // Portal-specific wiring injected here (not branched-on-role inside the hook):
  //   - `onAfterMutate: fetchData`   -> full refetch (no optimistic merge)
  //   - `naDefaultNote: ''`          -> portal sends the trimmed reason as-is
  //   - `updateNotes`                -> PATCH an existing completion only
  // Toast copy keeps the portal's existing wording; the one approved change is
  // that a Failed mark now surfaces the raised NCR number when the API returns
  // it (parity with the HC path).
  const { handleToggleCompletion, handleMarkNotApplicable, handleMarkFailed, handleUpdateNotes } =
    useItpCompletionActions({
      itpInstance,
      requireAccess: requireCompletionAccess,
      setUpdatingItem,
      onAfterMutate: fetchData,
      naDefaultNote: '',
      updateNotes: async (checklistItemId: string, notes: string) => {
        if (!itpInstance) return;
        const completion = itpInstance.completions.find(
          (c) => c.checklistItemId === checklistItemId,
        );

        if (completion) {
          // Update existing completion
          await apiFetch(`/api/itp/completions/${completion.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ notes }),
          });
        }
      },
    });

  const handleAddPhoto = async (checklistItemId: string, file: File) => {
    if (!itpInstance || !lot) return;
    if (!requireCompletionAccess()) return;

    const validationError = getItpPhotoValidationError(file);
    if (validationError) {
      toast({
        title: validationError.includes('10MB') ? 'File too large' : 'Invalid file type',
        description: validationError,
        variant: 'error',
      });
      return;
    }

    setUpdatingItem(checklistItemId);

    try {
      let completion = itpInstance.completions.find((c) => c.checklistItemId === checklistItemId);

      if (!completion?.id) {
        const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
          method: 'POST',
          body: JSON.stringify({
            itpInstanceId: itpInstance.id,
            checklistItemId,
            status: 'pending',
            notes: '',
          }),
        });
        completion = data.completion;
      }

      // Reuse the shared upload-then-attach so the subbie and HC paths send the
      // same request shape. This intentionally adds GPS geotag + an
      // encodeURIComponent'd attachment URL to the subbie path (parity with HC);
      // it does NOT do AI classification or any offline write-through (those live
      // only in useLotPhotoUpload's handlers, never in this shared function).
      await uploadItpEvidencePhoto({
        projectId: lot.projectId,
        lotId: lot.id,
        completionId: completion.id,
        file,
      });

      await fetchData();
      toast({ title: 'Success', description: 'Photo uploaded', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to upload photo');
    } finally {
      setUpdatingItem(null);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !lot) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{error || 'Lot not found'}</p>
        </div>
        <Link
          to="/subcontractor-portal/itps"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ITPs
        </Link>
      </div>
    );
  }

  if (!itpInstance) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/subcontractor-portal/itps"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{lot.lotNumber}</h1>
            <p className="text-sm text-muted-foreground">ITP Checklist</p>
          </div>
        </div>
        <div className="border border-border rounded-lg bg-card p-8 text-center">
          <p className="text-muted-foreground">No ITP assigned to this lot</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/subcontractor-portal/itps"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{lot.lotNumber}</h1>
          <p className="text-sm text-muted-foreground">{itpInstance.template.name}</p>
        </div>
      </div>

      {/* ITP Checklist */}
      <MobileITPChecklist
        lotNumber={lot.lotNumber}
        templateName={itpInstance.template.name}
        checklistItems={itpInstance.template.checklistItems}
        completions={itpInstance.completions}
        onToggleCompletion={handleToggleCompletion}
        onMarkNotApplicable={handleMarkNotApplicable}
        onMarkFailed={handleMarkFailed}
        onUpdateNotes={handleUpdateNotes}
        onAddPhoto={handleAddPhoto}
        updatingItem={updatingItem}
        canCompleteItems={canCompleteItems}
      />
    </div>
  );
}
