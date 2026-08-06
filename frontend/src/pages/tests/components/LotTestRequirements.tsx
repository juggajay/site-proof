// "N of M passing", per frequency rule, for one lot — with the working shown.
//
// Three rules this component exists to keep:
//
//  1. PER RULE, never one blended ratio. A lot can satisfy its compaction rule
//     with nothing recorded for another; a single fraction would average the two
//     and read as partial progress on both.
//  2. RAISED IS NOT PASSING. The headline counts only verified passing tests.
//     Rows that have been raised and are waiting on results are named
//     separately, so "6 of 6 raised" can never be mistaken for "6 of 6 passing".
//  3. UNKNOWN IS UNKNOWN. When the engine cannot compute a count, the line reads
//     "requirement not yet checkable — {reason}" and offers the fix. Never
//     "0 of 0", never a bare number.
//
// It renders NOTHING when no authority pack governs the project (most projects)
// or when the project turned the check off — the same "only where a shipped pack
// governs" rule the lot form's Testing card follows.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { extractErrorMessage } from '@/lib/errorHandling';
import {
  citationText,
  progressText,
  unknownHelpText,
  useLotTestRequirements,
  type BatchRaiseResponse,
  type LotTestRequirementRule,
  type LotTestRequirements as LotTestRequirementsData,
} from '../lotTestRequirements';

interface LotTestRequirementsProps {
  lotId: string;
  projectId: string;
  /** Show the "Raise N tests" action. Off for read-only surfaces. */
  canRaise?: boolean;
}

/** The fraction, or — when the count is not computable — the reason and the fix. */
function RuleCount({
  rule,
  scaleLabel,
}: {
  rule: LotTestRequirementRule;
  scaleLabel: string | null;
}) {
  if (rule.requiredCount === null) {
    return (
      <span className="ml-2 font-normal text-muted-foreground">
        {unknownHelpText(rule.unknownCauses, scaleLabel)}
      </span>
    );
  }

  return (
    <span className={`ml-2 ${rule.state === 'satisfied' ? 'text-success' : 'text-foreground'}`}>
      {rule.passingCount} of {rule.requiredCount} passing
    </span>
  );
}

/** The working: which clause of which edition produced this number. */
function RuleCitation({ rule }: { rule: LotTestRequirementRule }) {
  const citation = citationText(rule);
  if (!citation) return null;

  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        Show the working
      </summary>
      <p className="mt-1 text-xs text-muted-foreground" title={citation}>
        {citation}
        {rule.citation?.confirmed === false
          ? ' — this edition has not been confirmed against the published document yet'
          : ''}
      </p>
    </details>
  );
}

function RaiseButton({
  rule,
  onRaise,
  raising,
}: {
  rule: LotTestRequirementRule;
  onRaise?: (rule: LotTestRequirementRule) => void;
  raising: boolean;
}) {
  if (!onRaise || rule.outstandingCount < 1) return null;

  const plural = rule.outstandingCount === 1 ? '' : 's';
  return (
    <button
      type="button"
      onClick={() => onRaise(rule)}
      disabled={raising}
      className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
    >
      {raising ? 'Raising…' : `Raise ${rule.outstandingCount} test${plural}`}
    </button>
  );
}

function RuleLine({
  rule,
  scaleLabel,
  onRaise,
  raising,
}: {
  rule: LotTestRequirementRule;
  scaleLabel: string | null;
  onRaise?: (rule: LotTestRequirementRule) => void;
  raising: boolean;
}) {
  const progress = progressText(rule);

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2" data-testid="rule-line">
      <div className="min-w-0">
        <div className="text-sm font-medium">
          <span className="capitalize">{rule.testType}</span>
          <RuleCount rule={rule} scaleLabel={scaleLabel} />
        </div>
        {progress && <div className="mt-0.5 text-xs text-muted-foreground">{progress}</div>}
        <RuleCitation rule={rule} />
      </div>
      <RaiseButton rule={rule} onRaise={onRaise} raising={raising} />
    </li>
  );
}

export function LotTestRequirements({ lotId, projectId, canRaise }: LotTestRequirementsProps) {
  const queryClient = useQueryClient();
  const { data } = useLotTestRequirements(lotId);

  const raise = useMutation({
    mutationFn: (rule: LotTestRequirementRule) =>
      apiFetch<BatchRaiseResponse>('/api/test-results/batch-raise', {
        method: 'POST',
        body: JSON.stringify({ lotId, requests: [{ ruleId: rule.ruleId }] }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(queryKeys.lotTestRequirements(lotId));
      queryClient.invalidateQueries(queryKeys.testResults(projectId));
      queryClient.invalidateQueries(queryKeys.lotReadiness(lotId));
    },
  });

  const requirements: LotTestRequirementsData | undefined = data;

  // No shipped pack governs this project, the check is switched off, or the
  // caller has no access to CIVOS's judgement — in all three cases the honest
  // thing is to say nothing rather than to show an empty requirement.
  if (!requirements || !requirements.ruleset || requirements.mode === 'off') return null;

  const scaleLabel = requirements.ruleset.scaleLabel;

  return (
    <div className="rounded-lg border p-4" data-testid="lot-test-requirements">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Tests this lot needs</h3>
        {requirements.ruleset.status !== 'confirmed' && (
          <span className="text-xs text-muted-foreground">
            {requirements.ruleset.revalidationLapsed
              ? 'ruleset due for revalidation'
              : 'unconfirmed ruleset'}
          </span>
        )}
      </div>

      {requirements.rules.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {unknownHelpText(requirements.unknownCauses, scaleLabel)}
        </p>
      ) : (
        <ul className="mt-1 divide-y">
          {requirements.rules.map((rule) => (
            <RuleLine
              key={rule.ruleId}
              rule={rule}
              scaleLabel={scaleLabel}
              onRaise={canRaise ? (target) => raise.mutate(target) : undefined}
              raising={raise.isLoading}
            />
          ))}
        </ul>
      )}

      {raise.isError && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {extractErrorMessage(raise.error, 'Could not raise these tests.')}
        </p>
      )}
    </div>
  );
}
