/**
 * Wave C5-b — the remediation surface for one delivery, inline in the register
 * row that shows the problem.
 *
 * The register exists to find the delivery nobody filed a docket for. Making
 * the fix a trip to Documents (upload, remember the filename) and back (find
 * the row again, pick it out of a project-wide document list) is how the fix
 * doesn't happen. So the row uploads and attaches in place.
 *
 * Diary content stays locked: only `lotId`, `batchRef` and `docketDocumentId`
 * are editable here, which is exactly what
 * `PATCH /api/deliveries/:deliveryId/evidence` accepts.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/components/ui/toaster';
import { apiFetch, authFetch } from '@/lib/api';
import { openDocumentAccessUrl } from '@/lib/documentAccess';
import { extractErrorMessage } from '@/lib/errorHandling';
import { formatStatusLabel } from '@/lib/statusLabels';

import type { DeliveryRow } from './deliveryRegisterData';

export interface EvidenceLotOption {
  id: string;
  lotNumber: string;
}

interface DeliveryEvidenceEditorProps {
  delivery: DeliveryRow;
  projectId: string;
  lots: EvidenceLotOption[];
  columnCount: number;
  onClose: () => void;
}

interface AttachedDocket {
  id: string;
  filename: string;
}

/**
 * Uploads go through the backend with the service-role key and come back as a
 * Document row; the register never touches a storage URL. `delivery_docket` is
 * the documentType so a docket is findable as a docket later, not as an
 * untyped file that happened to be attached to a diary row.
 */
async function uploadDocketDocument(
  file: File,
  projectId: string,
  lotId: string | null,
): Promise<AttachedDocket> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectId', projectId);
  if (lotId) formData.append('lotId', lotId);
  formData.append('documentType', 'delivery_docket');
  formData.append('category', 'delivery_docket');

  const response = await authFetch('/api/documents/upload', { method: 'POST', body: formData });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Docket upload failed with status ${response.status}`);
  }

  const uploaded = (await response.json()) as { id?: string; filename?: string };
  if (!uploaded.id) {
    throw new Error('Docket upload did not return a document id');
  }
  return { id: uploaded.id, filename: uploaded.filename ?? file.name };
}

export function DeliveryEvidenceEditor({
  delivery,
  projectId,
  lots,
  columnCount,
  onClose,
}: DeliveryEvidenceEditorProps) {
  const queryClient = useQueryClient();
  const [lotId, setLotId] = useState(delivery.lotId ?? '');
  const [batchRef, setBatchRef] = useState(delivery.batchRef ?? '');
  const [docket, setDocket] = useState<AttachedDocket | null>(
    delivery.docketDocument
      ? { id: delivery.docketDocument.id, filename: delivery.docketDocument.filename }
      : null,
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/deliveries/${encodeURIComponent(delivery.id)}/evidence`, {
        method: 'PATCH',
        body: JSON.stringify({
          lotId: lotId || null,
          batchRef: batchRef.trim() || null,
          docketDocumentId: docket?.id ?? null,
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['delivery-register'] });
      toast({ title: 'Evidence saved', description: 'The delivery record has been updated.' });
      onClose();
    },
    onError: (err) => setError(extractErrorMessage(err, 'Could not save the evidence')),
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      setDocket(await uploadDocketDocument(file, projectId, lotId || null));
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not upload the docket'));
    } finally {
      setUploading(false);
    }
  };

  const busy = uploading || saveMutation.isLoading;

  return (
    <tr className="bg-muted/40">
      <td colSpan={columnCount} className="px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Attach evidence</span>
          {delivery.diary?.status ? (
            <span className="rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Diary {formatStatusLabel(delivery.diary.status).toLowerCase()}
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            Description, quantity and supplier are diary content and stay locked. Lot, batch ref and
            docket are evidence and can be attached after the diary closes.
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,200px)_minmax(0,200px)_minmax(0,1fr)_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Lot</span>
            <NativeSelect
              value={lotId}
              disabled={busy}
              onChange={(event) => setLotId(event.target.value)}
            >
              <option value="">Not linked to a lot</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber}
                </option>
              ))}
            </NativeSelect>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Batch / mix ref
            </span>
            <Input
              value={batchRef}
              disabled={busy}
              maxLength={120}
              onChange={(event) => setBatchRef(event.target.value)}
            />
          </label>

          <div className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Docket</span>
            <div className="flex flex-wrap items-center gap-2">
              {docket ? (
                <button
                  type="button"
                  className="text-sm text-primary underline-offset-2 hover:underline"
                  onClick={() => void openDocumentAccessUrl(docket.id)}
                >
                  {docket.filename}
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {formatStatusLabel('delivery_docket_not_filed')}
                </span>
              )}
              <label className="inline-flex">
                <span className="sr-only">Upload docket document</span>
                <input
                  type="file"
                  disabled={busy}
                  className="block w-56 text-xs file:mr-2 file:rounded-md file:border file:border-input file:bg-background file:px-2 file:py-1 file:text-xs"
                  onChange={(event) => {
                    void handleFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
              {uploading ? <span className="text-xs text-muted-foreground">Uploading…</span> : null}
              {docket ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setDocket(null)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => saveMutation.mutate()}>
              {saveMutation.isLoading ? 'Saving…' : 'Save evidence'}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
