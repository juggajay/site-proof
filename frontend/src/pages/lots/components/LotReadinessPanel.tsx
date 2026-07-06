import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDot, RefreshCw, ShieldCheck } from 'lucide-react';
import type {
  EvidenceReadinessItem,
  LotEvidenceReadiness,
  ReadinessBucket,
} from '@/types/evidenceReadiness';
import type { LotTab } from '../types';

type OutstandingTest = NonNullable<EvidenceReadinessItem['outstandingTests']>[number];

// Short muted suffix describing a test's state. no_result is the default
// "nothing recorded yet" case and needs no suffix.
const OUTSTANDING_TEST_STATE_SUFFIX: Record<OutstandingTest['state'], string> = {
  no_result: '',
  awaiting_verification: 'awaiting verification',
  failing: 'failing',
  unmatched_result_exists: 'result not linked',
};

const OUTSTANDING_TEST_PREVIEW_COUNT = 3;

// Compact, left-aligned list of the outstanding tests behind the test blocker.
// Names render for every role (the blocker prose only states counts); the "Add"
// button appears only when onAddTestForItem is provided (test-creator roles).
function OutstandingTestList({
  tests,
  onAddTestForItem,
}: {
  tests: OutstandingTest[];
  onAddTestForItem?: (item: { id: string; description: string; testType: string | null }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? tests : tests.slice(0, OUTSTANDING_TEST_PREVIEW_COUNT);

  return (
    <span className="mt-1.5 block space-y-1">
      {shown.map((test) => {
        const suffix = OUTSTANDING_TEST_STATE_SUFFIX[test.state];
        return (
          <span key={test.itemId} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {test.description}
              {suffix ? <span className="text-muted-foreground/70"> — {suffix}</span> : null}
            </span>
            {onAddTestForItem ? (
              <button
                type="button"
                className="flex-shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline"
                onClick={() =>
                  onAddTestForItem({
                    id: test.itemId,
                    description: test.description,
                    testType: test.testType,
                  })
                }
              >
                Add
              </button>
            ) : null}
          </span>
        );
      })}
      {tests.length > OUTSTANDING_TEST_PREVIEW_COUNT ? (
        <button
          type="button"
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : `Show all ${tests.length}`}
        </button>
      ) : null}
    </span>
  );
}

interface LotReadinessPanelProps {
  readiness: LotEvidenceReadiness | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onTabChange: (tab: LotTab, actionCode?: string) => void;
  // When provided (test-creator roles), the named outstanding tests each get an
  // "Add result" action that opens the pre-linked create-test modal. Omitted
  // for roles that can't create tests, which hides the affordance.
  onAddTestForItem?: (item: { id: string; description: string; testType: string | null }) => void;
  // When true, render a field-first view (foreman/field roles): no commercial
  // "Claim" bucket and no claim-readiness language. Quality/conformance work is
  // preserved, but framed as outstanding field work rather than a claims workflow.
  fieldView?: boolean;
}

const TAB_IDS: LotTab[] = ['itp', 'tests', 'ncrs', 'photos', 'documents', 'comments', 'history'];

type ReadinessBucketKind = 'conformance' | 'claim' | 'managementPrep';

function bucketTitle(kind: ReadinessBucketKind): string {
  if (kind === 'managementPrep') return 'Management prep';
  return kind === 'conformance' ? 'Conformance' : 'Claim';
}

function stateLabel(bucket: ReadinessBucket, kind: ReadinessBucketKind): string {
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
    return 'border-destructive/30 bg-destructive/10 text-foreground';
  }

  if (bucket.blockers.length > 0 || bucket.warnings.length > 0) {
    return 'border-warning/30 bg-warning/10 text-foreground';
  }

  return 'border-success/30 bg-success/10 text-foreground';
}

function tabFromHref(href?: string): LotTab | null {
  if (!href) return null;
  if (!href.startsWith('?')) return null;
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
  const tab = tabFromHref(item.actionHref);
  if (item.actionHref && !tab) return null;
  return tab ?? tabFromArea(item.area);
}

function externalActionHref(item: EvidenceReadinessItem): string | null {
  if (!item.actionHref || tabFromHref(item.actionHref)) return null;
  if (item.actionHref.startsWith('/') || item.actionHref.startsWith('http')) {
    return item.actionHref;
  }
  return null;
}

function itemIcon(item: EvidenceReadinessItem) {
  if (item.severity === 'support') {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />;
  }

  if (item.blocksAction) {
    return <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />;
  }

  return <CircleDot className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />;
}

function ItemList({
  items,
  onTabChange,
  onAddTestForItem,
  maxItems = 4,
}: {
  items: EvidenceReadinessItem[];
  onTabChange: (tab: LotTab, actionCode?: string) => void;
  onAddTestForItem?: (item: { id: string; description: string; testType: string | null }) => void;
  maxItems?: number;
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
      {items.slice(0, maxItems).map((item) => {
        const tab = actionTab(item);
        const href = externalActionHref(item);
        return (
          <li key={`${item.area}-${item.code}`} className="flex items-start gap-2 text-sm">
            {itemIcon(item)}
            <span className="min-w-0">
              <span className="font-medium">{item.title}</span>
              <span className="text-muted-foreground"> - {item.detail}</span>
              {href && item.actionLabel ? (
                <a
                  className="ml-2 font-medium text-primary underline-offset-4 hover:underline"
                  href={href}
                >
                  {item.actionLabel}
                </a>
              ) : tab && item.actionLabel ? (
                <button
                  type="button"
                  className="ml-2 font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => onTabChange(tab, item.code)}
                >
                  {item.actionLabel}
                </button>
              ) : null}
              {item.outstandingTests && item.outstandingTests.length > 0 && (
                <OutstandingTestList
                  tests={item.outstandingTests}
                  onAddTestForItem={onAddTestForItem}
                />
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
  onAddTestForItem,
  fieldView = false,
}: {
  bucket: ReadinessBucket;
  kind: ReadinessBucketKind;
  onTabChange: (tab: LotTab, actionCode?: string) => void;
  onAddTestForItem?: (item: { id: string; description: string; testType: string | null }) => void;
  fieldView?: boolean;
}) {
  const items = [...bucket.blockers, ...bucket.warnings, ...bucket.support];
  const maxItems = kind === 'managementPrep' ? 5 : 4;

  return (
    <div className={`rounded-md border p-3 ${bucketTone(bucket)}`}>
      <h3 className="text-sm font-semibold">
        {fieldView ? conformanceFieldLabel(bucket) : stateLabel(bucket, kind)}
      </h3>
      <ItemList
        items={items}
        onTabChange={onTabChange}
        onAddTestForItem={onAddTestForItem}
        maxItems={maxItems}
      />
    </div>
  );
}

export function LotReadinessPanel({
  readiness,
  loading,
  error,
  onRetry,
  onTabChange,
  onAddTestForItem,
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
        className="rounded-lg border border-warning/30 bg-warning/10 p-4"
        aria-label="Evidence Readiness"
      >
        <h2 className="text-lg font-semibold text-foreground">Evidence Readiness unavailable</h2>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
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
            onAddTestForItem={onAddTestForItem}
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

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <ReadinessBucketView
          bucket={readiness.conformance}
          kind="conformance"
          onTabChange={onTabChange}
          onAddTestForItem={onAddTestForItem}
        />
        <ReadinessBucketView bucket={readiness.claim} kind="claim" onTabChange={onTabChange} />
        {readiness.managementPrep && (
          <ReadinessBucketView
            bucket={readiness.managementPrep}
            kind="managementPrep"
            onTabChange={onTabChange}
          />
        )}
      </div>
    </section>
  );
}
