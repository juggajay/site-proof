// Frontend mirror of the shared readiness predicate library.
//
// The shell/field surfaces cannot import backend code, so the predicates they
// rely on are re-stated here — exactly as the readiness DTO types are mirrored
// in `frontend/src/types/evidenceReadiness.ts`. Keep this in lockstep with the
// backend source of truth:
//   backend/src/lib/readiness/predicates.ts
//
// F0.2a: mirror only what the shell consumes today (`lotConformable`). Any
// behavioural change to a mirrored predicate must land on the backend first.

/**
 * Structural subset of the conformance prerequisites the authoritative gate
 * consumes. Mirrors `ConformablePrerequisites` in the backend predicate library.
 */
export interface ConformablePrerequisites {
  itpAssigned: boolean;
  itpCompleted: boolean;
  testRequired: boolean;
  hasPassingTest: boolean;
  noOpenNcrs: boolean;
  noNaHoldPointBypass?: boolean;
}

/**
 * Authoritative "lot is conformable" composition. Byte-for-byte mirror of
 * `lotConformable` in backend/src/lib/readiness/predicates.ts.
 */
export function lotConformable(prerequisites: ConformablePrerequisites): boolean {
  return (
    prerequisites.itpAssigned &&
    prerequisites.itpCompleted &&
    (!prerequisites.testRequired || prerequisites.hasPassingTest) &&
    prerequisites.noOpenNcrs &&
    (prerequisites.noNaHoldPointBypass ?? true)
  );
}
