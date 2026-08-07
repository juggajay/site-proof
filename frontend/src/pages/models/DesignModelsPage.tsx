import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Loader2, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import {
  deleteDesignModelVersion,
  fetchDesignModels,
  isConversionPending,
  VERSION_STATUS_LABELS,
  type DesignModelLatestVersion,
  type DesignModelListItem,
} from '@/lib/models/designModelsApi';
import { useCurrentProjectRole } from '@/hooks/useCurrentProjectRole';
import { canManageProjectForRole } from '@/pages/projects/settings/projectPageAccess';
import { formatDocumentFileSize } from '@/pages/documents/documentsDisplayData';
import { UploadModelVersionDialog } from './UploadModelVersionDialog';

const CONVERSION_POLL_MS = 5000;

function VersionStatusChip({ version }: { version: DesignModelLatestVersion }) {
  if (version.status === 'ready') {
    return (
      <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
        Ready
      </span>
    );
  }
  if (version.status === 'failed') {
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        Conversion failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      {VERSION_STATUS_LABELS[version.status]}
    </span>
  );
}

function EmptyState({ canManage, onUpload }: { canManage: boolean; onUpload: () => void }) {
  return (
    <div className="rounded-lg border p-12 text-center">
      <Boxes className="mx-auto h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold">No design models yet</h3>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">
        Upload IFC design models and view them in 3D. Models are converted once, then open fast on
        any device.
      </p>
      {canManage ? (
        <Button type="button" onClick={onUpload} className="mt-4">
          <Upload className="mr-1.5 h-4 w-4" />
          Upload design model
        </Button>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          A project manager can upload models for this project.
        </p>
      )}
    </div>
  );
}

type DialogState =
  | { kind: 'closed' }
  | { kind: 'new-model' }
  | { kind: 'new-version'; model: DesignModelListItem };

export function DesignModelsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const role = useCurrentProjectRole(projectId);
  const canManage = canManageProjectForRole(role);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [pendingDelete, setPendingDelete] = useState<DesignModelListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const modelsQuery = useQuery({
    queryKey: queryKeys.designModels(projectId ?? 'none'),
    queryFn: () => fetchDesignModels(projectId!),
    enabled: Boolean(projectId),
    // Conversion has no push channel — poll while any latest version is in
    // flight (the worker ticks every 5 s server-side).
    refetchInterval: (models) =>
      models?.some(
        (model) => model.latestVersion && isConversionPending(model.latestVersion.status),
      )
        ? CONVERSION_POLL_MS
        : false,
  });

  if (!projectId) return null;

  const models = modelsQuery.data ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.designModels(projectId) });

  const handleDelete = async (model: DesignModelListItem) => {
    if (!model.latestVersion) return;
    setDeleting(true);
    try {
      await deleteDesignModelVersion(projectId, model.id, model.latestVersion.id);
      toast({
        title: `Deleted ${model.name} v${model.latestVersion.versionNumber}`,
        variant: 'success',
      });
      setPendingDelete(null);
      await invalidate();
    } catch (err) {
      logError('Failed to delete design model version:', err);
      toast({
        title: extractErrorMessage(err, 'Could not delete this version.'),
        variant: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Design models</h1>
          <p className="mt-1 text-muted-foreground">
            IFC design models, converted for 3D viewing in the browser.
          </p>
        </div>
        {canManage && models.length > 0 && (
          <Button type="button" onClick={() => setDialog({ kind: 'new-model' })}>
            <Upload className="mr-1.5 h-4 w-4" />
            Upload design model
          </Button>
        )}
      </div>

      {modelsQuery.isLoading && <PageSkeleton />}

      {modelsQuery.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {extractErrorMessage(modelsQuery.error, 'Could not load design models.')}
        </div>
      )}

      {modelsQuery.isSuccess && models.length === 0 && (
        <EmptyState canManage={canManage} onUpload={() => setDialog({ kind: 'new-model' })} />
      )}

      {models.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {models.map((model) => {
            const version = model.latestVersion;
            return (
              <li key={model.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{model.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    {version ? (
                      <>
                        <span>v{version.versionNumber}</span>
                        <VersionStatusChip version={version} />
                        {version.fragSizeBytes && (
                          <span>{formatDocumentFileSize(Number(version.fragSizeBytes))}</span>
                        )}
                      </>
                    ) : (
                      <span>No versions uploaded</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {version?.status === 'ready' && (
                    <Button type="button" size="sm" asChild>
                      <Link
                        to={`/projects/${projectId}/models/${model.id}/versions/${version.id}/view`}
                      >
                        View in 3D
                      </Link>
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDialog({ kind: 'new-version', model })}
                    >
                      New version
                    </Button>
                  )}
                  {canManage && version && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${model.name} v${version.versionNumber}`}
                      disabled={version.status === 'converting'}
                      onClick={() => setPendingDelete(model)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialog.kind !== 'closed' && (
        <UploadModelVersionDialog
          projectId={projectId}
          mode={
            dialog.kind === 'new-model'
              ? { kind: 'new-model' }
              : { kind: 'new-version', modelId: dialog.model.id, modelName: dialog.model.name }
          }
          onClose={() => setDialog({ kind: 'closed' })}
          onUploaded={(version) => {
            setDialog({ kind: 'closed' });
            toast({
              title: `Upload complete — v${version.versionNumber} is queued for conversion`,
              variant: 'success',
            });
            void invalidate();
          }}
        />
      )}

      {pendingDelete?.latestVersion && (
        <ConfirmDialog
          open
          title={`Delete ${pendingDelete.name} v${pendingDelete.latestVersion.versionNumber}?`}
          description="The uploaded IFC file and its converted 3D model are removed. Earlier versions are kept."
          confirmLabel={deleting ? 'Deleting…' : 'Delete version'}
          variant="destructive"
          confirmDisabled={deleting}
          cancelDisabled={deleting}
          onConfirm={() => void handleDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
