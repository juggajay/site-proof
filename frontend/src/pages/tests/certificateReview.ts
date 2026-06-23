import { calculatePassFail } from './constants';

/**
 * H13: keep the reviewed pass/fail in sync with the result value + spec bounds
 * when an AI-extracted certificate is being reviewed before confirm. Recomputes
 * pass/fail from the current value/min/max; only overwrites when the data yields
 * a definite pass/fail, so a manual override survives an edit that leaves the
 * outcome indeterminate (calculatePassFail returns 'pending'). Returns a new
 * object — never mutates the input.
 */
export function recomputeReviewPassFail(form: Record<string, string>): Record<string, string> {
  const computed = calculatePassFail(
    form.resultValue || '',
    form.specificationMin || '',
    form.specificationMax || '',
  );
  if (computed === 'pending') {
    return form;
  }
  return { ...form, passFail: computed };
}
