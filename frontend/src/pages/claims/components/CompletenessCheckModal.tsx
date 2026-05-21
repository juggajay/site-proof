import React from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, XCircle } from 'lucide-react';
import type { CompletenessData, CompletenessLot } from '../types';
import type { EvidenceReadinessItem } from '@/types/evidenceReadiness';
import { formatCurrency } from '../utils';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

interface CompletenessCheckModalProps {
  loading: boolean;
  data: CompletenessData | null;
  onClose: () => void;
}

function severityStyles(item: EvidenceReadinessItem) {
  if (item.severity === 'blocker') {
    return {
      wrapper: 'bg-red-50 border-red-100',
      icon: <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />,
      title: 'text-red-800',
      detail: 'text-red-700',
    };
  }

  if (item.severity === 'warning') {
    return {
      wrapper: 'bg-amber-50 border-amber-100',
      icon: <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />,
      title: 'text-amber-800',
      detail: 'text-amber-700',
    };
  }

  return {
    wrapper: 'bg-green-50 border-green-100',
    icon: <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />,
    title: 'text-green-800',
    detail: 'text-green-700',
  };
}

function EvidenceItem({ item }: { item: EvidenceReadinessItem }) {
  const styles = severityStyles(item);

  return (
    <div className={`flex items-start gap-2 rounded border p-2 text-sm ${styles.wrapper}`}>
      {styles.icon}
      <div>
        <div className={`font-medium ${styles.title}`}>{item.title}</div>
        <div className={`text-xs mt-0.5 ${styles.detail}`}>{item.detail}</div>
      </div>
    </div>
  );
}

function stateBadge(lot: CompletenessLot) {
  if (lot.claim.state === 'blocked') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <XCircle className="h-3 w-3" /> Blocked
      </span>
    );
  }

  if (lot.claim.state === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        <AlertTriangle className="h-3 w-3" /> Needs review
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      <CheckCircle2 className="h-3 w-3" /> Ready
    </span>
  );
}

function LotEvidenceCard({ lot }: { lot: CompletenessLot }) {
  const items = [...lot.claim.blockers, ...lot.claim.warnings, ...lot.claim.support];

  return (
    <div
      className={`rounded-lg border p-4 ${
        lot.claim.state === 'blocked'
          ? 'border-red-200 bg-red-50/60'
          : lot.claim.state === 'warning'
            ? 'border-amber-200 bg-amber-50/60'
            : 'border-green-200 bg-green-50/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{lot.lotNumber}</span>
            <span className="text-sm text-muted-foreground">{lot.activityType}</span>
            {stateBadge(lot)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Claim line: {formatCurrency(lot.claimAmount)}
          </div>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <EvidenceItem key={`${lot.lotId}-${item.code}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          Claim evidence is ready for review.
        </div>
      )}
    </div>
  );
}

export const CompletenessCheckModal = React.memo(function CompletenessCheckModal({
  loading,
  data,
  onClose,
}: CompletenessCheckModalProps) {
  return (
    <Modal onClose={onClose} className="max-w-4xl">
      <ModalHeader>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <span>Claim Evidence Review</span>
        </div>
      </ModalHeader>
      <ModalBody>
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Reviewing claim evidence...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Checking ITPs, hold points, test results, NCRs, and supporting documents.
            </p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{data.summary.readyCount}</div>
                <p className="text-sm text-muted-foreground">Ready</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-amber-600">{data.summary.reviewCount}</div>
                <p className="text-sm text-muted-foreground">Needs review</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{data.summary.blockedCount}</div>
                <p className="text-sm text-muted-foreground">Blocked</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <div className="text-xl font-bold">
                  {formatCurrency(data.summary.totalClaimAmount)}
                </div>
                <p className="text-sm text-muted-foreground">Total claim</p>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">Evidence-supported amount</div>
                  <p className="text-sm text-muted-foreground">
                    Claim value excluding lines with evidence blockers.
                  </p>
                </div>
                <div className="text-xl font-bold text-green-700">
                  {formatCurrency(data.summary.recommendedAmount)}
                </div>
              </div>
            </div>

            {data.overallSuggestions.length > 0 && (
              <div className="rounded-lg border bg-primary/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  <span className="font-medium text-primary">Recommended actions</span>
                </div>
                <ul className="space-y-1">
                  {data.overallSuggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-primary">
                      <span className="text-primary/60">&#8226;</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.summary.blockedCount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Evidence blockers do not change this claim&apos;s status. Resolve them before
                sharing the claim pack when the client needs a cleaner evidence trail.
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-3">Claim lines</h3>
              <div className="space-y-3">
                {data.lots.map((lot) => (
                  <LotEvidenceCard key={lot.lotId} lot={lot} />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
});
