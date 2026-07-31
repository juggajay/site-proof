/**
 * Wave G G2 — ITP library provenance
 * (`docs/plans/wave-g-execution-spec-2026-07-31.md` §2).
 *
 * The feature flag and the one projection every template response goes through.
 * No route logic lives here.
 */

/**
 * Spec §1.9 [GR-A2]: opt-IN, default OFF everywhere INCLUDING production.
 *
 * Parse shape copied from `readiness/recordDecision.ts:236-239`, the same one
 * `revisionGovernance.ts` reuses, and reproduced inline for the same reason:
 * `dataRetentionWorker.ts` parses the identical three tokens and inverts the
 * default, so there is no house convention to point at and a reader who assumed
 * the wrong one would ship this live to production on an unset variable.
 */
export function itpProvenanceEnabled(): boolean {
  const configured = process.env.ITP_PROVENANCE_ENABLED?.trim().toLowerCase();
  return configured === 'true' || configured === '1' || configured === 'yes';
}

/**
 * The columns §2.2(a)/(b) added. Listed once so the flag-off projection and the
 * compare endpoint's metadata diff cannot drift apart.
 */
export const ITP_PROVENANCE_FIELDS = [
  'authority',
  'specEdition',
  'specIssuedOn',
  'effectiveFrom',
  'reviewDueOn',
  'changeSummary',
  'annexureWarning',
  'supersededById',
  'supersededAt',
  'supersededBySeedRun',
] as const;

/**
 * Spec §2.4 rollback: "flag off hides the provenance UI and the compare
 * endpoint; data stays."
 *
 * Done server-side, in the two response builders every template surface already
 * routes through, rather than by teaching the frontend a second flag. A
 * rolled-back deployment serves exactly the template shape it served before G2,
 * and the rows keep their provenance for the next roll-forward.
 */
export function withProvenanceVisibility<T>(template: T): T {
  if (itpProvenanceEnabled() || !template || typeof template !== 'object') {
    return template;
  }

  const stripped = { ...(template as Record<string, unknown>) };
  for (const field of ITP_PROVENANCE_FIELDS) {
    delete stripped[field];
  }
  return stripped as T;
}
