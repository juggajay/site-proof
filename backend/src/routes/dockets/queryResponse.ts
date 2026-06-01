// =============================================================================
// Docket query-response notes: the pure note-building helper for
// POST /api/dockets/:id/respond. Extracted verbatim from the inline note
// assembly in dockets.ts — appends the subcontractor's response under a
// "--- Response to Query ---" separator. When there are existing notes the
// response is appended after two newlines; with no existing notes
// (null/undefined/empty, collapsed via `|| ''`) only the separator + response
// is used. The response text is interpolated as-is — the route validates that
// it is non-empty but does NOT trim what it stores. The route still owns
// parsing, validation, Prisma reads/updates, access checks, audit logging, and
// notifications.
// =============================================================================

export function buildQueryResponseNotes(
  existingNotes: string | null | undefined,
  response: string,
): string {
  const notes = existingNotes || '';
  return notes
    ? `${notes}\n\n--- Response to Query ---\n${response}`
    : `--- Response to Query ---\n${response}`;
}
