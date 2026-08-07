import { Suspense, lazy } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Monitor } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { queryKeys } from '@/lib/queryKeys';
import {
  fetchDesignModels,
  fetchDesignModelVersion,
  isConversionPending,
  isQuarantined,
  VERSION_STATUS_LABELS,
  type DesignModelVersion,
} from '@/lib/models/designModelsApi';
import {
  MOBILE_FRAG_BUDGET_BYTES,
  isOverMobileBudget,
  useIsMobileClassDevice,
} from '@/lib/models/mobileBudget';
import { formatDocumentFileSize } from '@/pages/documents/documentsDisplayData';

// The 3D stack (vendor-3d chunk) loads only when a view is actually allowed —
// never for blocked mobile visits or non-ready versions.
const ModelViewerCanvas = lazy(() =>
  import('./viewer/ModelViewerCanvas').then((m) => ({ default: m.ModelViewerCanvas })),
);

const CONVERSION_POLL_MS = 5000;

function CenteredPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}

export function ModelViewerPage() {
  const { projectId, modelId, versionId } = useParams<{
    projectId: string;
    modelId: string;
    versionId: string;
  }>();
  const isMobileClass = useIsMobileClassDevice();

  const versionQuery = useQuery({
    queryKey: queryKeys.designModelVersion(versionId ?? 'none'),
    queryFn: () => fetchDesignModelVersion(projectId!, modelId!, versionId!),
    enabled: Boolean(projectId && modelId && versionId),
    refetchInterval: (version) =>
      version && isConversionPending(version.status) ? CONVERSION_POLL_MS : false,
  });

  // Model display name comes from the (usually already cached) list — the API
  // has no single-model read. Fall back to the version's file name.
  const modelsQuery = useQuery({
    queryKey: queryKeys.designModels(projectId ?? 'none'),
    queryFn: () => fetchDesignModels(projectId!),
    enabled: Boolean(projectId),
  });

  if (!projectId || !modelId || !versionId) return null;

  const version = versionQuery.data;
  const modelName = modelsQuery.data?.find((model) => model.id === modelId)?.name;
  const title = modelName ?? version?.fileName ?? 'Design model';
  const backHref = `/projects/${projectId}/models`;
  const fragSizeBytes = version?.fragSizeBytes ? Number(version.fragSizeBytes) : null;
  const blockedOnMobile = isOverMobileBudget(fragSizeBytes, isMobileClass);

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[480px] flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to={backHref}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Design models
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">
            {title}
            {version && (
              <span className="ml-2 font-normal text-muted-foreground">
                v{version.versionNumber}
              </span>
            )}
          </h1>
        </div>
        {fragSizeBytes !== null && (
          <span className="ml-auto shrink-0 text-sm text-muted-foreground">
            {formatDocumentFileSize(fragSizeBytes)}
          </span>
        )}
      </div>

      <ViewerBody
        projectId={projectId}
        modelId={modelId}
        versionId={versionId}
        version={version}
        loading={versionQuery.isLoading}
        loadFailed={versionQuery.isError}
        blockedOnMobile={blockedOnMobile}
        backHref={backHref}
        fragSizeBytes={fragSizeBytes}
      />
    </div>
  );
}

function ViewerBody({
  projectId,
  modelId,
  versionId,
  version,
  loading,
  loadFailed,
  blockedOnMobile,
  backHref,
  fragSizeBytes,
}: {
  projectId: string;
  modelId: string;
  versionId: string;
  version: DesignModelVersion | undefined;
  loading: boolean;
  loadFailed: boolean;
  blockedOnMobile: boolean;
  backHref: string;
  fragSizeBytes: number | null;
}) {
  const backButton = (
    <Button type="button" variant="outline" className="mt-4" asChild>
      <Link to={backHref}>Back to design models</Link>
    </Button>
  );

  if (loading) return <PageSkeleton />;

  if (loadFailed || !version) {
    return (
      <CenteredPanel>
        <h2 className="text-base font-semibold">Model version not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This version may have been deleted, or you may not have access to it.
        </p>
        {backButton}
      </CenteredPanel>
    );
  }

  if (isConversionPending(version.status)) {
    return (
      <CenteredPanel>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold">{VERSION_STATUS_LABELS[version.status]}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The model is being converted for 3D viewing. This page updates automatically — most models
          are ready in under a minute.
        </p>
      </CenteredPanel>
    );
  }

  if (version.status === 'failed') {
    return (
      <CenteredPanel>
        <h2 className="text-base font-semibold">Conversion failed</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {version.lastFailureReason ?? 'The IFC file could not be converted.'}
        </p>
        {isQuarantined(version) && (
          <p className="mt-2 text-sm text-muted-foreground">
            This file failed twice and will not be retried. Check it opens in your authoring
            software, then upload a new version.
          </p>
        )}
        {backButton}
      </CenteredPanel>
    );
  }

  if (blockedOnMobile) {
    return (
      <CenteredPanel>
        <Monitor className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold">Too large for this device</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This model is {formatDocumentFileSize(fragSizeBytes)}. Phones and tablets run out of
          memory and crash on models over {Math.round(MOBILE_FRAG_BUDGET_BYTES / 1_000_000)} MB, so
          3D viewing for this model needs a desktop browser.
        </p>
        {backButton}
      </CenteredPanel>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ModelViewerCanvas projectId={projectId} modelId={modelId} versionId={versionId} />
      </Suspense>
    </div>
  );
}
