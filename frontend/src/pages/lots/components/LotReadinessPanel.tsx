import { AlertTriangle, CheckCircle2, CircleDot, RefreshCw, ShieldCheck } from 'lucide-react';
import type {
  EvidenceReadinessItem,
  LotEvidenceReadiness,
  ReadinessBucket,
} from '@/types/evidenceReadiness';
import type { LotTab } from '../types';

interface LotReadinessPanelProps {
  readiness: LotEvidenceReadiness | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onTabChange: (tab: LotTab, actionCode?: string) => void;
  // When true, render a field-first view (foreman/field roles): no commercial
  // "Claim" bucket and no claim-readiness language. Quality/conformance work is
  // preserved, but framed as outstanding field work rather than a claims workflow.
  fieldView?: boolean;
}

const TAB_IDS: LotTab[] = ['itp', 'tests', 'ncrs', 'photos', 'documents', 'comments', 'history'];

function bucketTitle(kind: 'conformance' | 'claim'): string {
  return kind === 'conformance' ? 'Conformance' : 'Claim';
}

function stateLabel(bucket: ReadinessBucket, kind: 'conformance' | 'claim'): string {
  const title = bucketTitle(kind);

  if (bucket.state === 'ready') return `${title}: Ready`;
  if (bucket.state === 'warning') return `${title}: Needs attention`;
  if (bucket.state === 'already_conformed') return 'Conformance: Complete';
  if (bucket.state === 'already_claimed') return 'Claim: Already claimed';
  if (bucket.state === 'not_conformed') return 'Claim: Not ready';
  return `${title}: Blocked`;
}

// Field-language label for the conformance bucket on the foreman view. Keeps the
// quality/conformance meaning (sign-off) without any commercial claim wording.
function conformanceFieldLabel(bucket: ReadinessBucket): string {
  if (bucket.state === 'ready') return 'Ready for sign-off';
  if (bucket.state === 'already_conformed') return 'Signed off';
  if (bucket.state === 'warning') return 'A few things to check';
  return 'Needs work before sign-off';
}

function bucketTone(bucket: ReadinessBucket): string {
  if (bucket.blockers.some((item) => item.blocksAction)) {
    return 'border-red-200 bg-red-50 text-red-950';
  }

  if (bucket.blockers.length > 0 || bucket.warnings.length > 0) {
    return 'border-amber-200 bg-amber-50 text-amber-950';
  }

  return 'border-green-200 bg-green-50 text-green-950';
}

function tabFromHref(href?: string): LotTab | null {
  if (!href) return null;
  const params = new URLSearchParams(href.startsWith('?') ? href.slice(1) : href);
  const tab = params.get('tab');
  return tab && TAB_IDS.includes(tab as LotTab) ? (tab as LotTab) : null;
}

function tabFromArea(area: EvidenceReadinessItem['area']): LotTab | null {
  if (area === 'itp' || area === 'hold_point') return 'itp';
  if (area === 'test') return 'tests';
  if (area === 'ncr') return 'ncrs';
  if (area === 'document') return 'documents';
  return null;
}

function actionTab(item: EvidenceReadinessItem): LotTab | null {
  return tabFromHref(item.actionHref) ?? tabFromArea(item.area);
}

function itemIcon(item: EvidenceReadinessItem) {
  if (item.severity === 'support') {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />;
  }

  if (item.blocksAction) {
    return <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />;
  }

  return <CircleDot className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />;
}

function ItemList({
  items,
  onTabChange,
}: {
  items: EvidenceReadinessItem[];
  onTabChange: (tab: LotTab, actionCode?: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        No blockers found for this part of the workflow.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {items.slice(0, 4).map((item) => {
        const tab = actionTab(item);
        return (
          <li key={`${item.area}-${item.code}`} className="flex items-start gap-2 text-sm">
            {itemIcon(item)}
            <span className="min-w-0">
              <span className="font-medium">{item.title}</span>
              <span className="text-muted-foreground"> - {item.detail}</span>
              {tab && item.actionLabel && (
                <button
                  type="button"
                  className="ml-2 font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => onTabChange(tab, item.code)}
                >
                  {item.actionLabel}
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ReadinessBucketView({
  bucket,
  kind,
  onTabChange,
  fieldView = false,
}: {
  bucket: ReadinessBucket;
  kind: 'conformance' | 'claim';
  onTabChange: (tab: LotTab, actionCode?: string) => void;
  fieldView?: boolean;
}) {
  const items = [...bucket.blockers, ...bucket.warnings, ...bucket.support];

  return (
    <div className={`rounded-md border p-3 ${bucketTone(bucket)}`}>
      <h3 className="text-sm font-semibold">
        {fieldView ? conformanceFieldLabel(bucket) : stateLabel(bucket, kind)}
      </h3>
      <ItemList items={items} onTabChange={onTabChange} />
    </div>
  );
}

export function LotReadinessPanel({
  readiness,
  loading,
  error,
  onRetry,
  onTabChange,
  fieldView = false,
}: LotReadinessPanelProps) {
  if (loading) {
    return (
      <section className="rounded-lg border bg-card p-4" aria-label="Evidence Readiness">
        <h2 className="text-lg font-semibold">Evidence Readiness</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Checking blockers and supporting proof...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section
        className="rounded-lg border border-amber-200 bg-amber-50 p-4"
        aria-label="Evidence Readiness"
      >
        <h2 className="text-lg font-semibold text-amber-950">Evidence Readiness unavailable</h2>
        <p className="mt-1 text-sm text-amber-900">{error}</p>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-amber-950 underline-offset-4 hover:underline"
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </section>
    );
  }

  if (!readiness) return null;

  // Field-first view for foreman/field roles: surface only the outstanding
  // quality/conformance field work, with no commercial "Claim" bucket. The lot
  // edit / claim setup actions are gated elsewhere (LotHeader, route guards).
  if (fieldView) {
    const bucket = readiness.conformance;

    return (
      <section className="rounded-lg border bg-card p-4" aria-label="What still needs doing">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">What still needs doing on this lot</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {bucket.blockers.length} to fix &middot; {bucket.warnings.length} to check &middot;{' '}
              {bucket.support.length} done
            </p>
          </div>
          <ShieldCheck className="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="mt-4">
          <ReadinessBucketView
            bucket={bucket}
            kind="conformance"
            onTabChange={onTabChange}
            fieldView
          />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-4" aria-label="Evidence Readiness">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Evidence Readiness</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {readiness.summary.actionBlockerCount} action blocker
            {readiness.summary.actionBlockerCount === 1 ? '' : 's'} /{' '}
            {readiness.summary.warningCount} warning
            {readiness.summary.warningCount === 1 ? '' : 's'} / {readiness.summary.supportCount}{' '}
            support item
            {readiness.summary.supportCount === 1 ? '' : 's'}
          </p>
        </div>
        <ShieldCheck className="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ReadinessBucketView
          bucket={readiness.conformance}
          kind="conformance"
          onTabChange={onTabChange}
        />
        <ReadinessBucketView bucket={readiness.claim} kind="claim" onTabChange={onTabChange} />
      </div>
    </section>
  );
}
