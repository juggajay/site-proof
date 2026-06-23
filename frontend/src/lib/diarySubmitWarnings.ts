/**
 * diarySubmitWarnings — the single, shared reading of the server's diary-submit
 * warning gate (M30).
 *
 * The backend answers `POST /api/diary/:id/submit` (without `acknowledgeWarnings`)
 * with a 422 whose error `details` carry `{ requiresAcknowledgement: true,
 * warnings: string[] }` when the diary is missing recommended content (no
 * weather, no personnel, etc.). The foreman must SEE those server-authored
 * warnings and explicitly acknowledge before the diary submits.
 *
 * `extractSubmitWarnings` turns such an error into the warning list (or null when
 * the error is not a 422 acknowledgement gate). Extracted from DiaryFinishFlow so
 * every submit surface — the foreman finish flow, the shell review screen, and
 * the desktop diary page — drives the gate off the SAME server contract instead
 * of re-deriving warnings client-side.
 */
import { ApiError } from '@/lib/api';
import { extractErrorDetails } from '@/lib/errorHandling';

/**
 * Parse a diary-submit error into the server's acknowledgement warnings.
 *
 * @returns the non-empty warning strings when the error is a 422 acknowledgement
 *   gate (`details.requiresAcknowledgement === true` with a `warnings` array), or
 *   `null` for any other error (network failure, non-422, or a 422 without a
 *   usable warning list) so the caller falls through to its normal error path.
 */
export function extractSubmitWarnings(error: unknown): string[] | null {
  if (!(error instanceof ApiError) || error.status !== 422) {
    return null;
  }

  const details = extractErrorDetails(error);
  if (details?.requiresAcknowledgement !== true || !Array.isArray(details.warnings)) {
    return null;
  }

  const warnings = details.warnings.filter(
    (warning): warning is string => typeof warning === 'string' && warning.trim().length > 0,
  );

  return warnings.length > 0 ? warnings : null;
}
