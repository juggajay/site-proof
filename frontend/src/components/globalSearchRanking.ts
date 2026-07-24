// Exact-match-first ranking for global search. Within a single scope, an exact
// case-insensitive hit on the domain's primary identifier (lotNumber, ncrNumber,
// testRequestNumber, drawingNumber, filename) should outrank a mere substring
// hit — otherwise typing "NCR-0012" can bury the exact record under substring
// matches. Order is otherwise stable (the server already returns a sensible
// order), so this is a stable partition, not a full re-sort.
//
// Tiers: 0 exact · 1 prefix · 2 substring · 3 key doesn't match (item matched on
// some other field). Ties keep original order via the index tiebreaker.

export function rankResults<T>(
  items: T[],
  query: string,
  getKey: (item: T) => string | null | undefined,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice();

  const tier = (item: T): number => {
    const key = (getKey(item) ?? '').toLowerCase();
    if (!key) return 3;
    if (key === q) return 0;
    if (key.startsWith(q)) return 1;
    if (key.includes(q)) return 2;
    return 3;
  };

  return items
    .map((item, index) => ({ item, index, t: tier(item) }))
    .sort((a, b) => a.t - b.t || a.index - b.index)
    .map((entry) => entry.item);
}
