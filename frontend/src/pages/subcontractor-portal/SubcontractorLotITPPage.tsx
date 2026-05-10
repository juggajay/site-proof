import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { MobileITPChecklist } from '@/components/foreman/MobileITPChecklist';
import { ApiError, apiFetch, authFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage, handleApiError } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';

interface ITPChecklistItem {
  id: string;
  description: string;
  category: string;
  responsibleParty: 'contractor' | 'subcontractor' | 'superintendent' | 'general';
  isHoldPoint: boolean;
  pointType: 'standard' | 'witness' | 'hold_point';
  evidenceRequired: 'none' | 'photo' | 'test' | 'document';
  order: number;
  testType?: string | null;
  acceptanceCriteria?: string | null;
}

interface ITPAttachment {
  id: string;
  documentId: string;
  document: {
    id: string;
    filename: string;
    fileUrl: string;
    caption: string | null;
  };
}

interface ITPCompletion {
  id: string;
  checklistItemId: string;
  isCompleted: boolean;
  isNotApplicable?: boolean;
  isFailed?: boolean;
  isVerified?: boolean;
  notes: string | null;
  completedAt: string | null;
  completedBy: { id: string; fullName: string; email: string } | null;
  attachments: ITPAttachment[];
}

interface ITPInstance {
  id: string;
  status: string;
  template: {
    id: string;
    name: string;
    activityType: string;
    checklistItems: ITPChecklistItem[];
  };
  completions: ITPCompletion[];
}

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

const MAX_ITP_PHOTO_SIZE = 10 * 1024 * 1024;
const ALLOWED_ITP_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const getItpPhotoValidationError = (file: File): string | null => {
  if (file.size > MAX_ITP_PHOTO_SIZE) {
    return `The file "${file.name}" exceeds the 10MB limit. Please select a smaller file.`;
  }

  if (!ALLOWED_ITP_PHOTO_TYPES.includes(file.type)) {
    return `The file "${file.name}" is not a supported image format. Please use JPEG, PNG, GIF, or WebP.`;
  }

  return null;
};

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
        const itpData = await apiFetch<{ instance: ITPInstance }>(
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

  const handleToggleCompletion = async (
    checklistItemId: string,
    isCompleted: boolean,
    notes: string | null,
  ) => {
    if (!itpInstance) return;
    if (!requireCompletionAccess()) return;
    setUpdatingItem(checklistItemId);

    try {
      await apiFetch(`/api/itp/completions`, {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isCompleted,
          notes,
        }),
      });

      await fetchData();
      toast({ title: 'Success', description: 'Item updated', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to update item');
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleMarkNotApplicable = async (checklistItemId: string, reason: string) => {
    if (!itpInstance) return;
    if (!requireCompletionAccess()) return;
    setUpdatingItem(checklistItemId);

    try {
      await apiFetch(`/api/itp/completions`, {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          status: 'not_applicable',
          notes: reason.trim(),
        }),
      });

      await fetchData();
      toast({ title: 'Success', description: 'Item marked as N/A', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to mark as N/A');
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleMarkFailed = async (checklistItemId: string, reason: string) => {
    if (!itpInstance) return;
    if (!requireCompletionAccess()) return;
    setUpdatingItem(checklistItemId);

    try {
      await apiFetch(`/api/itp/completions`, {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          status: 'failed',
          notes: `Failed: ${reason.trim() || 'Item failed inspection'}`,
          ncrDescription: reason.trim() || 'Item failed ITP inspection',
          ncrCategory: 'workmanship',
          ncrSeverity: 'minor',
        }),
      });

      await fetchData();
      toast({ title: 'Success', description: 'Item marked as failed', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to mark as failed');
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleUpdateNotes = async (checklistItemId: string, notes: string) => {
    if (!itpInstance) return;
    if (!requireCompletionAccess()) return;
    setUpdatingItem(checklistItemId);

    try {
      const completion = itpInstance.completions.find((c) => c.checklistItemId === checklistItemId);

      if (completion) {
        // Update existing completion
        await apiFetch(`/api/itp/completions/${completion.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ notes }),
        });
      }

      await fetchData();
    } catch (err) {
      handleApiError(err, 'Failed to update notes');
    } finally {
      setUpdatingItem(null);
    }
  };

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

      const caption = `ITP Evidence Photo - ${new Date().toLocaleString()}`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', lot.projectId);
      formData.append('lotId', lot.id);
      formData.append('documentType', 'photo');
      formData.append('category', 'itp_evidence');
      formData.append('caption', caption);

      const uploadResponse = await authFetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const body = await uploadResponse.text();
        throw new ApiError(uploadResponse.status, body);
      }

      const document = (await uploadResponse.json()) as { id: string };

      await apiFetch(`/api/itp/completions/${completion.id}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          documentId: document.id,
          caption,
        }),
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
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
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
