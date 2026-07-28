// Plain-English sync-failure vocabulary. Pure, zero dependencies (so
// ./syncKinds, which must not pull Dexie into the shell chunk, can import it).
//
// Two jobs, both about the same string:
//   - describeSyncFailure(status, body) — what a terminal 4xx WRITES into
//     `lastError` at classification time.
//   - humanSyncErrorText(lastError)     — what the Sync Centre RENDERS, which
//     also has to cope with the raw `response.text()` values the older
//     executors (itp_completion, ncr_create, diary) still store.
//
// Deliberately NOT lib/statusLabels.ts: that maps DB workflow enums
// (`awaiting_test`, `closed_concession`) to Title Case nouns. This maps HTTP
// statuses to whole sentences — different key space, different output shape.
// Bending statusLabels into a second job would make both harder to read.

const MESSAGE_BY_STATUS: Record<number, string> = {
  400: "The server wouldn't accept this — it can't be sent as it is.",
  401: 'Your sign-in expired. Sign in again, then retry.',
  403: "You don't have permission to save this.",
  404: 'The thing this was attached to was deleted.',
  409: 'Someone else changed this while you were offline.',
  413: 'This file is too large to upload.',
  422: 'Some details on this one are not valid.',
};

function unwrapErrorEnvelope(text: string): string | undefined {
  if (!text.startsWith('{') && !text.startsWith('[')) return undefined;
  try {
    const body = JSON.parse(text) as { error?: { message?: unknown }; message?: unknown };
    const message = typeof body?.error?.message === 'string' ? body.error.message : body?.message;
    return typeof message === 'string' && message.trim() ? message.trim() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The sentence to show for a stored `lastError`. Pulls the message out of the
 * backend's `{ error: { message } }` envelope so a JSON blob is never rendered
 * to a foreman; anything else passes through as written.
 */
export function humanSyncErrorText(lastError?: string): string | undefined {
  const text = lastError?.trim();
  if (!text) return undefined;
  return unwrapErrorEnvelope(text) ?? text;
}

/**
 * The sentence to STORE when a write is rejected for good. Falls back to the
 * server's own message, and never to a bare status code with no words.
 */
export function describeSyncFailure(status: number, rawBody?: string): string {
  return (
    MESSAGE_BY_STATUS[status] ??
    humanSyncErrorText(rawBody) ??
    `The server refused this change (error ${status}).`
  );
}
