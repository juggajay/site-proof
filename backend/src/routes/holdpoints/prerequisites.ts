/**
 * Hold-point prerequisite helpers, extracted verbatim from
 * backend/src/routes/holdpoints.ts as a slice of the holdpoints route split
 * (engineering-health Workstream 1).
 *
 * A hold point can only be released once every checklist item *before* it (lower
 * sequence number) is completed. The GET `/lot/:lotId/item/:itemId` route reports
 * that prerequisite status, and the POST `/request-release` route blocks the
 * request and returns the incomplete items as error details. These are the pure
 * pieces shared by both: find the preceding items, map each one's completion
 * status, compute which are incomplete, and trim the incomplete ones to the
 * error-detail shape. No DB, no auth, no request. Behaviour — the `<` sequence
 * cutoff, the status derivations (`isCompleted`/`isNotApplicable`/`isVerified`/
 * `completedAt`), the "incomplete = not completed and not N/A (a missing or
 * 'failed' completion still counts as incomplete)" rule, and the
 * `{ id, description, sequenceNumber, isHoldPoint }` error shape — are unit-tested
 * DB-free in prerequisites.test.ts. N/A items satisfy a preceding item because
 * N/A is a first-class ITP status (requires a reason, renders as done).
 */

export type PrerequisiteChecklistItem = {
  id: string;
  description: string;
  sequenceNumber: number;
  pointType: string;
};

export type PrerequisiteCompletion = {
  checklistItemId: string;
  status: string;
  verificationStatus: string;
  completedAt: Date | null;
};

// Find all checklist items that come before the hold point (lower sequence number).
export function getPrecedingChecklistItems(
  checklistItems: PrerequisiteChecklistItem[],
  holdPointSequenceNumber: number,
): PrerequisiteChecklistItem[] {
  return checklistItems.filter((item) => item.sequenceNumber < holdPointSequenceNumber);
}

// Map each preceding item to its prerequisite status using the lot's completions.
export function buildHoldPointPrerequisites(
  precedingItems: PrerequisiteChecklistItem[],
  completions: PrerequisiteCompletion[],
) {
  return precedingItems.map((item) => {
    const completion = completions.find((c) => c.checklistItemId === item.id);
    return {
      id: item.id,
      description: item.description,
      sequenceNumber: item.sequenceNumber,
      isHoldPoint: item.pointType === 'hold_point',
      isCompleted: completion?.status === 'completed',
      // N/A is a first-class status (requires a reason, renders as done) so it
      // satisfies a preceding item even though it is not literally 'completed'.
      isNotApplicable: completion?.status === 'not_applicable',
      isVerified: completion?.verificationStatus === 'verified',
      completedAt: completion?.completedAt,
    };
  });
}

type HoldPointPrerequisite = ReturnType<typeof buildHoldPointPrerequisites>[number];

// Prerequisites that are not satisfied. A preceding item is satisfied when it is
// completed OR marked N/A; a missing completion or a 'failed' status counts as
// incomplete and still blocks the hold-point release request.
export function getIncompletePrerequisites(
  prerequisites: HoldPointPrerequisite[],
): HoldPointPrerequisite[] {
  return prerequisites.filter((p) => !p.isCompleted && !p.isNotApplicable);
}

// Trim prerequisites to the error-details shape returned by /request-release,
// dropping the completion-only fields.
export function buildIncompletePrerequisiteDetails(prerequisites: HoldPointPrerequisite[]) {
  return prerequisites.map((item) => ({
    id: item.id,
    description: item.description,
    sequenceNumber: item.sequenceNumber,
    isHoldPoint: item.isHoldPoint,
  }));
}
