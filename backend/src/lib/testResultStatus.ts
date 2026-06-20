export const PENDING_TEST_RESULT_STATUSES = [
  'pending',
  'submitted',
  'requested',
  'at_lab',
  'results_received',
  'entered',
] as const;

export function isPendingTestResultStatus(status: string | null | undefined): boolean {
  return PENDING_TEST_RESULT_STATUSES.includes(
    status as (typeof PENDING_TEST_RESULT_STATUSES)[number],
  );
}
