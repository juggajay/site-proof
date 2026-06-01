// =============================================================================
// Docket display formatting: the small pure helpers that build the human-facing
// docket number, the ISO date key, and the actor display name reused across
// docket responses and notification payloads. Extracted from dockets.ts to
// remove repeated inline string-building — the output strings are preserved
// exactly (same `DKT-` prefix + 6-char uppercase id slice, same
// `toISOString().split('T')[0]` date key, same `fullName || email` fallback).
// =============================================================================

/** Human-facing docket number, e.g. `DKT-AB12CD`, derived from the docket id. */
export function formatDocketNumber(id: string): string {
  return `DKT-${id.slice(0, 6).toUpperCase()}`;
}

/** ISO date key (`YYYY-MM-DD`) for a docket/diary date. */
export function formatDocketDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Display name for a docket actor: full name when set, otherwise the email. */
export function formatDocketUserName(user: { fullName: string | null; email: string }): string {
  return user.fullName || user.email;
}
