import { useEffect, useRef } from 'react';
import { Link2, Check, Download, RefreshCw, ClipboardCheck } from 'lucide-react';
import { MobileDataCard } from '@/components/ui/MobileDataCard';
import { Button } from '@/components/ui/button';
import type { HoldPoint, StatusFilter } from '../types';
import {
  buildFilterEmptyStateMessage,
  formatHoldPointDate,
  getStatusLabel,
  isNoticeExpired,
  isOverdue,
} from './holdPointTableUtils';
import { getReleaseIdentityParts } from '../holdPointReleaseIdentity';

interface HoldPointsMobileListProps {
  holdPoints: HoldPoint[];
  filteredHoldPoints: HoldPoint[];
  loading: boolean;
  statusFilter: StatusFilter;
  searchQuery: string;
  /** Deep-linked hold point (?hp=<id>) to scroll to and highlight. */
  highlightedHpId: string | null;
  copiedHpId: string | null;
  generatingPdf: string | null;
  chasingHpId: string | null;
  batchSelectableHoldPointIds: Set<string>;
  selectedBatchHoldPointIds: Set<string>;
  onCopyLink: (hpId: string, lotNumber: string, description: string) => void;
  onRequestRelease: (hp: HoldPoint) => void;
  onRecordRelease: (hp: HoldPoint) => void;
  onChase: (hp: HoldPoint) => void;
  onGenerateEvidence: (hp: HoldPoint) => void;
  onToggleBatchSelection: (hp: HoldPoint) => void;
  onClearFilter: () => void;
}

// Mobile (<768px) card layout for the hold-point register. Mirrors the desktop
// HoldPointsTable's loading/empty/filter-empty states and its exact per-status
// action gating, but renders each hold point as a tap-friendly card with a
// full-width primary action. Reuses the page's existing request/record/chase/
// evidence handlers and modals — no behavior or permission changes.
export function HoldPointsMobileList({
  holdPoints,
  filteredHoldPoints,
  loading,
  statusFilter,
  searchQuery,
  highlightedHpId,
  copiedHpId,
  generatingPdf,
  chasingHpId,
  batchSelectableHoldPointIds,
  selectedBatchHoldPointIds,
  onCopyLink,
  onRequestRelease,
  onRecordRelease,
  onChase,
  onGenerateEvidence,
  onToggleBatchSelection,
  onClearFilter,
}: HoldPointsMobileListProps) {
  const highlightedCardRef = useRef<HTMLDivElement | null>(null);

  // Scroll the deep-linked hold point's card into view while its highlight
  // pulse is active.
  useEffect(() => {
    if (!highlightedHpId) return;
    highlightedCardRef.current?.scrollIntoView({ block: 'center' });
  }, [highlightedHpId]);

  if (loading) {
    return (
      <div className="flex justify-center p-8" role="status" aria-label="Loading hold points">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (holdPoints.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <div className="text-4xl mb-4">&#x1f512;</div>
        <h3 className="text-lg font-semibold mb-2">No Hold Points</h3>
        <p className="text-muted-foreground mb-4">
          Hold points are created when ITPs with hold point items are assigned to lots. Create an
          ITP template with hold point items and assign it to a lot to see hold points here.
        </p>
      </div>
    );
  }

  if (filteredHoldPoints.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <div className="text-4xl mb-4">&#x1f50d;</div>
        <h3 className="text-lg font-semibold mb-2">No Hold Points Match Filter</h3>
        <p className="text-muted-foreground mb-4">
          {buildFilterEmptyStateMessage(statusFilter, searchQuery)}
        </p>
        <button type="button" onClick={onClearFilter} className="text-primary hover:underline">
          Show all hold points
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredHoldPoints.map((hp) => {
        const isDeepLinked = hp.id === highlightedHpId;
        return (
          <div
            key={hp.id}
            ref={isDeepLinked ? highlightedCardRef : undefined}
            className={isDeepLinked ? 'rounded-xl ring-2 ring-primary/50' : undefined}
            data-deep-linked={isDeepLinked ? 'true' : undefined}
          >
            <HoldPointMobileCard
              hp={hp}
              copiedHpId={copiedHpId}
              generatingPdf={generatingPdf}
              chasingHpId={chasingHpId}
              canSelectForBatch={batchSelectableHoldPointIds.has(hp.id)}
              isSelectedForBatch={selectedBatchHoldPointIds.has(hp.id)}
              onCopyLink={onCopyLink}
              onRequestRelease={onRequestRelease}
              onRecordRelease={onRecordRelease}
              onChase={onChase}
              onGenerateEvidence={onGenerateEvidence}
              onToggleBatchSelection={onToggleBatchSelection}
            />
          </div>
        );
      })}
    </div>
  );
}

interface HoldPointMobileCardProps {
  hp: HoldPoint;
  copiedHpId: string | null;
  generatingPdf: string | null;
  chasingHpId: string | null;
  canSelectForBatch: boolean;
  isSelectedForBatch: boolean;
  onCopyLink: (hpId: string, lotNumber: string, description: string) => void;
  onRequestRelease: (hp: HoldPoint) => void;
  onRecordRelease: (hp: HoldPoint) => void;
  onChase: (hp: HoldPoint) => void;
  onGenerateEvidence: (hp: HoldPoint) => void;
  onToggleBatchSelection: (hp: HoldPoint) => void;
}

const statusVariants: Record<string, 'default' | 'warning' | 'success'> = {
  pending: 'default',
  notified: 'warning',
  released: 'default',
};

function HoldPointMobileCard({
  hp,
  copiedHpId,
  generatingPdf,
  chasingHpId,
  canSelectForBatch,
  isSelectedForBatch,
  onCopyLink,
  onRequestRelease,
  onRecordRelease,
  onChase,
  onGenerateEvidence,
  onToggleBatchSelection,
}: HoldPointMobileCardProps) {
  const overdue = isOverdue(hp);
  const noticeExpired = isNoticeExpired(hp);
  const isVirtual = hp.id.startsWith('virtual-');
  const releaseIdentity = hp.releasedAt ? getReleaseIdentityParts(hp) : null;

  return (
    <MobileDataCard
      title={hp.lotNumber}
      subtitle={hp.description}
      status={{ label: getStatusLabel(hp.status), variant: statusVariants[hp.status] ?? 'default' }}
      className={overdue ? 'border-destructive' : undefined}
      fields={[
        ...(hp.notificationSentAt
          ? [
              {
                label: 'Notified',
                value: noticeExpired ? (
                  <span className="text-warning font-medium">
                    {formatHoldPointDate(hp.notificationSentAt)} &middot; Notice expired
                  </span>
                ) : (
                  formatHoldPointDate(hp.notificationSentAt)
                ),
                priority: 'secondary' as const,
              },
            ]
          : []),
        {
          label: 'Scheduled',
          value: overdue ? (
            <span className="text-destructive font-medium">
              {formatHoldPointDate(hp.scheduledDate)} &middot; Overdue
            </span>
          ) : (
            formatHoldPointDate(hp.scheduledDate)
          ),
          priority: 'primary',
        },
        {
          label: 'Released',
          value: hp.releasedAt ? (
            <span>
              {formatHoldPointDate(hp.releasedAt)}
              {releaseIdentity && (
                <span className="block text-xs text-muted-foreground">
                  {releaseIdentity.primary}
                  {releaseIdentity.secondary && (
                    <span className="block">{releaseIdentity.secondary}</span>
                  )}
                </span>
              )}
            </span>
          ) : (
            '-'
          ),
          priority: 'primary',
        },
      ]}
      actions={
        <div className="flex w-full flex-col gap-2">
          <label className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={isSelectedForBatch}
              disabled={!canSelectForBatch}
              onChange={() => onToggleBatchSelection(hp)}
              aria-label={`Select ${hp.description} for batch release`}
              className="h-4 w-4 rounded border-border"
            />
            <span>Batch request</span>
          </label>

          {hp.status === 'pending' && (
            <Button size="lg" className="w-full" onClick={() => onRequestRelease(hp)}>
              Request Release
            </Button>
          )}

          {hp.status === 'notified' && !isVirtual && (
            <>
              <Button
                variant="success"
                size="lg"
                className="w-full"
                onClick={() => onRecordRelease(hp)}
              >
                <ClipboardCheck className="h-4 w-4" />
                Record Manual Release
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                disabled={chasingHpId === hp.id}
                onClick={() => onChase(hp)}
              >
                {chasingHpId === hp.id ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Chasing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Chase
                  </>
                )}
              </Button>
            </>
          )}

          {hp.status === 'released' && !isVirtual && (
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              disabled={generatingPdf === hp.id}
              onClick={() => onGenerateEvidence(hp)}
            >
              {generatingPdf === hp.id ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Evidence PDF
                </>
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => onCopyLink(hp.id, hp.lotNumber, hp.description)}
            aria-label={`Copy link to hold point ${hp.lotNumber}`}
          >
            {copiedHpId === hp.id ? (
              <>
                <Check className="h-4 w-4 text-success" />
                Copied
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" />
                Copy link
              </>
            )}
          </Button>
        </div>
      }
    />
  );
}
