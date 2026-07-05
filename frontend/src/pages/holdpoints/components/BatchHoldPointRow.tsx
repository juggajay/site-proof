import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { HPEvidencePackageData } from '@/lib/pdfGenerator';
import { HoldPointEvidencePackageCard } from './HoldPointEvidencePackageCard';
import { StatusPill, isHoldPointReleased } from './publicReleaseShared';

export interface BatchHoldPoint {
  holdPointId: string;
  sequenceNumber: number | null;
  description: string;
  status: string;
  releasedAt: string | null;
  releasedByName: string | null;
}

export interface HoldPointPackageState {
  data?: HPEvidencePackageData;
  loading: boolean;
  error: string | null;
}

interface BatchHoldPointRowProps {
  holdPoint: BatchHoldPoint;
  selected: boolean;
  onToggleSelect: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  packageState: HoldPointPackageState | undefined;
  getDocumentUrl: (documentId: string) => string;
}

export function BatchHoldPointRow({
  holdPoint,
  selected,
  onToggleSelect,
  expanded,
  onToggleExpand,
  packageState,
  getDocumentUrl,
}: BatchHoldPointRowProps) {
  const released = isHoldPointReleased(holdPoint.status);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    const evidencePackage = packageState?.data;
    if (!evidencePackage || downloadingPdf) return;

    setPdfError(null);
    setDownloadingPdf(true);
    try {
      const { generateHPEvidencePackagePDF } = await import('@/lib/pdfGenerator');
      await generateHPEvidencePackagePDF(evidencePackage);
    } catch (error) {
      setPdfError(extractErrorMessage(error, 'Could not generate the evidence package PDF.'));
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-start gap-3 p-4">
        {!released && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select hold point ${holdPoint.description}`}
            className="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-2 focus:ring-ring"
          />
        )}
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          {expanded ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {holdPoint.sequenceNumber != null ? `${holdPoint.sequenceNumber}. ` : ''}
              {holdPoint.description}
            </div>
            {released && holdPoint.releasedByName && (
              <div className="mt-0.5 text-sm text-muted-foreground">
                Released by {holdPoint.releasedByName}
              </div>
            )}
          </div>
        </button>
        <StatusPill status={holdPoint.status} />
      </div>

      {expanded && (
        <div className="border-t px-4 py-4">
          {packageState?.loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading evidence package</span>
            </div>
          )}
          {packageState?.error && (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{packageState.error}</span>
            </div>
          )}
          {packageState?.data && (
            <HoldPointEvidencePackageCard
              evidencePackage={packageState.data}
              getDocumentUrl={getDocumentUrl}
              onDownloadPdf={handleDownloadPdf}
              downloadingPdf={downloadingPdf}
              pdfError={pdfError}
            />
          )}
        </div>
      )}
    </div>
  );
}
