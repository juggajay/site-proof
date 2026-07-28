// Wave D `D1b` — the lot page's evidence-folio surface
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §9, §2.5).
//
// Deliberately plain about what a folio IS. The copy never says certified,
// approved, compliant, submitted or lodged (`[DH-B8]`, **AT-136**) — the folio
// is a compilation the certifying consultant works FROM, and a button that
// implies otherwise would undo the document's whole design.

import { useState } from 'react';
import { FileText, Download, ShieldCheck } from 'lucide-react';

import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';
import {
  downloadFolio,
  useIssueFolio,
  useLotFolios,
  type IssuedFolio,
} from '../hooks/useLotFolios';

interface EvidenceFolioSectionProps {
  lotId: string;
  lotNumber: string;
  /** The SERVER-derived effective project role — never `user.role`, which the
   *  RoleSwitcher can override. The backend re-checks it regardless (§9). */
  effectiveRole: string;
  canIssueFolio: boolean;
}

function formatIssuedAt(value: string): string {
  return new Date(value).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

export function EvidenceFolioSection({
  lotId,
  lotNumber,
  effectiveRole,
  canIssueFolio,
}: EvidenceFolioSectionProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { data, isLoading } = useLotFolios(lotId, Boolean(effectiveRole));
  const issueFolio = useIssueFolio(lotId);

  const folios = data?.folios ?? [];

  const handleIssue = () => {
    issueFolio.mutate(undefined, {
      onSuccess: (folio) => {
        toast({
          title: `Folio v${folio.version} issued`,
          description: 'It is now downloadable and cannot be altered.',
        });
      },
      onError: (error: unknown) => {
        logError('Error issuing folio:', error);
        toast({
          title: 'Could not issue folio',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      },
    });
  };

  const handleDownload = async (folio: IssuedFolio) => {
    setDownloadingId(folio.id);
    try {
      await downloadFolio(folio, lotNumber);
    } catch (error) {
      logError('Error downloading folio:', error);
      toast({
        title: 'Download failed',
        description: 'Could not download this folio',
        variant: 'error',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  if (!effectiveRole) return null;

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Evidence folio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A compilation of the records held for this lot, stated against the Logan PSP5 §5.6.5(1)
            pack — what is present, what is not, and what CIVOS cannot assess. It is not a
            certification: your consultant certifies, working from this.
          </p>
        </div>
        {canIssueFolio && (
          <button
            onClick={handleIssue}
            disabled={issueFolio.isLoading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {issueFolio.isLoading ? 'Issuing…' : 'Issue folio'}
          </button>
        )}
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading issued folios…</span>
          </div>
        ) : folios.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No folio has been issued for this lot yet.
            {canIssueFolio ? '' : ' Ask a project or quality manager to issue one.'}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {folios.map((folio) => (
              <li key={folio.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="rounded bg-muted px-2 py-0.5 text-sm font-medium text-foreground">
                  v{folio.version}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <time dateTime={folio.issuedAt}>{formatIssuedAt(folio.issuedAt)}</time>
                    {folio.issuedBy ? ` · ${folio.issuedBy.name}` : ''}
                  </p>
                  {/* The checksum is shown because it is the point: these exact
                      bytes, unaltered since issue. A folio row cannot be
                      updated at all — re-issuing makes a NEW version. */}
                  <p
                    className="flex items-center gap-1 truncate font-mono text-xs text-muted-foreground"
                    title={folio.sha256}
                  >
                    <ShieldCheck className="h-3 w-3 shrink-0" />
                    SHA-256 {folio.sha256.slice(0, 16)}…
                  </p>
                </div>
                <button
                  onClick={() => void handleDownload(folio)}
                  disabled={downloadingId === folio.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {downloadingId === folio.id ? 'Downloading…' : 'Download'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
