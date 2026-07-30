// Wave D `D1c.3` — the handover export screen (spec §4.7.6, §4.7.1, §9).
//
// ONE SCREEN, because the request and the preflight are ONE ROUND TRIP: the
// backend estimates and freezes in a single transaction and refuses before it
// writes anything (`routes/handoverExports/snapshot.ts:392`). There is no
// dry-run endpoint to build a separate "check first" step against, and faking
// one client-side would report numbers the server never agreed to.
//
// The archive COLLECTS, it never renders (`[DH-B2]`, §4.7.1). So the folio line
// below is a nudge with a link to where folios are issued, and it is never a
// blocker — a lot with no folio still exports its originals and the manifest
// records `folio: none`.

import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Package } from 'lucide-react';

import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { HandoverExportList } from './components/HandoverExportList';
import {
  HandoverPreflightAccepted,
  HandoverPreflightRefusal,
} from './components/HandoverPreflightPanel';
import { HandoverScopeSelector, type HandoverScopeKind } from './components/HandoverScopeSelector';
import {
  downloadHandoverExport,
  parseHandoverExportRefusal,
  useCancelHandoverExport,
  useCreateHandoverExport,
  useFolioCoverage,
  useHandoverExports,
  type CreateHandoverExportResponse,
  type HandoverExportRefusal,
  type HandoverExportRow,
  type HandoverExportScope,
} from './handoverExportData';

export function HandoverExportPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [scopeKind, setScopeKind] = useState<HandoverScopeKind>('project');
  const [scope, setScope] = useState<HandoverExportScope | null>({ kind: 'project' });
  const [accepted, setAccepted] = useState<CreateHandoverExportResponse | null>(null);
  const [refusal, setRefusal] = useState<HandoverExportRefusal | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const exportsQuery = useHandoverExports(projectId);
  const coverage = useFolioCoverage(projectId).data;
  const createExport = useCreateHandoverExport(projectId);
  const cancelExport = useCancelHandoverExport(projectId);

  // Stable: the selector reports its resolved scope from an effect.
  const handleScopeChange = useCallback((next: HandoverExportScope | null) => {
    setScope(next);
  }, []);

  const handleRequest = () => {
    if (!scope) return;
    setAccepted(null);
    setRefusal(null);

    createExport.mutate(scope, {
      onSuccess: (response) => setAccepted(response),
      onError: (error: unknown) => {
        // A cap or member-limit refusal is a SCOPE ANSWER, not a failure — it
        // renders on the screen with the narrower scope the server named. Only
        // everything else becomes an error toast.
        const scopeRefusal = parseHandoverExportRefusal(error);
        if (scopeRefusal) {
          setRefusal(scopeRefusal);
          return;
        }
        logError('Error requesting handover export:', error);
        toast({
          title: 'Could not request the export',
          description: extractErrorMessage(error, 'Please try again.'),
          variant: 'error',
        });
      },
    });
  };

  const handleDownload = async (row: HandoverExportRow) => {
    setDownloadingId(row.id);
    try {
      await downloadHandoverExport(row.id);
    } catch (error) {
      logError('Error downloading handover export:', error);
      toast({
        title: 'Download failed',
        description: extractErrorMessage(error, 'Could not download this archive.'),
        variant: 'error',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCancel = (row: HandoverExportRow) => {
    cancelExport.mutate(row.id, {
      onError: (error: unknown) => {
        logError('Error cancelling handover export:', error);
        toast({
          title: 'Could not cancel',
          description: extractErrorMessage(error, 'The job may have already finished.'),
          variant: 'error',
        });
      },
    });
  };

  if (!projectId) return null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-3xl font-bold">Handover export</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          A ZIP of the evidence held against the lots you choose — issued folios, lot documents, ITP
          attachments, NCR evidence and hold-point records — with a manifest listing every file. It
          compiles what exists; it does not create or certify anything.
        </p>
      </div>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <HandoverScopeSelector
          projectId={projectId}
          kind={scopeKind}
          onKindChange={setScopeKind}
          onScopeChange={handleScopeChange}
          disabled={createExport.isLoading}
        />

        {/* §4.7.1 — a nudge, never a gate. The count is an extra sentence in
            front of it, so a loading or failed coverage read simply leaves the
            copy as it was rather than blanking the nudge. */}
        <p className="text-xs text-muted-foreground">
          {coverage && coverage.lotCount > 0 && (
            <>
              {coverage.lotsWithIssuedFolio} of {coverage.lotCount}{' '}
              {coverage.lotCount === 1 ? 'lot has' : 'lots have'} an issued folio.{' '}
            </>
          )}
          Lots with no issued folio still export: their original records are collected and the
          manifest records the folio as none.{' '}
          <Link
            to={`/projects/${encodeURIComponent(projectId)}/lots`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Issue folios from the lot list
          </Link>{' '}
          first if you want them included.
        </p>

        <button
          type="button"
          onClick={handleRequest}
          disabled={!scope || createExport.isLoading}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createExport.isLoading ? 'Checking…' : 'Check size and request archive'}
        </button>
      </section>

      {accepted && (
        <HandoverPreflightAccepted preflight={accepted.preflight} lotCount={accepted.lotCount} />
      )}
      {refusal && (
        <HandoverPreflightRefusal refusal={refusal} onNarrowToArea={() => setScopeKind('area')} />
      )}

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground">Exports</h2>
        <HandoverExportList
          rows={exportsQuery.data?.exports ?? []}
          isLoading={exportsQuery.isLoading}
          downloadingId={downloadingId}
          cancellingId={cancelExport.isLoading ? (cancelExport.variables ?? null) : null}
          onDownload={(row) => void handleDownload(row)}
          onCancel={handleCancel}
        />
      </section>
    </div>
  );
}
