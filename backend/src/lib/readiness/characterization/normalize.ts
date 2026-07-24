// Deterministic normalizer for characterization snapshots (F0.1).
//
// The two live readiness endpoints embed volatile identifiers (lot/test/NCR/
// hold-point/checklist-item UUIDs, freshly minted on every seed run) inside
// `lotId`, `relatedIds`, `conformStatus.prerequisites.*` and item `outstandingTests`.
// None of that identity is behaviour — only its STRUCTURE is. To make the
// snapshot reproducible run-to-run (and byte-identical in F0.2), every UUID is
// replaced with a stable `<id:N>` token, indexed by first-appearance order in a
// deterministic serialization of the response. Because item-build order is
// deterministic, the same logical id maps to the same token every run even
// though the underlying UUID differs.
//
// No timestamps survive in these two responses except the force-conform detail
// string ("...on YYYY-MM-DD"), which the corpus pins via a fixed override date,
// so no date normalization is required here.

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Replace every UUID in a JSON-serializable value with a stable `<id:N>` token.
 * N is assigned in order of first appearance in `JSON.stringify(value)`, which
 * is deterministic for a fixed object shape.
 */
export function normalizeReadiness<T>(value: T): T {
  const serialized = JSON.stringify(value);
  const idMap = new Map<string, string>();
  const replaced = serialized.replace(UUID_RE, (match) => {
    const lower = match.toLowerCase();
    let token = idMap.get(lower);
    if (!token) {
      token = `<id:${idMap.size}>`;
      idMap.set(lower, token);
    }
    return token;
  });
  return JSON.parse(replaced) as T;
}
